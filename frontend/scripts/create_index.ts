/**
 * Creates the Firestore composite vector index for the volunteers collection.
 * Run: node --env-file=.env.local --import tsx scripts/create_index.ts
 */

import { GoogleAuth } from "google-auth-library";

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID!;

async function createVectorIndex() {
  console.log(`Creating vector index for project: ${PROJECT_ID}`);
  
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  
  const auth = new GoogleAuth({
    credentials: {
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      private_key: privateKey,
    },
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });

  const client = await auth.getClient();
  const token = await client.getAccessToken();

  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/collectionGroups/volunteers/indexes`;

  const body = {
    queryScope: "COLLECTION",
    fields: [
      { fieldPath: "availability", order: "ASCENDING" },
      {
        fieldPath: "embedding",
        vectorConfig: { dimension: 768, flat: {} },
      },
    ],
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  
  if (response.ok) {
    console.log("✅ Vector index creation started!");
    console.log("Name:", data.name);
    console.log("State:", data.state);
    console.log("\n⏳ Index build takes ~2-5 minutes. Check status at:");
    console.log(`https://console.firebase.google.com/project/${PROJECT_ID}/firestore/indexes`);
  } else {
    if (data.error?.message?.includes("already exists")) {
      console.log("✅ Vector index already exists! Ready to seed.");
    } else {
      console.error("❌ Error:", JSON.stringify(data.error, null, 2));
    }
  }
}

createVectorIndex();
