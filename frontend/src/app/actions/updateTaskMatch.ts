"use server";

import { db } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { verifyAuthToken } from "@/lib/security";
import { validateInput, schemas } from "@/lib/utils";

/* ========================================================================
   SynapseEdge — Accept / Reject Match Server Action (Hardened)
   ========================================================================
   Called from the Incidents dashboard when operator accepts or rejects
   a volunteer match on a task.

   Security:
   - Auth verification (Firebase ID token)
   - Zod schema validation on task ID
   - Sanitized error responses
   ======================================================================== */

export async function acceptMatch(
  taskId: string,
  volunteerName: string,
  idToken: string
): Promise<{ success: boolean; error?: string }> {
  const authResult = await verifyAuthToken(idToken);
  if (!authResult) return { success: false, error: "Unauthorized" };

  const idVal = validateInput(schemas.firestoreId, taskId);
  if (!idVal.success) return { success: false, error: "Invalid task ID" };

  try {
    const taskRef = db.collection("field_tasks").doc(idVal.data);
    await taskRef.update({
      status: "dispatched",
      dispatched: true,
      accepted_volunteer: volunteerName,
      acceptedAt: FieldValue.serverTimestamp(),
    });
    return { success: true };
  } catch {
    return { success: false, error: "Failed to accept match." };
  }
}

export async function rejectMatch(
  taskId: string,
  volunteerName: string,
  idToken: string
): Promise<{ success: boolean; error?: string }> {
  const authResult = await verifyAuthToken(idToken);
  if (!authResult) return { success: false, error: "Unauthorized" };

  const idVal = validateInput(schemas.firestoreId, taskId);
  if (!idVal.success) return { success: false, error: "Invalid task ID" };

  try {
    const taskRef = db.collection("field_tasks").doc(idVal.data);
    const snap = await taskRef.get();
    if (!snap.exists) return { success: false, error: "Task not found." };

    const data = snap.data()!;
    const allMatches: { name?: string }[] = data.all_matches || [];

    // Remove the rejected volunteer from all_matches
    const remaining = allMatches.filter(
      (m: { name?: string }) => m?.name !== volunteerName
    );

    if (remaining.length > 0) {
      // Promote next volunteer to primary match
      await taskRef.update({
        matched_volunteer: remaining[0],
        all_matches: remaining,
        rejected_volunteers: FieldValue.arrayUnion(volunteerName),
      });
    } else {
      // No more candidates — reset to incoming
      await taskRef.update({
        status: "incoming",
        dispatched: false,
        matched_volunteer: FieldValue.delete(),
        all_matches: FieldValue.delete(),
        match_reason: FieldValue.delete(),
        rejected_volunteers: FieldValue.arrayUnion(volunteerName),
      });
    }

    return { success: true };
  } catch {
    return { success: false, error: "Failed to reject match." };
  }
}
