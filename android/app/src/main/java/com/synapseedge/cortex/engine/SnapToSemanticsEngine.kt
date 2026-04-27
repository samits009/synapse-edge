package com.synapseedge.cortex.engine

import android.content.Context
import android.net.Uri
import android.util.Log
import com.synapseedge.cortex.data.local.AppDatabase
import com.synapseedge.cortex.data.local.entities.TaskEntity
import com.synapseedge.cortex.domain.models.FieldTask
import com.synapseedge.cortex.domain.models.SyncState
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * ══════════════════════════════════════════════════════════════════════════════
 * PILLAR 1: Snap-to-Semantics Engine
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * The core orchestration engine that transforms a photograph of handwritten
 * field notes into structured, actionable JSON data — entirely offline.
 *
 * Pipeline:
 * ```
 * Camera Image → ML Kit Document Scanner → Text Recognition (OCR)
 *     → Gemini Nano (on-device AI) → Structured FieldTask JSON
 *         → Room Database (offline persistence)
 * ```
 *
 * Offline-First Design:
 * - Primary path uses Gemini Nano via Android AICore (fully offline)
 * - Fallback queues raw OCR text for Gemini Pro processing when online
 * - All results are persisted locally in Room before any sync attempt
 *
 * Usage:
 * ```kotlin
 * val engine = SnapToSemanticsEngine(context)
 * val task = engine.processImage(imageUri, deviceId = "device-001")
 * // task is now persisted in Room and ready for mesh/cloud sync
 * ```
 *
 * @param context Android context for database and AI service access
 */
class SnapToSemanticsEngine(private val context: Context) {

    companion object {
        private const val TAG = "SnapToSemanticsEngine"
    }

    private val database = AppDatabase.getInstance(context)
    private val taskDao = database.taskDao()
    private val intentExtractor = IntentExtractor(context)

    /**
     * Main entry point: Process a scanned image into a structured FieldTask.
     *
     * This method orchestrates the full pipeline:
     * 1. Extracts text from the image using ML Kit OCR
     * 2. Passes extracted text to Gemini AI for intent/urgency/skills extraction
     * 3. Constructs a [FieldTask] with all structured fields
     * 4. Persists the task in Room database with [SyncState.PENDING]
     *
     * The method is fully offline-capable when Gemini Nano is available.
     * If AI extraction fails, the raw OCR text is still persisted for
     * later processing.
     *
     * @param imageUri URI of the scanned document image (local file)
     * @param deviceId Unique identifier of the capture device
     * @param latitude GPS latitude at capture time (nullable for indoor capture)
     * @param longitude GPS longitude at capture time (nullable for indoor capture)
     * @return [FieldTask] with structured data, persisted in Room
     * @throws ImageProcessingException if OCR completely fails
     */
    suspend fun processImage(
        imageUri: Uri,
        deviceId: String,
        latitude: Double? = null,
        longitude: Double? = null
    ): FieldTask = withContext(Dispatchers.IO) {
        Log.d(TAG, "━━━ Starting Snap-to-Semantics Pipeline ━━━")
        Log.d(TAG, "Image URI: $imageUri")

        // ── Step 1: OCR Text Extraction ──────────────────────────────────
        // Uses ML Kit Text Recognition to extract raw text from the image.
        // This works fully offline with the bundled on-device model.
        val rawText = extractTextFromImage(imageUri)
        Log.d(TAG, "✓ OCR extracted ${rawText.length} characters")

        if (rawText.isBlank()) {
            Log.w(TAG, "⚠ OCR returned empty text — creating task with blank rawText")
        }

        // ── Step 2: AI Intent Extraction ─────────────────────────────────
        // Attempts on-device Gemini Nano first, falls back to Gemini Pro API.
        // If both fail, creates a task with raw text only (for later processing).
        val extractionResult = try {
            intentExtractor.extractIntent(rawText)
        } catch (e: Exception) {
            Log.e(TAG, "⚠ AI extraction failed, storing raw text for retry: ${e.message}")
            IntentExtractor.ExtractionResult(
                intent = "unprocessed",
                urgency = 3,
                skillsNeeded = emptyList(),
                description = rawText.take(500) // Truncate for embedding readiness
            )
        }
        Log.d(TAG, "✓ AI extracted intent='${extractionResult.intent}' urgency=${extractionResult.urgency}")

        // ── Step 3: Construct FieldTask ──────────────────────────────────
        val task = FieldTask(
            rawText = rawText,
            intent = extractionResult.intent,
            urgency = extractionResult.urgency,
            skillsNeeded = extractionResult.skillsNeeded,
            description = extractionResult.description,
            locationLat = latitude,
            locationLng = longitude,
            sourceDeviceId = deviceId,
            syncState = SyncState.PENDING,
            imageUri = imageUri.toString()
        )

        // ── Step 4: Persist to Room ──────────────────────────────────────
        // This ensures the task survives app restarts and is available for
        // mesh sync even if the app is killed immediately after capture.
        taskDao.insertTask(TaskEntity.fromDomainModel(task))
        Log.d(TAG, "✓ Task ${task.id} persisted to Room [state=PENDING]")
        Log.d(TAG, "━━━ Pipeline Complete ━━━")

        return@withContext task
    }

