import { z } from "zod";

/* ========================================================================
   SynapseEdge — Shared Utilities
   ========================================================================
   Client-safe reusable utilities and schemas.
   ======================================================================== */

// ─── 1. Zod Input Validation Wrapper ─────────────────────────────────────────

export function validateInput<T>(
  schema: z.ZodType<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }

  const messages = result.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .slice(0, 3)
    .join("; ");

  return { success: false, error: messages };
}

// ─── 2. HTML Escaping (XSS Prevention) ───────────────────────────────────────

const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#039;",
};

export function escapeHTML(str: string): string {
  return str.replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char] || char);
}

// ─── 3. Text Sanitization ────────────────────────────────────────────────────

export function sanitizeText(text: string, maxLength: number = 2000): string {
  return text
    .replace(/[\x00-\x1F\x7F]/g, "")
    .slice(0, maxLength)
    .trim();
}

// ─── 4. Reusable Zod Schemas ─────────────────────────────────────────────────

export const schemas = {
  firestoreId: z
    .string()
    .min(1, "ID is required")
    .max(128)
    .regex(/^[a-zA-Z0-9_-]+$/),

  processTask: z.object({
    rawText: z.string().min(1).max(2000),
    taskId: z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/),
  }),

  deploySwarm: z.object({
    taskId: z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/),
    squadId: z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/),
  }),

  volunteer: z.object({
    name: z.string().min(1).max(200).transform((s) => s.trim()),
    telegramHandle: z.string().min(1).max(100).transform((s) => s.trim()),
    bio: z.string().min(1).max(2000).transform((s) => s.trim()),
  }),

  geminiExtraction: z.object({
    intent: z.string().min(1),
    urgency: z.number().int().min(1).max(5),
    skills_needed: z.array(z.string()),
    description: z.string().min(1),
  }),
};
