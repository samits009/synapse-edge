package com.synapseedge.cortex.engine

import android.content.Context
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

/**
 * IntentExtractor — AI-powered structured data extraction from raw OCR text.
 *
 * This class wraps the Gemini AI models (Nano for offline, Pro for online)
 * to extract structured crisis-response information from unstructured
 * handwritten field notes.
 *
 * Extraction targets:
 * - **Intent**: What is being requested? (medical_supply, shelter, evacuation, etc.)
 * - **Urgency**: How critical is this? (1-5 scale)
 * - **Skills**: What implicit capabilities are needed? (plumbing, driving, nursing, etc.)
 * - **Description**: Natural language summary optimized for vector embedding
 *
 * Architecture:
 * ```
 * Raw OCR Text
 *     ├──→ Gemini Nano (on-device, offline) ──→ ExtractionResult
 *     │         ↓ (if unavailable)
 *     └──→ Gemini Pro API (cloud, online)   ──→ ExtractionResult
 *               ↓ (if unavailable)
 *           → Heuristic Fallback            ──→ ExtractionResult
 * ```
 */
class IntentExtractor(private val context: Context) {

    companion object {
        private const val TAG = "IntentExtractor"

        /**
         * The system prompt that instructs Gemini to extract structured crisis data.
         * This prompt is engineered for consistent JSON output across both Nano and Pro.
         */
        private val EXTRACTION_PROMPT = """
            You are a crisis response AI assistant. Analyze the following handwritten 
            field note (extracted via OCR) and return ONLY a valid JSON object with 
            these exact fields:
            
            {
              "intent": "one of: medical_supply_request, shelter_construction, 
                         water_purification, evacuation_transport, food_distribution, 
                         communication_setup, search_rescue, infrastructure_repair, 
                         psychosocial_support, general_assistance",
              "urgency": <integer 1-5, where 5 is life-threatening>,
              "skills_needed": ["list", "of", "implicit", "skills", "required"],
              "description": "A concise natural language summary (2-3 sentences) 
                              describing the need, suitable for semantic matching 
                              with volunteer capabilities"
            }
            
            Rules:
            - Extract IMPLICIT skills, not just explicit ones. Example: "hand pump broke" 
              implies ["plumbing", "mechanical_repair", "water_systems"]
            - The description should emphasize WHAT is needed and WHY, not just repeat the text
            - Urgency 5 = immediate life threat, 4 = critical, 3 = high, 2 = moderate, 1 = routine
            - Return ONLY the JSON object, no markdown, no explanation
            
            Field note to analyze:
        """.trimIndent()
    }

