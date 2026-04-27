/**
 * SynapseEdge — Firestore Tactical Seed Script
 * ================================================
 * Populates `squads` and `resources` collections with mock tactical data.
 * Resources are vectorized via Gemini text-embedding-004 for semantic search.
 *
 * Run:
 *   node --env-file=../.env.local --import tsx scripts/seed_tactical.ts
 */

import * as admin from "firebase-admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { GoogleGenerativeAI } from "@google/generative-ai";

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
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// ── Squad Data ────────────────────────────────────────────────────────────────
const squads = [
  {
    squad_id: "SQUAD-ALPHA",
    status: "ACTIVE",
    personnel_count: 4,
    primary_asset: "4x4 Jeep with winch",
    current_mission: "Medical evacuation from flood zone in Sector 3",
    location: { lat: 28.6139, lng: 77.2090 },
    eta_minutes: 12,
    mesh_signal_strength: 87,
  },
  {
    squad_id: "SQUAD-BRAVO",
    status: "ACTIVE",
    personnel_count: 3,
    primary_asset: "Ambulance (Type II)",
    current_mission: "Supply delivery to makeshift triage center Sector 7",
    location: { lat: 28.5505, lng: 77.1855 },
    eta_minutes: 8,
    mesh_signal_strength: 94,
  },
  {
    squad_id: "SQUAD-GHOST",
    status: "DARK",
    personnel_count: 5,
    primary_asset: "2x Motorcycle scouts",
    current_mission: "Recon of collapsed bridge at NH-44 overpass",
    location: { lat: 28.7041, lng: 77.1025 },
    eta_minutes: -1,
    mesh_signal_strength: 0,
  },
  {
    squad_id: "SQUAD-DELTA",
    status: "ACTIVE",
    personnel_count: 4,
    primary_asset: "Supply truck (3-ton flatbed)",
    current_mission: "Water and MRE distribution run to Sector 4 shelters",
    location: { lat: 28.4595, lng: 77.0266 },
    eta_minutes: 22,
    mesh_signal_strength: 72,
  },
];

// ── Resource Data ─────────────────────────────────────────────────────────────
const resources = [
  {
    name: "Standard Trauma Kits",
    category: "MEDICAL",
    quantity_current: 14,
    quantity_max: 60,
    burn_rate_per_hour: 3.2,
    description:
      "Military-grade individual first aid kits containing tourniquets, hemostatic gauze, chest seals, nasopharyngeal airways, and pressure bandages. Essential for treating blast injuries, lacerations, and penetrating trauma in the field. Each kit supports one critical casualty for up to 4 hours until hospital transfer.",
  },
  {
    name: "City School Bus",
    category: "TRANSPORT",
    quantity_current: 3,
    quantity_max: 3,
    burn_rate_per_hour: 0,
    description:
      "Standard 48-seat city school bus available for emergency requisition. Can transport large groups of displaced civilians, serve as a mobile triage staging area when seats are removed, or function as a temporary command post with its onboard PA system and emergency lighting. Diesel-powered with 400km range.",
  },
  {
    name: "Industrial Water Purifier",
    category: "WATER",
    quantity_current: 2,
    quantity_max: 5,
    burn_rate_per_hour: 0.1,
    description:
      "Portable reverse-osmosis water purification unit capable of processing 5000 liters per hour from contaminated freshwater sources. Includes UV sterilization stage, activated carbon filtration, and TDS monitoring. Can be deployed at riverbanks or flooded zones to provide safe drinking water to up to 2000 people per day.",
  },
  {
    name: "Portable Generator Array",
    category: "POWER",
    quantity_current: 4,
    quantity_max: 8,
    burn_rate_per_hour: 0.5,
    description:
      "Cluster of four 5kW diesel generators with automatic load balancing and transfer switching. Provides emergency power for field hospitals, communication relays, water pumps, and lighting rigs. Each unit runs 18 hours on a full tank. Includes weatherproof housing and grounding kit for wet-terrain deployment.",
  },
  {
    name: "Emergency MRE Rations",
    category: "FOOD",
    quantity_current: 520,
    quantity_max: 800,
    burn_rate_per_hour: 21.6,
    description:
      "Meals Ready-to-Eat with flameless ration heaters. Each unit provides 1250 calories with balanced macronutrients. Shelf-stable for 5 years. Includes entree, side dish, bread, spread, dessert, beverage mix, and utensils. Halal and vegetarian variants available. Critical for feeding displaced populations when cooking infrastructure is destroyed.",
  },
];

// ── Embedding Helper ──────────────────────────────────────────────────────────
async function generateEmbedding(text: string): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
  const result = await model.embedContent({
    content: { parts: [{ text }], role: "user" },
    outputDimensionality: 768,
  } as Parameters<typeof model.embedContent>[0]);
  return result.embedding.values.slice(0, 768);
}

// ── Seed Logic ────────────────────────────────────────────────────────────────
async function seed() {
  console.log("═".repeat(60));
  console.log("🎯 SynapseEdge — Tactical Database Seeder");
  console.log("═".repeat(60));

  // ── Squads ──────────────────────────────────────────────────────────────────
  console.log("\n[PHASE 1] Seeding squads collection...\n");

  for (const squad of squads) {
    const docRef = db.collection("squads").doc(squad.squad_id);
    await docRef.set({
      ...squad,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    const icon = squad.status === "DARK" ? "🔴" : "🟢";
    console.log(`  ${icon} ${squad.squad_id} → ${squad.status} // ${squad.personnel_count} personnel // ${squad.primary_asset}`);
  }

  console.log(`\n  ✅ ${squads.length} squads written.\n`);

  // ── Resources ───────────────────────────────────────────────────────────────
  console.log("[PHASE 2] Seeding resources collection (with Gemini embeddings)...\n");

  for (const resource of resources) {
    process.stdout.write(`  [→] Embedding "${resource.name}"...`);

    try {
      const embeddingArray = await generateEmbedding(resource.description);

      const docRef = db.collection("resources").doc();
      await docRef.set({
        name: resource.name,
        category: resource.category,
        quantity_current: resource.quantity_current,
        quantity_max: resource.quantity_max,
        burn_rate_per_hour: resource.burn_rate_per_hour,
        description: resource.description,
        embedding: FieldValue.vector(embeddingArray),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      console.log(` ✓ (${embeddingArray.length}-dim) → ID: ${docRef.id}`);
    } catch (err) {
      console.log(` ✗ FAILED`);
      console.error(err);
    }

    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log(`\n  ✅ ${resources.length} resources written.\n`);
  console.log("═".repeat(60));
  console.log("✅ Tactical seeding complete.");
  console.log("   → Firestore > squads");
  console.log("   → Firestore > resources (with 768-dim vectors)");
  console.log("═".repeat(60));
  process.exit(0);
}

seed();
