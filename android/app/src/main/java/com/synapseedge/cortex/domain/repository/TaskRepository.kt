package com.synapseedge.cortex.domain.repository

import com.synapseedge.cortex.data.local.AppDatabase
import com.synapseedge.cortex.data.local.entities.TaskEntity
import com.synapseedge.cortex.domain.models.FieldTask
import com.synapseedge.cortex.domain.models.SyncState
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

/**
 * TaskRepository — Single source of truth for field task operations.
 *
 * This repository mediates between the various data sources:
 * - Room Database (offline-first local persistence)
 * - MeshSyncManager (peer-to-peer relay)
 * - Firebase Firestore (cloud sync)
 *
 * It provides a clean API for the UI layer, abstracting away the
 * complexity of multi-source data synchronization.
 *
 * Data flow:
 * ```
 * SnapToSemanticsEngine → TaskRepository → Room (immediate)
 *                                        → MeshSyncManager (when peers available)
 *                                        → Firebase (when Wi-Fi available)
 * ```
 */
class TaskRepository(private val database: AppDatabase) {

    private val taskDao = database.taskDao()

    // ========================================================================
    // Reactive Observations (for UI binding)
    // ========================================================================

    /** Observe all tasks, ordered by urgency then creation time */
    fun observeAllTasks(): Flow<List<FieldTask>> =
        taskDao.observeAllTasks().map { entities ->
            entities.map { it.toDomainModel() }
        }

    /** Observe tasks waiting to be synced (either via mesh or cloud) */
    fun observePendingTasks(): Flow<List<FieldTask>> =
        taskDao.observePendingTasks().map { entities ->
            entities.map { it.toDomainModel() }
        }

    /** Observe tasks that haven't reached the cloud yet */
    fun observeUnsyncedTasks(): Flow<List<FieldTask>> =
        taskDao.observeUnsyncedTasks().map { entities ->
            entities.map { it.toDomainModel() }
        }

    /** Observe tasks filtered by sync state */
    fun observeByState(state: SyncState): Flow<List<FieldTask>> =
        taskDao.observeTasksByState(state.name).map { entities ->
            entities.map { it.toDomainModel() }
        }

    // ========================================================================
    // One-shot Operations
    // ========================================================================

    /** Get a single task by ID */
    suspend fun getTask(id: String): FieldTask? =
        taskDao.getTaskById(id)?.toDomainModel()

    /** Get all tasks pending sync */
    suspend fun getPendingTasks(): List<FieldTask> =
        taskDao.getPendingTasks().map { it.toDomainModel() }

    /** Get all tasks not yet in the cloud */
    suspend fun getUnsyncedTasks(): List<FieldTask> =
        taskDao.getUnsyncedTasks().map { it.toDomainModel() }

    /** Check if a task already exists (for deduplication) */
    suspend fun exists(taskId: String): Boolean =
        taskDao.taskExists(taskId) > 0

    /** Get total task count */
    suspend fun count(): Int = taskDao.getTaskCount()

    // ========================================================================
    // Write Operations
    // ========================================================================

    /** Save a task (insert or replace for dedup) */
    suspend fun save(task: FieldTask) {
        taskDao.insertTask(TaskEntity.fromDomainModel(task))
    }

    /** Save multiple tasks (bulk mesh sync) */
    suspend fun saveBatch(tasks: List<FieldTask>) {
        taskDao.insertTasks(tasks.map { TaskEntity.fromDomainModel(it) })
    }

    /** Update sync state */
    suspend fun updateSyncState(taskId: String, newState: SyncState) {
        taskDao.updateSyncState(taskId, newState.name)
    }

    /** Mark tasks as mesh-synced */
    suspend fun markMeshSynced(taskIds: List<String>) {
        taskDao.batchUpdateSyncState(taskIds, SyncState.MESH_SYNCED.name)
    }

    /** Mark tasks as cloud-synced */
    suspend fun markCloudSynced(taskIds: List<String>) {
        taskDao.batchUpdateSyncState(taskIds, SyncState.CLOUD_SYNCED.name)
    }

    /** Increment hop count for relayed tasks */
    suspend fun incrementHops(taskId: String) {
        taskDao.incrementSyncHops(taskId)
    }

    /** Delete a task */
    suspend fun delete(task: FieldTask) {
        taskDao.deleteTask(TaskEntity.fromDomainModel(task))
    }

    /** Delete all tasks (development only) */
    suspend fun deleteAll() {
        taskDao.deleteAllTasks()
    }
}
