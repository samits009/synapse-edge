package com.synapseedge.cortex.mesh

import android.content.Context
import android.util.Log
import com.google.android.gms.nearby.Nearby
import com.google.android.gms.nearby.connection.*
import com.synapseedge.cortex.data.local.AppDatabase
import com.synapseedge.cortex.data.local.entities.TaskEntity
import com.synapseedge.cortex.domain.models.FieldTask
import com.synapseedge.cortex.domain.models.SyncState
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

/**
 * ══════════════════════════════════════════════════════════════════════════════
 * PILLAR 2: Offline Mesh Relay — MeshSyncManager
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Manages peer-to-peer mesh networking via Google Nearby Connections API
 * for offline synchronization of encrypted field task data between devices.
 *
 * Architecture:
 * ```
 * ┌──────────────┐     P2P_CLUSTER     ┌──────────────┐
 * │  Device A    │◄──────────────────►  │  Device B    │
 * │  (Advertise  │     AES-256-GCM     │  (Advertise  │
 * │   + Discover)│   Encrypted JSON    │   + Discover) │
 * └──────┬───────┘                     └──────┬───────┘
 *        │                                    │
 *        ▼                                    ▼
 * ┌──────────────┐                     ┌──────────────┐
 * │  Room DB     │                     │  Room DB     │
 * │  (Local)     │                     │  (Local)     │
 * └──────────────┘                     └──────────────┘
 * ```
 *
 * Key design decisions:
 * - **P2P_CLUSTER strategy**: Enables M-to-N mesh topology where every device
 *   can simultaneously advertise AND discover, forming an organic mesh network.
 * - **AES-256-GCM encryption**: All payloads are encrypted before transmission.
 *   Even if someone intercepts the Nearby Connections traffic, the task data
 *   (which may contain sensitive crisis information) remains confidential.
 * - **UUID deduplication**: Tasks carry globally unique IDs generated on-device.
 *   When a task arrives that already exists in Room, we skip it (idempotent).
 * - **Hop counting**: Each relay increments the hop counter, providing network
 *   topology insight to the backend (how far did data travel to reach Wi-Fi?).
 *
 * Lifecycle:
 * ```
 * startMesh() → startAdvertising() + startDiscovery()
 *     → onConnectionInitiated() → acceptConnection()
 *         → onConnectionResult(SUCCESS) → syncTasks()
 *             → sendPayload(encrypted JSON) ↔ receivePayload(encrypted JSON)
 * stopMesh() → stopAdvertising() + stopDiscovery() + disconnectAll()
 * ```
 *
 * @param context Android context
 * @param deviceId Unique identifier for this device
 * @param encryptionKey Pre-shared key for AES-256-GCM (derived from org credentials)
 */
