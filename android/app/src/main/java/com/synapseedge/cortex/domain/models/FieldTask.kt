package com.synapseedge.cortex.domain.models

import kotlinx.serialization.Serializable
import java.util.UUID

/**
 * FieldTask — Core domain model for SynapseEdge.
 *
 * Represents a structured task extracted from a handwritten field note via the
 * Snap-to-Semantics engine. This is the atomic unit of data that flows through
 * the entire system: captured on-device → synced via mesh → routed on backend.
 *
 * The AI extraction pipeline populates [intent], [urgency], [skillsNeeded],
 * and [description] from raw OCR text. These fields power the semantic vector
 * matching on the backend.
 */
@Serializable
data class FieldTask(
    /** Globally unique ID generated on-device. Survives mesh relay hops. */
    val id: String = UUID.randomUUID().toString(),

    /** Raw OCR text extracted by ML Kit from the handwritten note image. */
    val rawText: String,

    /**
     * AI-extracted intent category.
     * Examples: "medical_supply_request", "shelter_construction",
     * "water_purification", "evacuation_transport", "food_distribution"
     */
    val intent: String? = null,

    /**
     * AI-assessed urgency on a 1-5 scale.
     * 1 = Low (routine), 2 = Moderate, 3 = High,
     * 4 = Critical, 5 = Life-threatening / Immediate
     */
    val urgency: Int = 3,

    /**
     * AI-extracted implicit skills needed to fulfill this task.
     * These are inferred from context, not explicitly stated.
     * Example: "Need someone to fix the water pump" → ["plumbing", "mechanical_repair", "water_systems"]
     */
    val skillsNeeded: List<String> = emptyList(),

    /**
     * AI-generated natural language summary optimized for embedding.
     * This is the text that gets vectorized by Vertex AI on the backend.
     */
    val description: String? = null,

    /** GPS latitude at capture time (-90 to 90) */
    val locationLat: Double? = null,

    /** GPS longitude at capture time (-180 to 180) */
    val locationLng: Double? = null,

    /** Device ID of the originating capture device */
    val sourceDeviceId: String? = null,

    /** Number of mesh relay hops this task has traversed */
    val syncHops: Int = 0,

    /** Current synchronization state in the mesh/cloud pipeline */
    val syncState: SyncState = SyncState.PENDING,

    /** ISO 8601 timestamp of task creation */
    val createdAt: String = System.currentTimeMillis().toString(),

    /** URI of the original scanned image (local file path) */
    val imageUri: String? = null
)

/**
 * Synchronization state machine for a FieldTask.
 *
 * State transitions:
 * ```
 * PENDING → MESH_SYNCED → CLOUD_SYNCED → MATCHED → DISPATCHED → RESOLVED
 *                                                              ↘ FAILED
 * ```
 */
@Serializable
enum class SyncState {
    /** Created locally, not yet synced to any peer */
    PENDING,

    /** Successfully relayed to at least one mesh peer */
    MESH_SYNCED,

    /** Uploaded to Firebase/Cloud backend */
    CLOUD_SYNCED,

    /** Backend has found volunteer matches */
    MATCHED,

    /** A volunteer has been dispatched */
    DISPATCHED,

    /** Task has been resolved/completed */
    RESOLVED,

    /** Sync or processing failed (retryable) */
    FAILED
}
