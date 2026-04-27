package com.synapseedge.cortex.ui

import android.content.Context
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.IntentSenderRequest
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.CloudDone
import androidx.compose.material.icons.filled.DoneAll
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material.icons.filled.Hub
import androidx.compose.material.icons.filled.Pending
import androidx.compose.material.icons.filled.Psychology
import androidx.compose.material.icons.filled.Send
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.synapseedge.cortex.data.local.AppDatabase
import com.synapseedge.cortex.data.remote.FirebaseSyncService
import com.synapseedge.cortex.domain.models.FieldTask
import com.synapseedge.cortex.domain.models.SyncState
import com.synapseedge.cortex.domain.repository.TaskRepository
import com.synapseedge.cortex.engine.DocumentScannerManager
import com.synapseedge.cortex.engine.SnapToSemanticsEngine
import kotlinx.coroutines.launch
import java.util.UUID

/**
 * ======================================================================
 * SynapseEdge — Field Scout UI
 * ======================================================================
 *
 * Offline-first capture interface for field scouts:
 *
 *   1. Launch the ML Kit document scanner
 *   2. Convert the scanned note into structured JSON with Snap-to-Semantics
 *   3. Persist locally in Room
 *   4. Upload to Firebase when connectivity is available
 *
 * The scanner UI handles capture permissions internally, so the app keeps
 * the main screen focused on task creation, sync visibility, and fallback
 * messaging for offline / low-connectivity field use.
 */

// ── Design Tokens ─────────────────────────────────────────────────────

object CortexColors {
    val Background = Color(0xFF030712)
    val Surface = Color(0xFF0F172A)
    val Card = Color(0xFF1E293B)
    val Border = Color(0xFF334155)
    val TextPrimary = Color(0xFFE2E8F0)
    val TextSecondary = Color(0xFF94A3B8)
    val TextMuted = Color(0xFF64748B)
    val Emerald = Color(0xFF10B981)
    val EmeraldDark = Color(0xFF022C22)
    val Blue = Color(0xFF3B82F6)
    val Amber = Color(0xFFF59E0B)
    val Violet = Color(0xFF8B5CF6)
    val Red = Color(0xFFEF4444)
    val Slate = Color(0xFF64748B)
}

// ── Data ──────────────────────────────────────────────────────────────

data class CapturedNote(
    val task: FieldTask,
    val uploadState: MutableState<SyncState>,
    val timestampMs: Long = System.currentTimeMillis()
) {
    val id: String get() = task.id
    val preview: String
        get() = task.description?.takeIf { it.isNotBlank() }
            ?: task.rawText.take(120)
    val intent: String get() = task.intent ?: "general_assistance"
    val urgency: Int get() = task.urgency
    val syncHops: Int get() = task.syncHops
}

// ── Entry Point ───────────────────────────────────────────────────────

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme(
                colorScheme = darkColorScheme(
                    background = CortexColors.Background,
                    surface = CortexColors.Surface,
                    primary = CortexColors.Emerald,
                )
            ) {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = CortexColors.Background
                ) {
                    FieldScoutApp()
                }
            }
        }
    }
}

// ── App Shell ─────────────────────────────────────────────────────────

