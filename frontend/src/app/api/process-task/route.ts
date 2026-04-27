import { NextRequest, NextResponse } from "next/server";
import { processFieldReport } from "@/app/actions/match";
import { rateLimiter, validateOrigin, getClientIP, verifyAuthToken } from "@/lib/security";
import { validateInput, schemas } from "@/lib/utils";

// Force dynamic — prevents Next.js from trying to pre-render this route at build time
export const dynamic = "force-dynamic";

/* ========================================================================
   POST /api/process-task
   ========================================================================
   Called by the dashboard's auto-pilot mode or the manual "Process AI"
   button. Takes a raw field report and an existing Firestore task ID,
   then runs the full Gemini → Vector Search → Telegram dispatch pipeline.

   Security:
   - Centralized CSRF Protection (validateOrigin)
   - Centralized Rate Limiting (10 req/min per IP)
   - Centralized Zod Validation (schemas.processTask)
   - Sanitized error responses (no internal stack traces)
   ======================================================================== */

// Initialize global rate limiter
const limiter = rateLimiter({ windowMs: 60_000, maxRequests: 10 });

export async function POST(req: NextRequest) {
  try {
    // ── 1. CSRF Protection ──
    if (!validateOrigin(req)) {
      return NextResponse.json(
        { error: "Cross-origin request rejected." },
        { status: 403 }
      );
    }

    // ── 2. Rate Limiting ──
    const ip = getClientIP(req);
    if (limiter.isLimited(ip)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    // ── 3. Authentication ──
    const authResult = await verifyAuthToken(req);
    if (!authResult) {
      return NextResponse.json(
        { error: "Unauthorized. Missing or invalid ID token." },
        { status: 401 }
      );
    }

    // ── 3. Parse Body ──
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body." },
        { status: 400 }
      );
    }

    // ── 4. Zod Input Validation ──
    const validation = validateInput(schemas.processTask, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const { rawText, taskId } = validation.data;

    // ── 5. Process Field Report ──
    const result = await processFieldReport(rawText, taskId);

    // Return the process result
    return NextResponse.json(result, { status: result.success ? 200 : 500 });

  } catch (error) {
    console.error("process-task API error:", error);
    // Return sanitized error — no internal details
    return NextResponse.json(
      { error: "An internal error occurred while processing the task." },
      { status: 500 }
    );
  }
}
