import "server-only";
import { auth as adminAuth } from "@/lib/firebase-admin";
import type { NextRequest } from "next/server";

/* ========================================================================
   SynapseEdge — Centralized Security Utilities (Server-Only)
   ========================================================================
   Exports:
   - verifyAuthToken(req)    — Firebase ID token verification
   - rateLimiter(config)     — IP-based token bucket rate limiter
   - validateOrigin(req)     — CSRF validation
   - getClientIP(req)        — Client IP extraction
   ======================================================================== */

// ─── 1. Firebase Auth Token Verification ─────────────────────────────────────

export interface AuthResult {
  uid: string;
  email?: string;
}

export async function verifyAuthToken(
  reqOrToken: NextRequest | string
): Promise<AuthResult | null> {
  try {
    let token: string;

    if (typeof reqOrToken === "string") {
      token = reqOrToken;
    } else {
      const authHeader = reqOrToken.headers.get("authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return null;
      }
      token = authHeader.slice(7);
    }

    if (!token || token.length < 20) {
      return null;
    }

    const decoded = await adminAuth.verifyIdToken(token, true);
    return {
      uid: decoded.uid,
      email: decoded.email,
    };
  } catch (error) {
    console.error("[security] Token verification failed:", error);
    return null;
  }
}

// ─── 2. Rate Limiter (IP + Token Bucket) ─────────────────────────────────────

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export function rateLimiter(config: RateLimitConfig) {
  const store = new Map<string, RateLimitEntry>();

  const cleanup = setInterval(() => {
    const now = Date.now();
    store.forEach((entry, key) => {
      if (now > entry.resetAt) store.delete(key);
    });
  }, config.windowMs * 2);

  if (cleanup.unref) cleanup.unref();

  return {
    isLimited(key: string): boolean {
      const now = Date.now();
      const entry = store.get(key);

      if (!entry || now > entry.resetAt) {
        store.set(key, { count: 1, resetAt: now + config.windowMs });
        return false;
      }

      entry.count++;
      return entry.count > config.maxRequests;
    },

    remaining(key: string): number {
      const entry = store.get(key);
      if (!entry || Date.now() > entry.resetAt) return config.maxRequests;
      return Math.max(0, config.maxRequests - entry.count);
    },

    reset(key: string): void {
      store.delete(key);
    },

    get size(): number {
      return store.size;
    },
  };
}

// ─── 3. CSRF Origin Validation ───────────────────────────────────────────────

export function validateOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const host = req.headers.get("host");

  if (!host) return false;

  if (origin && origin.includes(host)) return true;
  if (!origin && referer && referer.includes(host)) return true;

  return false;
}

// ─── 4. Client-side IP Extraction ────────────────────────────────────────────

export function getClientIP(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}
