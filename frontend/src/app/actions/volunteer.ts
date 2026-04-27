

import { db } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { validateInput, schemas, sanitizeText } from "@/lib/utils";

/* ========================================================================
   SynapseEdge — Volunteer Ingestion Server Action (Hardened)
   ========================================================================
   Takes raw volunteer data, generates a 768-dimensional embedding of
   their unstructured bio using Gemini, and saves it directly to Firestore.
   
   Security:
   - Centralized Zod validation (schemas.volunteer)
   - Sanitized text inputs
   ======================================================================== */

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn("[volunteer] GEMINI_API_KEY is not set. Embedding generation will fail.");
}
const genAI = new GoogleGenerativeAI(apiKey || "");

export async function addVolunteer(data: unknown) {
  // ── Zod Input Validation ──
  const validation = validateInput(schemas.volunteer, data);
  if (!validation.success) {
    throw new Error(`Validation failed: ${validation.error}`);
  }

  const { name, telegramHandle, bio } = validation.data;

  // Sanitize text fields
  const cleanName = sanitizeText(name, 200);
  const cleanHandle = sanitizeText(telegramHandle, 100);
  const cleanBio = sanitizeText(bio, 2000);

  try {
    // 1. Generate Embedding via Gemini
    const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
    const result = await embeddingModel.embedContent({
      content: { parts: [{ text: cleanBio }], role: "user" },
      outputDimensionality: 768,
    } as Parameters<typeof embeddingModel.embedContent>[0]);
    const embeddingArray = result.embedding.values;

    // 2. Save to Firestore with Native Vector
    const volunteerRef = db.collection("volunteers").doc();
    await volunteerRef.set({
      name: cleanName,
      telegramHandle: cleanHandle,
      bio: cleanBio,
      // Store the array as a native Firestore VectorValue for semantic search
      embedding: FieldValue.vector(embeddingArray),
      availability: true,
      createdAt: FieldValue.serverTimestamp(),
    });

    console.log(`[volunteer] Added volunteer ID: ${volunteerRef.id}`);

    return { 
      success: true, 
      volunteerId: volunteerRef.id 
    };

  } catch (error) {
    console.error("[volunteer] Error adding volunteer:", error);
    return { 
      success: false, 
      error: "Failed to process volunteer registration." // Sanitized error
    };
  }
}
