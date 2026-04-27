package com.synapseedge.cortex.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import com.synapseedge.cortex.data.local.entities.TaskEntity

/**
 * Room database for SynapseEdge local offline persistence.
 *
 * This is the offline-first data layer. ALL field tasks are persisted here
 * immediately upon capture, regardless of network/mesh connectivity.
 *
 * The database serves as the single source of truth for:
 * - Tasks captured on this device
 * - Tasks received from mesh peers
 * - Sync state tracking for cloud upload
 *
 * Thread-safe singleton pattern ensures only one database instance exists.
 */
@Database(
    entities = [TaskEntity::class],
    version = 1,
    exportSchema = true
)
abstract class AppDatabase : RoomDatabase() {

    abstract fun taskDao(): TaskDao

    companion object {
        private const val DATABASE_NAME = "synapse_edge_db"

        @Volatile
        private var INSTANCE: AppDatabase? = null

        /**
         * Returns the singleton database instance, creating it if necessary.
         *
         * Uses double-checked locking to ensure thread-safe lazy initialization.
         * [fallbackToDestructiveMigration] is acceptable for hackathon prototype;
         * production would use proper Room migrations.
         */
        fun getInstance(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: buildDatabase(context).also { INSTANCE = it }
            }
        }

        private fun buildDatabase(context: Context): AppDatabase {
            return Room.databaseBuilder(
                context.applicationContext,
                AppDatabase::class.java,
                DATABASE_NAME
            )
                .fallbackToDestructiveMigration()
                .build()
        }
    }
}
