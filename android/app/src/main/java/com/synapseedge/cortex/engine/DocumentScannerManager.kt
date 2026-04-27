package com.synapseedge.cortex.engine

import android.app.Activity
import android.net.Uri
import android.util.Log
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.IntentSenderRequest
import com.google.mlkit.vision.documentscanner.GmsDocumentScanning
import com.google.mlkit.vision.documentscanner.GmsDocumentScannerOptions
import com.google.mlkit.vision.documentscanner.GmsDocumentScannerOptions.RESULT_FORMAT_JPEG
import com.google.mlkit.vision.documentscanner.GmsDocumentScannerOptions.SCANNER_MODE_FULL
import com.google.mlkit.vision.documentscanner.GmsDocumentScanningResult

/**
 * DocumentScannerManager — ML Kit Document Scanner API wrapper.
 *
 * Manages the Google ML Kit Document Scanner lifecycle for capturing
 * high-quality scans of handwritten field notes. The scanner provides:
 * - Automatic edge detection and perspective correction
 * - Built-in crop and rotate tools
 * - Multi-page scanning support
 * - JPEG output optimized for OCR
 *
 * This replaces the need for manual CameraX setup — the SDK provides
 * a pre-built, polished scanning UI that handles permissions internally.
 *
 * Integration flow:
 * ```
 * Activity → DocumentScannerManager.launchScanner()
 *     → ML Kit Scanner UI (handles camera, crop, enhance)
 *         → onScanResult callback with JPEG URIs
 *             → SnapToSemanticsEngine.processImage()
 * ```
 *
 * Usage in Activity/Fragment:
 * ```kotlin
 * val scannerManager = DocumentScannerManager()
 *
 * // Register the launcher (in onCreate)
 * val launcher = scannerManager.createLauncher(this) { uris ->
 *     uris.forEach { uri -> engine.processImage(uri, deviceId) }
 * }
 *
 * // Launch scanning (on button click)
 * scannerManager.launchScanner(this, launcher)
 * ```
 */
class DocumentScannerManager {

    companion object {
        private const val TAG = "DocumentScannerManager"
        private const val MAX_PAGES = 10
    }

    /**
     * Scanner options configured for crisis field note capture:
     * - SCANNER_MODE_FULL: Provides the complete scanning UI with all tools
     * - RESULT_FORMAT_JPEG: JPEG output for efficient storage and OCR
     * - Filters enabled: Auto-enhance for better OCR on poor handwriting
     * - Gallery import: Allows processing existing photos
     */
    private val scannerOptions = GmsDocumentScannerOptions.Builder()
        .setScannerMode(SCANNER_MODE_FULL)
        .setGalleryImportAllowed(true)
        .setPageLimit(MAX_PAGES)
        .setResultFormats(RESULT_FORMAT_JPEG)
        .build()

    private val scanner = GmsDocumentScanning.getClient(scannerOptions)

    /**
     * Creates an ActivityResultLauncher for the document scanner.
     *
     * This must be called during Activity/Fragment initialization (onCreate),
     * NOT inside a click handler — Android requires launchers to be registered
     * before the lifecycle reaches STARTED.
     *
     * @param activity The hosting ComponentActivity
     * @param onScanComplete Callback with list of scanned page URIs (JPEG)
     * @return [ActivityResultLauncher] to use with [launchScanner]
     */
    fun createLauncher(
        activity: androidx.activity.ComponentActivity,
        onScanComplete: (List<Uri>) -> Unit
    ): ActivityResultLauncher<IntentSenderRequest> {
        return activity.registerForActivityResult(
            androidx.activity.result.contract.ActivityResultContracts.StartIntentSenderForResult()
        ) { result ->
            if (result.resultCode == Activity.RESULT_OK) {
                val scanningResult = GmsDocumentScanningResult
                    .fromActivityResultIntent(result.data)

                val pageUris = scanningResult?.pages?.map { page ->
                    page.imageUri
                } ?: emptyList()

                Log.d(TAG, "✓ Scan complete: ${pageUris.size} pages captured")
                onScanComplete(pageUris)
            } else {
                Log.w(TAG, "⚠ Scanner cancelled or failed (resultCode=${result.resultCode})")
                onScanComplete(emptyList())
            }
        }
    }

    /**
     * Launches the ML Kit Document Scanner UI.
     *
     * The scanner handles its own camera permissions — no need for the
     * host activity to request CAMERA permission separately.
     *
     * @param activity The hosting Activity
     * @param launcher The launcher created by [createLauncher]
     */
    fun launchScanner(
        activity: Activity,
        launcher: ActivityResultLauncher<IntentSenderRequest>,
        onLaunchFailed: ((Exception) -> Unit)? = null
    ) {
        scanner.getStartScanIntent(activity)
            .addOnSuccessListener { intentSender ->
                Log.d(TAG, "Launching document scanner UI")
                launcher.launch(
                    IntentSenderRequest.Builder(intentSender).build()
                )
            }
            .addOnFailureListener { exception ->
                Log.e(TAG, "✗ Failed to launch scanner: ${exception.message}", exception)
                onLaunchFailed?.invoke(exception)
            }
    }
}