@Composable
fun FieldScoutApp() {
    val activity = LocalContext.current as ComponentActivity
    val scope = rememberCoroutineScope()
    val notes = remember { mutableStateListOf<CapturedNote>() }
    val scannerManager = remember { DocumentScannerManager() }
    val engine = remember { SnapToSemanticsEngine(activity) }
    val firebaseSyncService = remember { FirebaseSyncService() }
    val taskRepository = remember { TaskRepository(AppDatabase.getInstance(activity)) }

    var currentScreen by remember { mutableStateOf("capture") }
    var isProcessing by remember { mutableStateOf(false) }
    var statusMessage by remember { mutableStateOf("Ready to scan a field note.") }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    val deviceId = remember {
        Settings.Secure.getString(activity.contentResolver, Settings.Secure.ANDROID_ID)
            ?: Build.MODEL
    }

    val handleScannedDocuments = { uris: List<Uri> ->
        scope.launch {
            if (uris.isEmpty()) {
                isProcessing = false
                statusMessage = "Scanner closed without capturing a document."
                return@launch
            }

            errorMessage = null
            statusMessage = "Processing ${uris.size} scanned page(s)..."

            try {
                uris.forEachIndexed { index, uri ->
                    statusMessage = "Extracting structured JSON from page ${index + 1}..."
                    val task = engine.processImage(
                        imageUri = uri,
                        deviceId = deviceId,
                        latitude = null,
                        longitude = null
                    )

                    val note = CapturedNote(
                        task = task,
                        uploadState = mutableStateOf(task.syncState)
                    )
                    notes.add(0, note)

                    statusMessage = "Uploading ${task.id.take(8)} to Firebase..."
                    val uploaded = firebaseSyncService.syncTask(task)

                    if (uploaded) {
                        taskRepository.updateSyncState(task.id, SyncState.CLOUD_SYNCED)
                        note.uploadState.value = SyncState.CLOUD_SYNCED
                        statusMessage = "Task ${task.id.take(8)} synced to Firebase."
                        Toast.makeText(activity, "Task synced: ${task.intent ?: "field note"}", Toast.LENGTH_SHORT).show()
                    } else {
                        note.uploadState.value = SyncState.PENDING
                        statusMessage = "Saved locally; cloud sync will retry when connectivity returns."
                        errorMessage = "Firebase upload failed for ${task.id.take(8)}"
                        Toast.makeText(activity, "Saved locally — cloud sync pending", Toast.LENGTH_SHORT).show()
                    }
                }
            } catch (e: Exception) {
                errorMessage = e.message ?: "Failed to process scanned document."
                statusMessage = "Capture processing failed."
            } finally {
                isProcessing = false
            }
        }
    }

    val onScanComplete by rememberUpdatedState(newValue = handleScannedDocuments)
    val scannerLauncher = remember(activity) {
        scannerManager.createLauncher(activity) { uris ->
            onScanComplete(uris)
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(top = 12.dp)
    ) {
        AppHeader(
            noteCount = notes.size,
            syncedCount = notes.count { it.uploadState.value == SyncState.CLOUD_SYNCED }
        )

        when (currentScreen) {
            "capture" -> CaptureScreen(
                noteCount = notes.size,
                isProcessing = isProcessing,
                statusMessage = statusMessage,
                errorMessage = errorMessage,
                onCapture = {
                    if (isProcessing) return@CaptureScreen
                    isProcessing = true
                    statusMessage = "Opening ML Kit document scanner..."
                    scannerManager.launchScanner(
                        activity = activity,
                        launcher = scannerLauncher
                    ) { exception ->
                        isProcessing = false
                        errorMessage = exception.message ?: "Document scanner failed to launch."
                        statusMessage = "Scanner unavailable."
                    }
                },
                onViewStatus = { currentScreen = "status" }
            )

            "status" -> StatusScreen(
                notes = notes,
                onBack = { currentScreen = "capture" }
            )
        }
    }
}

// ── Header ────────────────────────────────────────────────────────────

@Composable
fun AppHeader(noteCount: Int, syncedCount: Int) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp, vertical = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Column {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(8.dp)
                        .clip(CircleShape)
                        .background(CortexColors.Emerald)
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    "SYNAPSE",
                    color = Color.White,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp
                )
                Text(
                    "EDGE",
                    color = CortexColors.Emerald,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp
                )
            }
            Text(
                "FIELD SCOUT // OFFLINE-READY",
                color = CortexColors.TextMuted,
                fontFamily = FontFamily.Monospace,
                fontSize = 10.sp,
                letterSpacing = 2.sp
            )
        }

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Surface(
                color = CortexColors.Emerald.copy(alpha = 0.1f),
                shape = RoundedCornerShape(6.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, CortexColors.Emerald.copy(0.2f))
            ) {
                Text(
                    "LOCAL: $noteCount",
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 5.dp),
                    color = CortexColors.Emerald,
                    fontFamily = FontFamily.Monospace,
                    fontSize = 9.sp
                )
            }

            Surface(
                color = CortexColors.Blue.copy(alpha = 0.1f),
                shape = RoundedCornerShape(6.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, CortexColors.Blue.copy(0.2f))
            ) {
                Text(
                    "CLOUD: $syncedCount",
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 5.dp),
                    color = CortexColors.Blue,
                    fontFamily = FontFamily.Monospace,
                    fontSize = 9.sp
                )
            }
        }
    }
}

