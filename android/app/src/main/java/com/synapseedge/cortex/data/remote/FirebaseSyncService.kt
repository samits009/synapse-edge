package com.synapseedge.cortex.data.remote

import android.util.Log
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import com.synapseedge.cortex.domain.models.FieldTask
import com.synapseedge.cortex.domain.models.SyncState
import kotlinx.coroutines.tasks.await

/**
 * FirebaseSyncService — Cloud synchronization layer.
 *
 * Handles uploading tasks from the local Room database to Firebase Firestore
 * when internet connectivity is available. This is the bridge between the
 * offline-first edge layer and the cloud backend.
 *
 * Sync flow:
 * ```
 * Room DB (PENDING/MESH_SYNCED tasks)
 *     → FirebaseSyncService.syncTask()
 *         → Firebase Firestore `field_tasks` collection
 *             → Cloud Function trigger (or direct backend poll)
 *                 → FastAPI /api/v1/tasks/ingest endpoint
 *                     → Vertex AI embedding + pgvector matching
 * ```
 *
 * The service also tracks mesh node status in Firestore for the
 * dashboard's real-time map visualization.
 */
class FirebaseSyncService {

    companion object {
        private const val TAG = "FirebaseSyncService"
        private const val COLLECTION_TASKS = "field_tasks"
        private const val COLLECTION_MESH_NODES = "mesh_nodes"
        private const val COLLECTION_SYNC_LOG = "sync_log"
    }

    private val firestore: FirebaseFirestore by lazy {
        FirebaseFirestore.getInstance()
    }

    /**
     * Upload a single task to Firebase Firestore.
     *
     * Uses [SetOptions.merge] to handle upserts — if a task with the
     * same ID already exists (uploaded by a different mesh peer that
     * reached Wi-Fi first), we merge rather than overwrite.
     *
     * @param task The [FieldTask] to sync
     * @return true if upload succeeded, false otherwise
     */
    suspend fun syncTask(task: FieldTask): Boolean {
        return try {
            val taskDoc = hashMapOf(
                "id" to task.id,
                "raw_text" to task.rawText,
                "intent" to task.intent,
                "urgency" to task.urgency,
                "skills_needed" to task.skillsNeeded,
                "description" to task.description,
                "location_lat" to task.locationLat,
                "location_lng" to task.locationLng,
                "source_device_id" to task.sourceDeviceId,
                "sync_hops" to task.syncHops,
                "sync_state" to SyncState.CLOUD_SYNCED.name,
                "created_at" to task.createdAt,
                "synced_at" to System.currentTimeMillis()
            )

            firestore.collection(COLLECTION_TASKS)
                .document(task.id)
                .set(taskDoc, SetOptions.merge())
                .await()

            Log.d(TAG, "✓ Task ${task.id} synced to Firestore")
            true
        } catch (e: Exception) {
            Log.e(TAG, "✗ Failed to sync task ${task.id}: ${e.message}")
            false
        }
    }

    /**
     * Batch sync multiple tasks to Firestore.
     *
     * Uses Firestore's WriteBatch for atomic multi-document writes.
     * This is more efficient than individual writes when syncing
     * a backlog of mesh-accumulated tasks.
     *
     * @param tasks List of tasks to sync
     * @return Number of successfully synced tasks
     */
    suspend fun syncBatch(tasks: List<FieldTask>): Int {
        if (tasks.isEmpty()) return 0

        return try {
            val batch = firestore.batch()

            tasks.forEach { task ->
                val docRef = firestore.collection(COLLECTION_TASKS).document(task.id)
                val taskDoc = hashMapOf(
                    "id" to task.id,
                    "raw_text" to task.rawText,
                    "intent" to task.intent,
                    "urgency" to task.urgency,
                    "skills_needed" to task.skillsNeeded,
                    "description" to task.description,
                    "location_lat" to task.locationLat,
                    "location_lng" to task.locationLng,
                    "source_device_id" to task.sourceDeviceId,
                    "sync_hops" to task.syncHops,
                    "sync_state" to SyncState.CLOUD_SYNCED.name,
                    "created_at" to task.createdAt,
                    "synced_at" to System.currentTimeMillis()
                )
                batch.set(docRef, taskDoc, SetOptions.merge())
            }

            batch.commit().await()
            Log.d(TAG, "✓ Batch synced ${tasks.size} tasks to Firestore")
            tasks.size
        } catch (e: Exception) {
            Log.e(TAG, "✗ Batch sync failed: ${e.message}")
            0
        }
    }

    /**
     * Update this device's status in the mesh_nodes collection.
     *
     * The dashboard reads this collection to render the real-time
     * mesh network map showing which devices are online, their
     * locations, and connectivity status.
     *
     * @param deviceId Unique device identifier
     * @param isOnline Whether the device is currently active
     * @param latitude Current GPS latitude
     * @param longitude Current GPS longitude
     * @param peerCount Number of connected mesh peers
     * @param taskCount Number of tasks stored locally
     */
    suspend fun updateMeshNodeStatus(
        deviceId: String,
        isOnline: Boolean,
        latitude: Double? = null,
        longitude: Double? = null,
        peerCount: Int = 0,
        taskCount: Int = 0
    ) {
        try {
            val nodeDoc = hashMapOf(
                "device_id" to deviceId,
                "is_online" to isOnline,
                "location_lat" to latitude,
                "location_lng" to longitude,
                "peer_count" to peerCount,
                "task_count" to taskCount,
                "last_seen" to System.currentTimeMillis()
            )

            firestore.collection(COLLECTION_MESH_NODES)
                .document(deviceId)
                .set(nodeDoc, SetOptions.merge())
                .await()

            Log.d(TAG, "✓ Mesh node status updated: $deviceId (online=$isOnline)")
        } catch (e: Exception) {
            Log.e(TAG, "✗ Failed to update mesh node status: ${e.message}")
        }
    }
}
