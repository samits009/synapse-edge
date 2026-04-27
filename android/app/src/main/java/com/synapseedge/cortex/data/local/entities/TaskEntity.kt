package com.synapseedge.cortex.data.local.entities

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey
import com.synapseedge.cortex.domain.models.FieldTask
import com.synapseedge.cortex.domain.models.SyncState

/**
 * Room entity for persisting [FieldTask] objects in the local SQLite database.
 *
 * This is the offline-first persistence layer. All tasks are stored here
 * immediately upon creation, regardless of network state. The [syncState]
 * column tracks the task's progress through the sync pipeline.
 *
 * Separation of concerns: This entity handles persistence; [FieldTask] handles
 * domain logic and serialization for mesh/cloud transport.
 */
@Entity(tableName = "field_tasks")
data class TaskEntity(
    @PrimaryKey
    val id: String,

    @ColumnInfo(name = "raw_text")
    val rawText: String,

    @ColumnInfo(name = "intent")
    val intent: String? = null,

    @ColumnInfo(name = "urgency")
    val urgency: Int = 3,

    /** Stored as comma-separated string; converted via TypeConverter */
    @ColumnInfo(name = "skills_needed")
    val skillsNeeded: String = "",

    @ColumnInfo(name = "description")
    val description: String? = null,

    @ColumnInfo(name = "location_lat")
    val locationLat: Double? = null,

    @ColumnInfo(name = "location_lng")
    val locationLng: Double? = null,

    @ColumnInfo(name = "source_device_id")
    val sourceDeviceId: String? = null,

    @ColumnInfo(name = "sync_hops")
    val syncHops: Int = 0,

    @ColumnInfo(name = "sync_state")
    val syncState: String = SyncState.PENDING.name,

    @ColumnInfo(name = "created_at")
    val createdAt: String = System.currentTimeMillis().toString(),

    @ColumnInfo(name = "image_uri")
    val imageUri: String? = null
) {
    /**
     * Converts this Room entity to the domain model.
     */
    fun toDomainModel(): FieldTask = FieldTask(
        id = id,
        rawText = rawText,
        intent = intent,
        urgency = urgency,
        skillsNeeded = if (skillsNeeded.isBlank()) emptyList()
                       else skillsNeeded.split(",").map { it.trim() },
        description = description,
        locationLat = locationLat,
        locationLng = locationLng,
        sourceDeviceId = sourceDeviceId,
        syncHops = syncHops,
        syncState = SyncState.valueOf(syncState),
        createdAt = createdAt,
        imageUri = imageUri
    )

    companion object {
        /**
         * Creates a Room entity from the domain model.
         */
        fun fromDomainModel(task: FieldTask): TaskEntity = TaskEntity(
            id = task.id,
            rawText = task.rawText,
            intent = task.intent,
            urgency = task.urgency,
            skillsNeeded = task.skillsNeeded.joinToString(","),
            description = task.description,
            locationLat = task.locationLat,
            locationLng = task.locationLng,
            sourceDeviceId = task.sourceDeviceId,
            syncHops = task.syncHops,
            syncState = task.syncState.name,
            createdAt = task.createdAt,
            imageUri = task.imageUri
        )
    }
}
