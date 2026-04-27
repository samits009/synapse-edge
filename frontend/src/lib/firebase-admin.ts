import * as admin from "firebase-admin";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { Auth } from "firebase-admin/auth";

/* ========================================================================
   SynapseEdge — Firebase Admin Initialization (Pure Firebase Stack)
   ========================================================================
   Server-side Firebase Admin SDK initialization for Next.js Server Actions.
   Handles cold starts gracefully by checking if the app is already initialized
   and correctly parses the private key from environment variables.

   Build-time safety: During `next build`, environment variables may not be
   present. We use lazy getters so the app doesn't crash at build time when
   collecting page data for dynamic routes like /api/process-task.
   ======================================================================== */

function getApp(): admin.app.App {
  if (admin.apps.length) {
    return admin.apps[0]!;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    console.warn(
      "Firebase Admin: Missing environment variables — skipping initialization (build-time is OK)."
    );
    // Return a dummy app reference; runtime calls will fail with a clear error
    return undefined as unknown as admin.app.App;
  }

  try {
    const app = admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        // Replace escaped newlines with actual newlines to prevent parsing errors
        privateKey: privateKey.replace(/\\n/g, "\n"),
      }),
    });
    console.log("Firebase Admin initialized successfully.");
    return app;
  } catch (error) {
    console.error("Firebase Admin initialization error:", error);
    return undefined as unknown as admin.app.App;
  }
}

// Lazy-initialize on first access (not during module load / build)
let _db: Firestore | null = null;
let _auth: Auth | null = null;

export const db: Firestore = new Proxy({} as Firestore, {
  get(_target, prop) {
    if (!_db) {
      getApp();
      if (admin.apps.length) {
        _db = getFirestore();
      } else {
        throw new Error("Firebase Admin is not initialized — check environment variables.");
      }
    }
    return (_db as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export const auth: Auth = new Proxy({} as Auth, {
  get(_target, prop) {
    if (!_auth) {
      getApp();
      if (admin.apps.length) {
        _auth = admin.auth();
      } else {
        throw new Error("Firebase Admin is not initialized — check environment variables.");
      }
    }
    return (_auth as unknown as Record<string | symbol, unknown>)[prop];
  },
});
