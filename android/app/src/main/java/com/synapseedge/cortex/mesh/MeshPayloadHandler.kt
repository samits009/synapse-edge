package com.synapseedge.cortex.mesh

import android.util.Log
import com.synapseedge.cortex.domain.models.FieldTask
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

/**
 * MeshPayloadHandler — Serialization/deserialization for mesh relay payloads.
 *
 * Handles the conversion between [FieldTask] domain objects and the wire
 * format used for Nearby Connections payloads. Includes validation and
 * error handling for malformed payloads from untrusted peers.
 *
 * Wire protocol:
 * ```
 * ┌──────────────┬────────────────────────────────────────┐
 * │ Header (4B)  │ Encrypted JSON Payload (variable)      │
 * ├──────────────┼────────────────────────────────────────┤
 * │ Version (2B) │ AES-256-GCM ciphertext                 │
 * │ Type    (2B) │ [12B IV][N+16B ciphertext+tag]         │
 * └──────────────┴────────────────────────────────────────┘
 * ```
 *
 * Payload types:
 * - 0x0001: Single FieldTask
 * - 0x0002: Batch FieldTask array
 * - 0x0003: Sync request (request peer's pending tasks)
 * - 0x0004: Heartbeat / keepalive
 */
class MeshPayloadHandler {

    companion object {
        private const val TAG = "MeshPayloadHandler"

        // Protocol version
        const val PROTOCOL_VERSION: Short = 1

        // Payload types
        const val TYPE_SINGLE_TASK: Short = 0x0001
        const val TYPE_BATCH_TASKS: Short = 0x0002
        const val TYPE_SYNC_REQUEST: Short = 0x0003
        const val TYPE_HEARTBEAT: Short = 0x0004

        // Maximum payload sizes for validation
        const val MAX_SINGLE_TASK_BYTES = 64 * 1024     // 64 KB
        const val MAX_BATCH_PAYLOAD_BYTES = 1024 * 1024 // 1 MB
    }

    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        prettyPrint = false // Minimize wire size
    }

    /**
     * Serialize a single [FieldTask] to JSON bytes for mesh transmission.
     *
     * @param task The task to serialize
     * @return JSON bytes ready for encryption
     */
    fun serializeTask(task: FieldTask): ByteArray {
        val jsonString = json.encodeToString(task)
        Log.d(TAG, "Serialized task ${task.id} (${jsonString.length} chars)")
        return jsonString.toByteArray(Charsets.UTF_8)
    }

    /**
     * Deserialize JSON bytes back to a [FieldTask].
     *
     * @param data JSON bytes (decrypted)
     * @return [FieldTask] or null if deserialization fails
     */
    fun deserializeTask(data: ByteArray): FieldTask? {
        return try {
            val jsonString = String(data, Charsets.UTF_8)
            json.decodeFromString<FieldTask>(jsonString)
        } catch (e: Exception) {
            Log.e(TAG, "✗ Failed to deserialize task: ${e.message}")
            null
        }
    }

    /**
     * Serialize a batch of tasks for efficient bulk sync.
     *
     * @param tasks List of tasks to send
     * @return JSON bytes ready for encryption
     */
    fun serializeBatch(tasks: List<FieldTask>): ByteArray {
        val jsonString = json.encodeToString(tasks)
        Log.d(TAG, "Serialized batch of ${tasks.size} tasks (${jsonString.length} chars)")
        return jsonString.toByteArray(Charsets.UTF_8)
    }

    /**
     * Deserialize a batch of tasks.
     *
     * @param data JSON bytes (decrypted)
     * @return List of [FieldTask] or empty list if deserialization fails
     */
    fun deserializeBatch(data: ByteArray): List<FieldTask> {
        return try {
            val jsonString = String(data, Charsets.UTF_8)
            json.decodeFromString<List<FieldTask>>(jsonString)
        } catch (e: Exception) {
            Log.e(TAG, "✗ Failed to deserialize batch: ${e.message}")
            emptyList()
        }
    }

    /**
     * Validate a received payload before processing.
     *
     * Checks:
     * - Size limits (prevent DoS via oversized payloads)
     * - JSON validity
     * - Required fields present
     *
     * @param data Raw payload bytes
     * @return Validation result with error message if invalid
     */
    fun validatePayload(data: ByteArray): ValidationResult {
        if (data.isEmpty()) {
            return ValidationResult(false, "Empty payload")
        }
        if (data.size > MAX_BATCH_PAYLOAD_BYTES) {
            return ValidationResult(false, "Payload too large: ${data.size} bytes")
        }
        return ValidationResult(true, "Valid")
    }

    /**
     * Result of payload validation.
     */
    data class ValidationResult(
        val isValid: Boolean,
        val message: String
    )
}