// ── Screen 1: Capture ─────────────────────────────────────────────────

@Composable
fun CaptureScreen(
    noteCount: Int,
    isProcessing: Boolean,
    statusMessage: String,
    errorMessage: String?,
    onCapture: () -> Unit,
    onViewStatus: () -> Unit
) {
    Column(modifier = Modifier.fillMaxSize()) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp)
                .height(240.dp)
                .clip(RoundedCornerShape(16.dp))
                .background(Color.Black)
                .border(
                    width = 1.dp,
                    brush = Brush.linearGradient(
                        listOf(
                            CortexColors.Border,
                            CortexColors.Emerald.copy(0.3f),
                            CortexColors.Border
                        )
                    ),
                    shape = RoundedCornerShape(16.dp)
                )
                .padding(18.dp)
        ) {
            Column(
                modifier = Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.SpaceBetween
            ) {
                Column {
                    Text(
                        "OFFLINE-FIRST CAPTURE PIPELINE",
                        color = CortexColors.Emerald,
                        fontFamily = FontFamily.Monospace,
                        fontSize = 11.sp,
                        letterSpacing = 2.sp
                    )
                    Spacer(Modifier.height(12.dp))
                    Text(
                        "Scan a handwritten paper form and convert it into structured JSON.",
                        color = CortexColors.TextPrimary,
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        lineHeight = 24.sp
                    )
                }

                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    PipelineLine("1. ML Kit document scanner captures the note")
                    PipelineLine("2. Snap-to-Semantics extracts intent, urgency, and skills")
                    PipelineLine("3. Room persists locally, then Firebase sync uploads when online")
                    PipelineLine("4. Heuristic fallback keeps the flow working if Gemini Nano is unavailable")
                }
            }
        }

        Spacer(Modifier.height(16.dp))

        if (errorMessage != null) {
            Surface(
                modifier = Modifier
                    .padding(horizontal = 20.dp)
                    .fillMaxWidth(),
                color = CortexColors.Red.copy(alpha = 0.1f),
                shape = RoundedCornerShape(12.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, CortexColors.Red.copy(0.2f))
            ) {
                Text(
                    errorMessage,
                    modifier = Modifier.padding(12.dp),
                    color = CortexColors.Red,
                    fontFamily = FontFamily.Monospace,
                    fontSize = 11.sp
                )
            }

            Spacer(Modifier.height(10.dp))
        }

        Surface(
            modifier = Modifier
                .padding(horizontal = 20.dp)
                .fillMaxWidth(),
            color = CortexColors.Slate.copy(alpha = 0.08f),
            shape = RoundedCornerShape(12.dp),
            border = androidx.compose.foundation.BorderStroke(1.dp, CortexColors.Border.copy(0.4f))
        ) {
            Text(
                statusMessage,
                modifier = Modifier.padding(12.dp),
                color = CortexColors.TextSecondary,
                fontFamily = FontFamily.Monospace,
                fontSize = 11.sp
            )
        }

        Spacer(Modifier.height(16.dp))

        Button(
            onClick = onCapture,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp)
                .height(54.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = CortexColors.Emerald,
                disabledContainerColor = CortexColors.Emerald.copy(0.3f)
            ),
            shape = RoundedCornerShape(12.dp),
            enabled = !isProcessing
        ) {
            if (isProcessing) {
                CircularProgressIndicator(
                    Modifier.size(20.dp),
                    color = CortexColors.EmeraldDark,
                    strokeWidth = 2.dp
                )
                Spacer(Modifier.width(12.dp))
            }
            Text(
                if (isProcessing) "SCANNING & EXTRACTING..." else "OPEN DOCUMENT SCANNER",
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold,
                fontSize = 13.sp,
                color = CortexColors.EmeraldDark,
                letterSpacing = 1.sp
            )
        }

        Spacer(Modifier.height(12.dp))

        OutlinedButton(
            onClick = onViewStatus,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp)
                .height(44.dp),
            colors = ButtonDefaults.outlinedButtonColors(contentColor = CortexColors.TextSecondary),
            border = androidx.compose.foundation.BorderStroke(1.dp, CortexColors.Border),
            shape = RoundedCornerShape(12.dp)
        ) {
            Text(
                "VIEW SYNC STATUS • $noteCount NOTES",
                fontFamily = FontFamily.Monospace,
                fontSize = 12.sp,
                letterSpacing = 1.sp
            )
        }
    }
}

