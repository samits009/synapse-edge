/**
 * SynapseEdge — Firestore Volunteer Seed Script
 * ================================================
 * Initializes the `volunteers` Firestore collection with real volunteer
 * profiles. Calls the Gemini embedding API on each bio and stores the
 * resulting vector as a native Firestore `FieldValue.vector()`.
 *
 * Run after creating the Firestore vector index:
 *   node --env-file=../.env.local --import tsx scripts/seed_volunteers.ts
 */

import * as admin from "firebase-admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { GoogleGenerativeAI } from "@google/generative-ai";

// ── Environment Validation ────────────────────────────────────────────────────
const requiredEnvVars = [
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
  "GEMINI_API_KEY"
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`[FATAL] Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// ── Firebase Admin Init ───────────────────────────────────────────────────────
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}
const db = getFirestore();

// ── Gemini Init ───────────────────────────────────────────────────────────────
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// ── Types ─────────────────────────────────────────────────────────────────────
interface Volunteer {
  name: string;
  telegramHandle: string;
  bio: string;
  skills_raw: string[];
  location_lat: number;
  location_lng: number;
}

// ── Volunteer Profiles ────────────────────────────────────────────────────────
const volunteers: Volunteer[] = [
  {
    name: "Dr. Priya Sharma",
    telegramHandle: "@priya_sharma_msf",
    bio: "I am a trauma surgeon with 12 years of field hospital experience. I have worked with MSF in Syria and South Sudan. Fluent in Hindi, English, and basic Arabic. Certified in disaster triage protocols and can set up field medical stations from scratch. Also trained in water purification systems.",
    skills_raw: ["medicine", "triage", "surgery", "water-purification"],
    location_lat: 28.6139,
    location_lng: 77.2090,
  },
  {
    name: "Marcus Chen",
    telegramHandle: "@marcus_chen_logistics",
    bio: "Software engineer turned humanitarian logistics coordinator. Expert in supply chain optimization, fleet management, and warehouse operations. Built custom tracking systems for UNHCR refugee camp distributions. Licensed HAM radio operator and drone pilot. Can repair generators and solar panel systems.",
    skills_raw: ["logistics", "technology", "drones", "radio"],
    location_lat: 37.7749,
    location_lng: -122.4194,
  },
  {
    name: "Fatima Al-Hassan",
    telegramHandle: "@fatima_health_worker",
    bio: "Community health worker specializing in maternal and child health in rural areas. 8 years of experience conducting health surveys and vaccination drives. Speak Arabic, French, and Swahili. Trained in psychosocial first aid and community mobilization. Can organize and train local volunteer teams rapidly.",
    skills_raw: ["health", "community-organizing", "translation", "training"],
    location_lat: -1.2921,
    location_lng: 36.8219,
  },
  {
    name: "Raj Patel",
    telegramHandle: "@raj_structural_eng",
    bio: "Civil engineer with expertise in emergency shelter construction and structural damage assessment. Experienced with bamboo, tarpaulin, and prefab shelter systems. Have deployed to earthquake zones in Nepal and Turkey. Also skilled in GIS mapping and can operate heavy construction equipment including excavators.",
    skills_raw: ["engineering", "construction", "shelters", "GIS"],
    location_lat: 19.0760,
    location_lng: 72.8777,
  },
  {
    name: "Sarah Okonkwo",
    telegramHandle: "@sarah_comms_rescue",
    bio: "Former military communications officer now working in disaster preparedness. Expert in setting up mesh communication networks, satellite phones, and portable internet solutions. Trained in search and rescue operations. Can coordinate multi-agency response efforts and manage incident command systems. Experienced rock climber and wilderness navigator.",
    skills_raw: ["communications", "search-rescue", "navigation", "leadership"],
    location_lat: 6.5244,
    location_lng: 3.3792,
  },
];

// ── Embedding Helper ──────────────────────────────────────────────────────────
async function generateEmbedding(text: string): Promise<number[]> {
  // Using the recommended text-embedding-004 model
  const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
  
  try {
    const result = await model.embedContent(text);
    return result.embedding.values;
  } catch (error) {
    console.error(`[ERROR] Failed to generate embedding:`, error);
    throw error;
  }
}

// ── Seed Logic ────────────────────────────────────────────────────────────────
async function seed() {
  console.log("═".repeat(60));
  console.log("🌱 SynapseEdge — Firestore Volunteer Seeder");
  console.log("═".repeat(60) + "\n");

  const batch = db.batch();
  let successCount = 0;
  const errors: Error[] = [];

  for (const volunteer of volunteers) {
    process.stdout.write(`[→] Embedding bio for ${volunteer.name}...`);
    
    try {
      const embeddingArray = await generateEmbedding(volunteer.bio);
      const docRef = db.collection("volunteers").doc();
      
      batch.set(docRef, {
        name: volunteer.name,
        telegramHandle: volunteer.telegramHandle,
        bio: volunteer.bio,
        skills_raw: volunteer.skills_raw,
        location_lat: volunteer.location_lat,
        location_lng: volunteer.location_lng,
        availability: true,
        embedding: FieldValue.vector(embeddingArray),
        createdAt: FieldValue.serverTimestamp(),
      });

      console.log(` ✓ (${embeddingArray.length}-dim vector)`);
      successCount++;
    } catch (err) {
      console.log(` ✗ FAILED`);
      errors.push(err as Error);
    }

    // Small delay to respect rate limits (text-embedding-004 allows up to 1500 RPM on paid, but 15 RPM on free tier)
    // Adjust based on your API key tier. 1000ms is safe for most.
    await new Promise((r) => setTimeout(r, 1000));
  }

  if (successCount > 0) {
    console.log(`\n[→] Committing batch of ${successCount} volunteers to Firestore...`);
    try {
      await batch.commit();
      console.log(" ✓ Batch committed successfully.");
    } catch (error) {
      console.error("[FATAL] Failed to commit Firestore batch:", error);
      process.exit(1);
    }
  }

  console.log("\n" + "═".repeat(60));
  
  if (errors.length > 0) {
    console.warn(`⚠️ Completed with ${errors.length} errors.`);
    console.log("═".repeat(60));
    process.exit(1);
  } else {
    console.log("✅ Seeding complete! Check Firebase Console > Firestore > volunteers");
    console.log("═".repeat(60));
    process.exit(0);
  }
}

seed().catch((error) => {
  console.error("[FATAL] Unhandled rejection:", error);
  process.exit(1);
});
