"use server";

import { db } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { validateInput, schemas } from "@/lib/utils";
import { verifyAuthToken } from "@/lib/security";

/* ========================================================================
   SynapseEdge — deploySwarm Server Action (Hardened)
   ========================================================================
   Atomically deploys a squad to a task using a Firestore batch write.
   
   Security:
   - Auth verification (Firebase ID token)
   - Zod schema validation (schemas.deploySwarm)
   - Document existence verification before mutation
   - Sanitized error responses
   ======================================================================== */

export async function deploySwarm(taskId: string, squadId: string, idToken: string): Promise<boolean> {
  // ── Authentication Check ──
  const authResult = await verifyAuthToken(idToken);
  if (!authResult) {
    console.error("[deploySwarm] Unauthorized.");
    return false;
  }

  // ── Zod Input Validation ──
  const validation = validateInput(schemas.deploySwarm, { taskId, squadId });
  if (!validation.success) {
    console.error(`[deploySwarm] Validation failed: ${validation.error}`);
    return false;
  }

  const { taskId: validTaskId, squadId: validSquadId } = validation.data;

  try {
    // ── Verify documents exist before mutation ──
    const taskRef = db.collection("field_tasks").doc(validTaskId);
    const squadRef = db.collection("squads").doc(validSquadId);

    const [taskSnap, squadSnap] = await Promise.all([taskRef.get(), squadRef.get()]);

    if (!taskSnap.exists) {
      console.error(`[deploySwarm] Task ${validTaskId} not found.`);
      return false;
    }
    if (!squadSnap.exists) {
      console.error(`[deploySwarm] Squad ${validSquadId} not found.`);
      return false;
    }

    // ── Atomic Batch Write ──
    const batch = db.batch();

    batch.update(taskRef, {
      status: "DISPATCHED",
      assigned_squad: validSquadId,
      updatedAt: FieldValue.serverTimestamp(),
    });

    batch.update(squadRef, {
      status: "DEPLOYED",
      current_mission: validTaskId,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await batch.commit();
    return true;
  } catch (error) {
    console.error("[deploySwarm] Error deploying swarm:", error);
    return false;
  }
}