class MeshSyncManager(
    private val context: Context,
    private val deviceId: String,
    private val encryptionKey: String = "synapse-edge-default-psk-32char!" // 32-char key for AES-256
) {
    companion object {
        private const val TAG = "MeshSyncManager"

        /**
         * Service ID must be unique to our app and match on all devices.
         * Using reverse-domain notation for uniqueness.
         */
        private const val SERVICE_ID = "com.synapseedge.cortex.mesh"

        /** P2P_CLUSTER enables M-to-N mesh topology */
        private val STRATEGY = Strategy.P2P_CLUSTER

        /** How often to attempt task sync with connected peers (ms) */
        private const val SYNC_INTERVAL_MS = 10_000L
    }

    // ════════════════════════════════════════════════════════════════════════
    // State
    // ════════════════════════════════════════════════════════════════════════

    private val connectionsClient: ConnectionsClient = Nearby.getConnectionsClient(context)
    private val database = AppDatabase.getInstance(context)
    private val taskDao = database.taskDao()
    private val encryption = EncryptionUtils(encryptionKey)
    private val json = Json { ignoreUnknownKeys = true; isLenient = true }
    private val coroutineScope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    /** Currently connected peer endpoint IDs */
    private val connectedPeers = mutableSetOf<String>()

    /** Periodic sync job handle */
    private var syncJob: Job? = null

    /** Observable mesh state for UI */
    private val _meshState = MutableStateFlow(MeshState())
    val meshState: StateFlow<MeshState> = _meshState.asStateFlow()

    // ════════════════════════════════════════════════════════════════════════
    // Public API
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Start the mesh network — begin advertising and discovering simultaneously.
     *
     * This makes the device visible to nearby peers and starts scanning for
     * other SynapseEdge devices. Connections are established automatically
     * when peers are discovered.
     *
     * Call this when the app enters the foreground or when the user explicitly
     * enables mesh sync.
     */
    fun startMesh() {
        Log.d(TAG, "━━━ Starting Mesh Network ━━━")
        Log.d(TAG, "Device ID: $deviceId")
        Log.d(TAG, "Strategy: P2P_CLUSTER (M-to-N)")

        startAdvertising()
        startDiscovery()
        startPeriodicSync()

        _meshState.value = _meshState.value.copy(isActive = true)
        Log.d(TAG, "✓ Mesh network active — advertising + discovering")
    }

    /**
     * Stop the mesh network — disconnect all peers and stop advertising/discovery.
     *
     * Call this when the app goes to background or user disables mesh sync.
     * All established connections are gracefully terminated.
     */
    fun stopMesh() {
        Log.d(TAG, "━━━ Stopping Mesh Network ━━━")

        syncJob?.cancel()
        connectionsClient.stopAdvertising()
        connectionsClient.stopDiscovery()
        connectionsClient.stopAllEndpoints()
        connectedPeers.clear()

        _meshState.value = MeshState(isActive = false)
        Log.d(TAG, "✓ Mesh network stopped")
    }

    /**
     * Manually trigger a sync with all connected peers.
     *
     * Sends all pending/unsynchronized tasks to every connected peer.
     * This is called automatically on a periodic schedule, but can also
     * be triggered manually (e.g., by the user pressing a "Sync Now" button).
     *
     * @return Number of tasks sent
     */
    suspend fun syncNow(): Int {
        val unsyncedTasks = taskDao.getPendingTasks().map { it.toDomainModel() }
        if (unsyncedTasks.isEmpty()) {
            Log.d(TAG, "No pending tasks to sync")
            return 0
        }

        Log.d(TAG, "Syncing ${unsyncedTasks.size} tasks to ${connectedPeers.size} peers")

        var sentCount = 0
        for (endpointId in connectedPeers.toSet()) {
            for (task in unsyncedTasks) {
                try {
                    sendTaskToPeer(endpointId, task)
                    sentCount++
                } catch (e: Exception) {
                    Log.e(TAG, "✗ Failed to send task ${task.id} to $endpointId: ${e.message}")
                }
            }
        }

        // Update sync state for sent tasks
        if (sentCount > 0 && connectedPeers.isNotEmpty()) {
            val taskIds = unsyncedTasks.map { it.id }
            taskDao.batchUpdateSyncState(taskIds, SyncState.MESH_SYNCED.name)
            _meshState.value = _meshState.value.copy(
                tasksSent = _meshState.value.tasksSent + sentCount
            )
        }

        Log.d(TAG, "✓ Sync complete: $sentCount payloads sent")
        return sentCount
    }

    /**
     * Get the current number of connected mesh peers.
     */
    fun getPeerCount(): Int = connectedPeers.size

    // ════════════════════════════════════════════════════════════════════════
    // Nearby Connections — Advertising
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Start advertising this device to nearby peers.
     *
     * Advertising makes this device discoverable by other SynapseEdge
     * devices running startDiscovery(). Uses the device ID as the
     * human-readable endpoint name.
     */
    private fun startAdvertising() {
        val advertisingOptions = AdvertisingOptions.Builder()
            .setStrategy(STRATEGY)
            .build()

        connectionsClient.startAdvertising(
            deviceId,            // Local endpoint name (visible to discoverers)
            SERVICE_ID,          // Must match on all devices
            connectionLifecycleCallback,
            advertisingOptions
        ).addOnSuccessListener {
            Log.d(TAG, "✓ Advertising started as '$deviceId'")
        }.addOnFailureListener { e ->
            Log.e(TAG, "✗ Advertising failed: ${e.message}")
        }
    }

    // ════════════════════════════════════════════════════════════════════════
    // Nearby Connections — Discovery
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Start discovering nearby advertising devices.
     *
     * When a peer is found, [endpointDiscoveryCallback] fires and we
     * automatically request a connection.
     */
    private fun startDiscovery() {
        val discoveryOptions = DiscoveryOptions.Builder()
            .setStrategy(STRATEGY)
            .build()

        connectionsClient.startDiscovery(
            SERVICE_ID,
            endpointDiscoveryCallback,
            discoveryOptions
        ).addOnSuccessListener {
            Log.d(TAG, "✓ Discovery started")
        }.addOnFailureListener { e ->
            Log.e(TAG, "✗ Discovery failed: ${e.message}")
        }
    }

    /**
     * Callback fired when a nearby advertising endpoint is found or lost.
     *
     * On discovery, we immediately request a connection. In P2P_CLUSTER,
     * this is safe because both sides can accept multiple connections.
     */
    private val endpointDiscoveryCallback = object : EndpointDiscoveryCallback() {
        override fun onEndpointFound(endpointId: String, info: DiscoveredEndpointInfo) {
            Log.d(TAG, "🔍 Discovered peer: ${info.endpointName} ($endpointId)")
            Log.d(TAG, "   Service ID: ${info.serviceId}")

            // Auto-connect to discovered SynapseEdge peers
            connectionsClient.requestConnection(
                deviceId,       // Our endpoint name
                endpointId,     // The discovered peer
                connectionLifecycleCallback
            ).addOnSuccessListener {
                Log.d(TAG, "→ Connection requested to ${info.endpointName}")
            }.addOnFailureListener { e ->
                Log.e(TAG, "✗ Connection request failed: ${e.message}")
            }
        }

        override fun onEndpointLost(endpointId: String) {
            Log.d(TAG, "📡 Lost endpoint: $endpointId")
        }
    }

    // ════════════════════════════════════════════════════════════════════════
    // Nearby Connections — Connection Lifecycle
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Manages the full connection lifecycle:
     * 1. onConnectionInitiated → Accept (auto-accept in mesh mode)
     * 2. onConnectionResult → Track connected peer, trigger initial sync
     * 3. onDisconnected → Remove from peer set
     */
    private val connectionLifecycleCallback = object : ConnectionLifecycleCallback() {

        /**
         * A connection has been initiated by a peer.
         *
         * In production, you'd verify the authentication token here.
         * For the prototype, we auto-accept all SynapseEdge connections.
         */
        override fun onConnectionInitiated(endpointId: String, info: ConnectionInfo) {
            Log.d(TAG, "🤝 Connection initiated with: ${info.endpointName}")
            Log.d(TAG, "   Auth token: ${info.authenticationDigits}")

            // Auto-accept connection and register payload listener
            connectionsClient.acceptConnection(endpointId, payloadCallback)
                .addOnSuccessListener {
                    Log.d(TAG, "✓ Accepted connection from ${info.endpointName}")
                }
                .addOnFailureListener { e ->
                    Log.e(TAG, "✗ Failed to accept connection: ${e.message}")
                }
        }

        /**
         * Connection established (or failed).
         * On success, add to peer set and trigger an immediate sync.
         */
        override fun onConnectionResult(endpointId: String, result: ConnectionResolution) {
            when (result.status.statusCode) {
                ConnectionsStatusCodes.STATUS_OK -> {
                    Log.d(TAG, "✓ Connected to peer: $endpointId")
                    connectedPeers.add(endpointId)

                    _meshState.value = _meshState.value.copy(
                        connectedPeers = connectedPeers.size
                    )

                    // Trigger immediate sync with newly connected peer
                    coroutineScope.launch {
                        syncWithPeer(endpointId)
                    }
                }
                ConnectionsStatusCodes.STATUS_CONNECTION_REJECTED -> {
                    Log.w(TAG, "⚠ Connection rejected by peer: $endpointId")
                }
                else -> {
                    Log.e(TAG, "✗ Connection failed: ${result.status}")
                }
            }
        }

        /**
         * A peer has disconnected.
         */
        override fun onDisconnected(endpointId: String) {
            Log.d(TAG, "📴 Peer disconnected: $endpointId")
            connectedPeers.remove(endpointId)

            _meshState.value = _meshState.value.copy(
                connectedPeers = connectedPeers.size
            )
        }
    }

    // ════════════════════════════════════════════════════════════════════════
    // Payload Handling — Send & Receive Encrypted Tasks
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Callback for receiving payloads from connected peers.
     *
     * Incoming payloads are:
     * 1. Decrypted from AES-256-GCM
     * 2. Deserialized from JSON to [FieldTask]
     * 3. Deduplicated (skip if UUID already exists in Room)
     * 4. Persisted to Room with incremented hop count
     */
    private val payloadCallback = object : PayloadCallback() {

        override fun onPayloadReceived(endpointId: String, payload: Payload) {
            if (payload.type != Payload.Type.BYTES) {
                Log.w(TAG, "⚠ Ignoring non-bytes payload from $endpointId")
                return
            }

            val encryptedBytes = payload.asBytes() ?: return
            Log.d(TAG, "📥 Received ${encryptedBytes.size} bytes from $endpointId")

            coroutineScope.launch {
                try {
                    // Decrypt the payload
                    val decryptedJson = encryption.decrypt(encryptedBytes)
                    Log.d(TAG, "✓ Decrypted payload (${decryptedJson.length} chars)")

                    // Deserialize to FieldTask
                    val task = json.decodeFromString<FieldTask>(decryptedJson)

                    // Deduplication check
                    if (taskDao.taskExists(task.id) > 0) {
                        Log.d(TAG, "⏭ Task ${task.id} already exists, skipping (dedup)")
                        return@launch
                    }

                    // Persist with incremented hop count
                    val relayedTask = task.copy(
                        syncHops = task.syncHops + 1,
                        syncState = SyncState.MESH_SYNCED
                    )
                    taskDao.insertTask(TaskEntity.fromDomainModel(relayedTask))

                    _meshState.value = _meshState.value.copy(
                        tasksReceived = _meshState.value.tasksReceived + 1
                    )

                    Log.d(TAG, "✓ Stored relayed task ${task.id} (hop #${relayedTask.syncHops})")

                } catch (e: Exception) {
                    Log.e(TAG, "✗ Failed to process payload from $endpointId: ${e.message}", e)
                }
            }
        }

        override fun onPayloadTransferUpdate(endpointId: String, update: PayloadTransferUpdate) {
            // Log transfer progress for large payloads
            when (update.status) {
                PayloadTransferUpdate.Status.SUCCESS ->
                    Log.d(TAG, "✓ Payload transfer complete to/from $endpointId")
                PayloadTransferUpdate.Status.FAILURE ->
                    Log.e(TAG, "✗ Payload transfer failed to/from $endpointId")
                PayloadTransferUpdate.Status.IN_PROGRESS ->
                    { /* Silently track progress */ }
            }
        }
    }

    /**
     * Send a single encrypted task payload to a specific peer.
     *
     * @param endpointId The Nearby Connections endpoint ID of the peer
     * @param task The [FieldTask] to send
     */
    private fun sendTaskToPeer(endpointId: String, task: FieldTask) {
        // Serialize to JSON
        val taskJson = json.encodeToString(task)

        // Encrypt with AES-256-GCM
        val encryptedBytes = encryption.encrypt(taskJson)

        // Send as bytes payload
        val payload = Payload.fromBytes(encryptedBytes)
        connectionsClient.sendPayload(endpointId, payload)
            .addOnSuccessListener {
                Log.d(TAG, "📤 Sent task ${task.id} to $endpointId (${encryptedBytes.size} bytes)")
            }
            .addOnFailureListener { e ->
                Log.e(TAG, "✗ Failed to send task ${task.id}: ${e.message}")
            }
    }

    /**
     * Sync all pending tasks with a specific peer.
     * Called when a new connection is established.
     */
    private suspend fun syncWithPeer(endpointId: String) {
        val pendingTasks = taskDao.getPendingTasks().map { it.toDomainModel() }
        Log.d(TAG, "Syncing ${pendingTasks.size} pending tasks with peer $endpointId")

        for (task in pendingTasks) {
            try {
                sendTaskToPeer(endpointId, task)
            } catch (e: Exception) {
                Log.e(TAG, "✗ Sync failed for task ${task.id}: ${e.message}")
            }
        }
    }

    // ════════════════════════════════════════════════════════════════════════
    // Periodic Sync
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Start periodic sync job that broadcasts pending tasks to all peers.
     * Runs every [SYNC_INTERVAL_MS] milliseconds.
     */
    private fun startPeriodicSync() {
        syncJob?.cancel()
        syncJob = coroutineScope.launch {
            while (isActive) {
                delay(SYNC_INTERVAL_MS)
                if (connectedPeers.isNotEmpty()) {
                    try {
                        syncNow()
                    } catch (e: Exception) {
                        Log.e(TAG, "Periodic sync failed: ${e.message}")
                    }
                }
            }
        }
    }

    // ════════════════════════════════════════════════════════════════════════
    // State Model
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Observable state of the mesh network for UI binding.
     */
    data class MeshState(
        /** Whether the mesh network is currently active */
        val isActive: Boolean = false,
        /** Number of currently connected peers */
        val connectedPeers: Int = 0,
        /** Total tasks sent since mesh started */
        val tasksSent: Int = 0,
        /** Total tasks received from peers since mesh started */
        val tasksReceived: Int = 0
    )
}