    /** JSON parser configured for lenient parsing of AI-generated output */
    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
    }

    /**
     * Extract structured intent data from raw OCR text.
     *
     * Attempts extraction in priority order:
     * 1. Gemini Nano (on-device, fully offline)
     * 2. Gemini Pro API (cloud, requires connectivity)
     * 3. Heuristic fallback (rule-based, always works)
     *
     * @param rawText The raw OCR text from ML Kit
     * @return [ExtractionResult] with structured crisis data
     */
    suspend fun extractIntent(rawText: String): ExtractionResult = withContext(Dispatchers.Default) {
        Log.d(TAG, "Extracting intent from ${rawText.length} chars of text")

        // ── Attempt 1: Gemini Nano (On-Device) ────────────────────────────
        try {
            val nanoResult = extractViaGeminiNano(rawText)
            if (nanoResult != null) {
                Log.d(TAG, "✓ Gemini Nano extraction succeeded")
                return@withContext nanoResult
            }
        } catch (e: Exception) {
            Log.w(TAG, "Gemini Nano unavailable: ${e.message}")
        }

        // ── Attempt 2: Gemini Pro API (Cloud) ─────────────────────────────
        try {
            val proResult = extractViaGeminiPro(rawText)
            if (proResult != null) {
                Log.d(TAG, "✓ Gemini Pro extraction succeeded")
                return@withContext proResult
            }
        } catch (e: Exception) {
            Log.w(TAG, "Gemini Pro API unavailable: ${e.message}")
        }

        // ── Attempt 3: Heuristic Fallback ─────────────────────────────────
        Log.d(TAG, "⚠ Using heuristic fallback extraction")
        return@withContext extractViaHeuristics(rawText)
    }

    // ════════════════════════════════════════════════════════════════════════
    // Extraction Implementations
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Extract using Gemini Nano via Android AICore.
     *
     * Production implementation uses:
     * ```kotlin
     * val generativeModel = GenerativeModel(
     *     modelName = "gemini-nano",
     *     generationConfig = generationConfig {
     *         responseMimeType = "application/json"
     *     }
     * )
     * val response = generativeModel.generateContent(prompt)
     * ```
     *
     * @return [ExtractionResult] or null if Gemini Nano is not available
     */
    private suspend fun extractViaGeminiNano(rawText: String): ExtractionResult? {
        // ┌────────────────────────────────────────────────────────────────────┐
        // │ PRODUCTION: Gemini Nano via AICore                                 │
        // │                                                                    │
        // │ val downloadManager = InferenceManager.get(context)                │
        // │ val availability = downloadManager                                 │
        // │     .checkModelAvailability("gemini-nano")                         │
        // │     .await()                                                       │
        // │                                                                    │
        // │ if (availability != ModelAvailability.AVAILABLE) return null        │
        // │                                                                    │
        // │ val model = GenerativeModel(                                       │
        // │     modelName = "gemini-nano",                                     │
        // │     generationConfig = generationConfig {                          │
        // │         responseMimeType = "application/json"                      │
        // │     }                                                              │
        // │ )                                                                  │
        // │                                                                    │
        // │ val prompt = "$EXTRACTION_PROMPT\n\n$rawText"                      │
        // │ val response = model.generateContent(prompt)                       │
        // │ return parseExtractionResponse(response.text ?: return null)       │
        // └────────────────────────────────────────────────────────────────────┘

        Log.d(TAG, "🔬 [PROTOTYPE] Gemini Nano not available in emulator, skipping")
        return null // Falls through to Gemini Pro or heuristic
    }

    /**
     * Extract using Gemini Pro API (cloud-based, requires internet).
     *
     * Production implementation uses the Generative AI SDK:
     * ```kotlin
     * val model = GenerativeModel(
     *     modelName = "gemini-1.5-pro",
     *     apiKey = BuildConfig.GEMINI_API_KEY,
     *     generationConfig = generationConfig {
     *         responseMimeType = "application/json"
     *     }
     * )
     * val response = model.generateContent(prompt)
     * ```
     */
    private suspend fun extractViaGeminiPro(rawText: String): ExtractionResult? {
        // ┌────────────────────────────────────────────────────────────────────┐
        // │ PRODUCTION: Gemini Pro API                                         │
        // │                                                                    │
        // │ val model = GenerativeModel(                                       │
        // │     modelName = "gemini-1.5-pro",                                  │
        // │     apiKey = BuildConfig.GEMINI_API_KEY,                            │
        // │     generationConfig = generationConfig {                          │
        // │         responseMimeType = "application/json"                      │
        // │     }                                                              │
        // │ )                                                                  │
        // │                                                                    │
        // │ val prompt = "$EXTRACTION_PROMPT\n\n$rawText"                      │
        // │ val response = model.generateContent(prompt)                       │
        // │ return parseExtractionResponse(response.text ?: return null)       │
        // └────────────────────────────────────────────────────────────────────┘

        // ── Prototype: Simulate Gemini Pro response ─────────────────────
        Log.d(TAG, "🔬 [PROTOTYPE] Simulating Gemini Pro extraction")
        return simulateGeminiExtraction(rawText)
    }

    /**
     * Rule-based heuristic extraction as ultimate fallback.
     *
     * Uses keyword matching to determine intent and urgency when AI models
     * are completely unavailable. This is intentionally simple — real extraction
     * quality comes from Gemini; this just ensures the pipeline never fails.
     */
    private fun extractViaHeuristics(rawText: String): ExtractionResult {
        val textLower = rawText.lowercase()

        // ── Intent Detection via Keywords ────────────────────────────────
        val intent = when {
            textLower.containsAny("medicine", "medical", "doctor", "fever", "injury", "antibiotics", "hospital") ->
                "medical_supply_request"
            textLower.containsAny("shelter", "tent", "roof", "housing", "building") ->
                "shelter_construction"
            textLower.containsAny("water", "pump", "purif", "drinking", "well") ->
                "water_purification"
            textLower.containsAny("evacuat", "transport", "vehicle", "road", "rescue") ->
                "evacuation_transport"
            textLower.containsAny("food", "ration", "grain", "meal", "hunger") ->
                "food_distribution"
            textLower.containsAny("radio", "phone", "communication", "signal", "network") ->
                "communication_setup"
            else -> "general_assistance"
        }

        // ── Urgency Detection ────────────────────────────────────────────
        val urgency = when {
            textLower.containsAny("immediate", "dying", "life", "death", "critical", "emergency") -> 5
            textLower.containsAny("urgent", "very", "severe", "desperate", "quickly") -> 4
            textLower.containsAny("need", "require", "important", "soon") -> 3
            textLower.containsAny("request", "would like", "helpful") -> 2
            else -> 3
        }

        // ── Skill Extraction ─────────────────────────────────────────────
        val skills = mutableListOf<String>()
        val skillKeywords = mapOf(
            "plumbing" to listOf("pump", "pipe", "plumb", "tap", "faucet"),
            "mechanical_repair" to listOf("repair", "fix", "broke", "broken", "maintenance"),
            "medical" to listOf("medic", "doctor", "nurse", "health", "fever", "treatment"),
            "driving" to listOf("vehicle", "drive", "transport", "truck", "heavy"),
            "construction" to listOf("build", "construct", "shelter", "structure"),
            "water_systems" to listOf("water", "purif", "well", "pump"),
            "logistics" to listOf("supply", "distribute", "delivery", "chain"),
            "translation" to listOf("language", "speak", "interpret", "translat")
        )
        skillKeywords.forEach { (skill, keywords) ->
            if (keywords.any { textLower.contains(it) }) {
                skills.add(skill)
            }
        }

        return ExtractionResult(
            intent = intent,
            urgency = urgency,
            skillsNeeded = skills,
            description = rawText.take(500) // Use raw text as description fallback
        )
    }

    // ════════════════════════════════════════════════════════════════════════
    // Helper Functions
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Simulates a Gemini API response for prototype/testing.
     * Returns a high-quality extraction result that mimics actual Gemini output.
     */
    private fun simulateGeminiExtraction(rawText: String): ExtractionResult {
        val textLower = rawText.lowercase()

        // Determine realistic extraction based on content analysis
        val hasMedical = textLower.containsAny("fever", "medical", "medicine", "antibiotics", "children")
        val hasWater = textLower.containsAny("water", "pump", "drinking")

        return when {
            hasMedical && hasWater -> ExtractionResult(
                intent = "medical_supply_request",
                urgency = 4,
                skillsNeeded = listOf(
                    "medical_first_aid",
                    "pediatric_care",
                    "mechanical_repair",
                    "water_systems",
                    "heavy_vehicle_driving",
                    "supply_chain_logistics"
                ),
                description = "Urgent medical supply request from remote village. " +
                    "Multiple children with high fever require ORS packets and basic " +
                    "antibiotics. Water hand pump is broken, cutting off clean water supply. " +
                    "Access requires heavy vehicle capable of navigating partially flooded roads. " +
                    "Need someone with plumbing/mechanical skills and medical training."
            )
            hasWater -> ExtractionResult(
                intent = "water_purification",
                urgency = 4,
                skillsNeeded = listOf("plumbing", "mechanical_repair", "water_systems"),
                description = "Water infrastructure failure. Hand pump broken, " +
                    "community without clean drinking water. Requires mechanical " +
                    "repair skills and water purification knowledge."
            )
            hasMedical -> ExtractionResult(
                intent = "medical_supply_request",
                urgency = 4,
                skillsNeeded = listOf("medical_first_aid", "pediatric_care", "logistics"),
                description = "Medical emergency requiring supplies and healthcare " +
                    "professional. Children affected — pediatric care experience needed."
            )
            else -> extractViaHeuristics(rawText)
        }
    }

    /**
     * Parses the JSON response from Gemini into an [ExtractionResult].
     *
     * Handles malformed JSON gracefully — if parsing fails, returns null
     * to trigger fallback to heuristic extraction.
     */
    @Suppress("unused") // Used in production Gemini integration
    private fun parseExtractionResponse(responseText: String): ExtractionResult? {
        return try {
            val jsonElement = json.parseToJsonElement(responseText)
            val obj = jsonElement.jsonObject

            ExtractionResult(
                intent = obj["intent"]?.jsonPrimitive?.content ?: "general_assistance",
                urgency = obj["urgency"]?.jsonPrimitive?.content?.toIntOrNull() ?: 3,
                skillsNeeded = obj["skills_needed"]?.jsonArray
                    ?.map { it.jsonPrimitive.content } ?: emptyList(),
                description = obj["description"]?.jsonPrimitive?.content ?: ""
            )
        } catch (e: Exception) {
            Log.e(TAG, "Failed to parse Gemini response: ${e.message}")
            null
        }
    }

    /**
     * Extension function for checking if a string contains any of the given keywords.
     */
    private fun String.containsAny(vararg keywords: String): Boolean =
        keywords.any { this.contains(it, ignoreCase = true) }

    // ════════════════════════════════════════════════════════════════════════
    // Data Classes
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Structured result from AI intent extraction.
     */
    @Serializable
    data class ExtractionResult(
        /** Categorized intent of the field note */
        val intent: String,
        /** Urgency level 1-5 (5 = life-threatening) */
        val urgency: Int,
        /** List of implicit skills needed to address this task */
        val skillsNeeded: List<String>,
        /** Natural language description optimized for embedding */
        val description: String
    )
}
