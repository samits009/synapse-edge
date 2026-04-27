import { getFirestore, FieldValue } from "firebase-admin/firestore";
import * as admin from "firebase-admin";

// 1. Initialize Firebase Admin
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

// 2. The simulated field report
const emergencyText = process.argv[2] || "Massive flooding near the river bank. We urgently need 2 boats and someone with emergency medical training to evacuate elderly residents.";

async function simulateReport() {
  console.log("🚨 Pushing new field report to Firestore...");
  console.log(`📝 Text: "${emergencyText}"`);

  const doc = await db.collection("field_tasks").add({
    raw_text: emergencyText,
    status: "incoming", // This triggers the dashboard & AI pipeline
    location_lat: 28.5 + (Math.random() * 0.1 - 0.05), // random point near center
    location_lng: 77.2 + (Math.random() * 0.1 - 0.05),
    createdAt: FieldValue.serverTimestamp(),
  });

  console.log(`✅ Success! Task ID: ${doc.id}`);
  console.log("👉 Now check your Mission Control dashboard at http://localhost:3000!");
}

simulateReport().catch(console.error);