    /**
     * Reprocess tasks that failed AI extraction.
     *
     * Called when the device comes online and Gemini Pro API is available.
     * Finds all tasks with intent="unprocessed" and re-runs extraction.
     *
     * @return Number of tasks successfully reprocessed
     */
    suspend fun reprocessFailedTasks(): Int = withContext(Dispatchers.IO) {
        val unprocessedTasks = taskDao.getPendingTasks()
            .map { it.toDomainModel() }
            .filter { it.intent == "unprocessed" }

        Log.d(TAG, "Found ${unprocessedTasks.size} unprocessed tasks for retry")

        var successCount = 0
        for (task in unprocessedTasks) {
            try {
                val result = intentExtractor.extractIntent(task.rawText)
                val updatedTask = task.copy(
                    intent = result.intent,
                    urgency = result.urgency,
                    skillsNeeded = result.skillsNeeded,
                    description = result.description
                )
                taskDao.updateTask(TaskEntity.fromDomainModel(updatedTask))
                successCount++
                Log.d(TAG, "✓ Reprocessed task ${task.id}: intent='${result.intent}'")
            } catch (e: Exception) {
                Log.e(TAG, "✗ Failed to reprocess task ${task.id}: ${e.message}")
            }
        }
        return@withContext successCount
    }

    /**
     * Get all tasks currently stored in the local database.
     * Returns a snapshot (non-reactive). Use [TaskDao.observeAllTasks] for
     * reactive observation.
     */
    suspend fun getLocalTasks(): List<FieldTask> = withContext(Dispatchers.IO) {
        taskDao.getPendingTasks().map { it.toDomainModel() }
    }

    // ════════════════════════════════════════════════════════════════════════
    // Private Implementation
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Extracts text from an image using ML Kit Text Recognition.
     *
     * In the production implementation, this uses:
     * ```
     * val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
     * val inputImage = InputImage.fromFilePath(context, imageUri)
     * val result = recognizer.process(inputImage).await()
     * return result.text
     * ```
     *
     * For the prototype, we simulate OCR extraction to allow testing
     * without camera hardware.
     */
    private suspend fun extractTextFromImage(imageUri: Uri): String {
        // ┌──────────────────────────────────────────────────────────────────┐
        // │ PRODUCTION IMPLEMENTATION (uncomment when ML Kit is configured)  │
        // │                                                                  │
        // │ val recognizer = TextRecognition.getClient(                      │
        // │     TextRecognizerOptions.DEFAULT_OPTIONS                        │
        // │ )                                                                │
        // │ val inputImage = InputImage.fromFilePath(context, imageUri)      │
        // │ val visionText = recognizer.process(inputImage).await()          │
        // │ return visionText.text                                           │
        // └──────────────────────────────────────────────────────────────────┘

        // ── Prototype Simulation ────────────────────────────────────────
        // Simulates OCR output for testing the downstream AI pipeline.
        // Replace with actual ML Kit implementation for production.
        Log.d(TAG, "🔬 [PROTOTYPE] Simulating OCR extraction for: $imageUri")

        return """
            Village: Rampur Block C
            Date: March 15
            
            Need immediate medical supplies — 3 children with high fever,
            no clean drinking water since Tuesday. The hand pump broke 
            and we need someone who can fix mechanical pumps. Also need 
            ORS packets and basic antibiotics. Road from district HQ is 
            partially flooded but accessible by heavy vehicle.
            
            Contact: Sanjay Kumar, Village Head
            Phone: works intermittently
            
            Priority: VERY URGENT — children getting worse
        """.trimIndent()
    }
}
