import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

/* ========================================================================
   SynapseEdge — Firebase Admin Initialization (Pure Firebase Stack)
   ========================================================================
   Server-side Firebase Admin SDK initialization for Next.js Server Actions.
   Handles cold starts gracefully by checking if the app is already initialized
   and correctly parses the private key from environment variables.
   ======================================================================== */

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // Replace escaped newlines with actual newlines to prevent parsing errors
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    });
    console.log("Firebase Admin initialized successfully.");
  } catch (error) {
    console.error("Firebase Admin initialization error:", error);
  }
}

export const db = getFirestore();
export const auth = admin.auth();