@Composable
private fun PipelineLine(text: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(
            modifier = Modifier
                .size(6.dp)
                .clip(CircleShape)
                .background(CortexColors.Emerald)
        )
        Spacer(Modifier.width(10.dp))
        Text(
            text,
            color = CortexColors.TextSecondary,
            fontFamily = FontFamily.Monospace,
            fontSize = 11.sp,
            lineHeight = 14.sp
        )
    }
}

// ── Screen 2: Sync Status ─────────────────────────────────────────────

@Composable
fun StatusScreen(
    notes: List<CapturedNote>,
    onBack: () -> Unit
) {
    Column(modifier = Modifier.fillMaxSize()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            TextButton(onClick = onBack) {
                Text(
                    "CAPTURE",
                    color = CortexColors.TextSecondary,
                    fontFamily = FontFamily.Monospace,
                    fontSize = 11.sp
                )
            }

            Text(
                "SYNC QUEUE",
                color = CortexColors.TextMuted,
                fontFamily = FontFamily.Monospace,
                fontSize = 11.sp,
                letterSpacing = 2.sp
            )

            Text(
                "${notes.size} TASKS",
                color = CortexColors.Emerald.copy(0.7f),
                fontFamily = FontFamily.Monospace,
                fontSize = 10.sp
            )
        }

        if (notes.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(40.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        "No field notes captured yet",
                        color = CortexColors.TextMuted,
                        fontFamily = FontFamily.Monospace,
                        fontSize = 12.sp
                    )
                    Text(
                        "Go back and capture your first report",
                        color = CortexColors.TextMuted.copy(alpha = 0.5f),
                        fontFamily = FontFamily.Monospace,
                        fontSize = 10.sp,
                        modifier = Modifier.padding(top = 4.dp)
                    )
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
                contentPadding = PaddingValues(bottom = 24.dp)
            ) {
                items(notes, key = { it.id }) { note ->
                    SyncTaskCard(note)
                }
            }
        }
    }
}

// ── Sync Card ─────────────────────────────────────────────────────────

