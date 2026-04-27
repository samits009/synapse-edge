package com.synapseedge.cortex.data.local

import androidx.room.*
import com.synapseedge.cortex.data.local.entities.TaskEntity
import kotlinx.coroutines.flow.Flow

/**
 * Data Access Object for field tasks in the local Room database.
 *
 * Provides reactive [Flow]-based queries for the UI layer, and suspend
 * functions for write operations from the repository/engine layers.
 *
 * Key design decisions:
 * - [OnConflictStrategy.REPLACE] on insert handles mesh relay deduplication.
 *   If a task with the same UUID arrives from a different mesh peer, we take
 *   the latest version (last-write-wins).
 * - Sync state queries enable the [MeshSyncManager] to efficiently find
 *   tasks that need to be broadcast to peers.
 */
@Dao
interface TaskDao {

    // ========================================================================
    // QUERIES — Reactive (Flow-based for UI observation)
    // ========================================================================

    /** Observe all tasks ordered by urgency (critical first) then creation time */
    @Query("SELECT * FROM field_tasks ORDER BY urgency DESC, created_at DESC")
    fun observeAllTasks(): Flow<List<TaskEntity>>

    /** Observe tasks pending mesh sync (not yet relayed to any peer) */
    @Query("SELECT * FROM field_tasks WHERE sync_state = 'PENDING' ORDER BY urgency DESC")
    fun observePendingTasks(): Flow<List<TaskEntity>>

    /** Observe tasks ready for cloud upload (mesh-synced but not cloud-synced) */
    @Query("""
        SELECT * FROM field_tasks 
        WHERE sync_state IN ('PENDING', 'MESH_SYNCED') 
        ORDER BY urgency DESC
    """)
    fun observeUnsyncedTasks(): Flow<List<TaskEntity>>

    /** Observe tasks by sync state */
    @Query("SELECT * FROM field_tasks WHERE sync_state = :state ORDER BY created_at DESC")
    fun observeTasksByState(state: String): Flow<List<TaskEntity>>

    // ========================================================================
    // QUERIES — One-shot (for sync operations)
    // ========================================================================

    /** Get all tasks that need to be broadcast via mesh relay */
    @Query("SELECT * FROM field_tasks WHERE sync_state = 'PENDING'")
    suspend fun getPendingTasks(): List<TaskEntity>

    /** Get all tasks that haven't been uploaded to the cloud yet */
    @Query("SELECT * FROM field_tasks WHERE sync_state IN ('PENDING', 'MESH_SYNCED')")
    suspend fun getUnsyncedTasks(): List<TaskEntity>

    /** Get a single task by its UUID */
    @Query("SELECT * FROM field_tasks WHERE id = :taskId")
    suspend fun getTaskById(taskId: String): TaskEntity?

    /** Check if a task already exists (for mesh relay deduplication) */
    @Query("SELECT COUNT(*) FROM field_tasks WHERE id = :taskId")
    suspend fun taskExists(taskId: String): Int

    /** Get total count of all tasks */
    @Query("SELECT COUNT(*) FROM field_tasks")
    suspend fun getTaskCount(): Int

    // ========================================================================
    // WRITES — Suspend functions for background execution
    // ========================================================================

    /** Insert or replace a task (handles mesh relay dedup via REPLACE strategy) */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertTask(task: TaskEntity)

    /** Batch insert for mesh relay bulk sync */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertTasks(tasks: List<TaskEntity>)

    /** Update sync state for a specific task */
    @Query("UPDATE field_tasks SET sync_state = :newState WHERE id = :taskId")
    suspend fun updateSyncState(taskId: String, newState: String)

    /** Batch update sync state (e.g., after successful cloud upload) */
    @Query("UPDATE field_tasks SET sync_state = :newState WHERE id IN (:taskIds)")
    suspend fun batchUpdateSyncState(taskIds: List<String>, newState: String)

    /** Increment sync hops (called when task is relayed through mesh) */
    @Query("UPDATE field_tasks SET sync_hops = sync_hops + 1 WHERE id = :taskId")
    suspend fun incrementSyncHops(taskId: String)

    /** Update the full task entity */
    @Update
    suspend fun updateTask(task: TaskEntity)

    /** Delete a specific task */
    @Delete
    suspend fun deleteTask(task: TaskEntity)

    /** Nuke all tasks (development/testing only) */
    @Query("DELETE FROM field_tasks")
    suspend fun deleteAllTasks()
}