@Composable
fun SyncTaskCard(note: CapturedNote) {
    val state = note.uploadState.value
    val presentation = state.presentation()

    val animatedColor by animateColorAsState(
        targetValue = presentation.color,
        animationSpec = tween(600, easing = FastOutSlowInEasing),
        label = "stateColor"
    )

    Card(
        colors = CardDefaults.cardColors(containerColor = CortexColors.Card),
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(animatedColor.copy(0.1f)),
                contentAlignment = Alignment.Center
            ) {
                presentation.icon()
            }

            Spacer(Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        note.id.take(8).uppercase(),
                        color = Color.White,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 13.sp
                    )
                    Spacer(Modifier.width(8.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                        repeat(5) { i ->
                            Box(
                                modifier = Modifier
                                    .size(if (i < note.urgency) 6.dp else 4.dp)
                                    .clip(CircleShape)
                                    .background(
                                        if (i < note.urgency) {
                                            when {
                                                note.urgency >= 4 -> CortexColors.Red
                                                note.urgency == 3 -> CortexColors.Amber
                                                else -> CortexColors.Emerald
                                            }
                                        } else {
                                            CortexColors.Border
                                        }
                                    )
                            )
                        }
                    }
                }

                Text(
                    note.preview,
                    color = CortexColors.TextSecondary,
                    fontSize = 11.sp,
                    maxLines = 1,
                    modifier = Modifier.padding(top = 2.dp)
                )

                Text(
                    "INTENT: ${note.intent.replace('_', ' ').uppercase()}",
                    color = CortexColors.TextMuted,
                    fontFamily = FontFamily.Monospace,
                    fontSize = 9.sp,
                    modifier = Modifier.padding(top = 3.dp)
                )
            }

            Surface(
                color = animatedColor.copy(0.1f),
                shape = RoundedCornerShape(6.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, animatedColor.copy(0.25f))
            ) {
                Text(
                    presentation.label.uppercase(),
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                    color = animatedColor,
                    fontFamily = FontFamily.Monospace,
                    fontSize = 9.sp,
                    letterSpacing = 0.5.sp
                )
            }
        }
    }
}

private data class SyncPresentation(
    val label: String,
    val color: Color,
    val icon: @Composable () -> Unit
)

private fun SyncState.presentation(): SyncPresentation {
    return when (this) {
        SyncState.PENDING -> SyncPresentation(
            label = "Awaiting Sync",
            color = CortexColors.Amber,
            icon = { androidx.compose.material3.Icon(Icons.Default.Pending, null, tint = CortexColors.Amber, modifier = Modifier.size(18.dp)) }
        )

        SyncState.MESH_SYNCED -> SyncPresentation(
            label = "Mesh Relay",
            color = CortexColors.Violet,
            icon = { androidx.compose.material3.Icon(Icons.Default.Hub, null, tint = CortexColors.Violet, modifier = Modifier.size(18.dp)) }
        )

        SyncState.CLOUD_SYNCED -> SyncPresentation(
            label = "Cloud Synced",
            color = CortexColors.Emerald,
            icon = { androidx.compose.material3.Icon(Icons.Default.CloudDone, null, tint = CortexColors.Emerald, modifier = Modifier.size(18.dp)) }
        )

        SyncState.MATCHED -> SyncPresentation(
            label = "Matched",
            color = CortexColors.Blue,
            icon = { androidx.compose.material3.Icon(Icons.Default.CheckCircle, null, tint = CortexColors.Blue, modifier = Modifier.size(18.dp)) }
        )

        SyncState.DISPATCHED -> SyncPresentation(
            label = "Dispatched",
            color = CortexColors.Emerald,
            icon = { androidx.compose.material3.Icon(Icons.Default.Send, null, tint = CortexColors.Emerald, modifier = Modifier.size(18.dp)) }
        )

        SyncState.RESOLVED -> SyncPresentation(
            label = "Resolved",
            color = CortexColors.Slate,
            icon = { androidx.compose.material3.Icon(Icons.Default.DoneAll, null, tint = CortexColors.Slate, modifier = Modifier.size(18.dp)) }
        )

        SyncState.FAILED -> SyncPresentation(
            label = "Sync Failed",
            color = CortexColors.Red,
            icon = { androidx.compose.material3.Icon(Icons.Default.ErrorOutline, null, tint = CortexColors.Red, modifier = Modifier.size(18.dp)) }
        )
    }
}
