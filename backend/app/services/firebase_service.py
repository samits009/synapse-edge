"""
SynapseEdge Backend — Firebase Sync Service

Handles real-time synchronization between the backend and
Firebase Firestore for dashboard updates and mesh node tracking.

This service writes to Firestore collections:
- `mesh_nodes`: Real-time status of offline field devices
- `task_events`: Event stream for dashboard live updates
- `match_events`: Real-time match notifications
"""

import logging
from typing import Optional
from datetime import datetime

logger = logging.getLogger(__name__)


class FirebaseSyncService:
    """
    Firebase Firestore sync service for real-time dashboard updates.

    In production, this uses the Firebase Admin SDK to write to Firestore,
    enabling the Next.js dashboard to receive real-time updates via
    Firestore's onSnapshot listeners.

    Usage:
    ```python
    service = FirebaseSyncService()
    await service.publish_task_event(task_id, "matched", matches)
    await service.update_mesh_node(device_id, status="online")
    ```
    """

    def __init__(self):
        self.db = None
        self._init_firestore()

    def _init_firestore(self):
        """Initialize Firestore client from Firebase Admin SDK."""
        try:
            from firebase_admin import firestore
            self.db = firestore.client()
            logger.info("✓ Firestore client initialized")
        except Exception as e:
            logger.warning(f"⚠ Firestore not available: {e}")
            self.db = None

    async def publish_task_event(
        self,
        task_id: str,
        event_type: str,
        data: Optional[dict] = None
    ):
        """
        Publish a task lifecycle event to Firestore.

        Events are written to the `task_events` collection and
        consumed by the dashboard for real-time UI updates.

        Args:
            task_id: UUID of the task
            event_type: Event type (ingested, matched, dispatched, resolved)
            data: Additional event data
        """
        if not self.db:
            logger.debug(f"[DRY RUN] Task event: {task_id} -> {event_type}")
            return

        event = {
            "task_id": task_id,
            "event_type": event_type,
            "data": data or {},
            "timestamp": datetime.utcnow().isoformat(),
        }

        self.db.collection("task_events").add(event)
        logger.info(f"Published task event: {task_id} -> {event_type}")

    async def update_mesh_node(
        self,
        device_id: str,
        status: str = "online",
        location: Optional[dict] = None,
        peer_count: int = 0,
        task_count: int = 0
    ):
        """
        Update a mesh node's status in Firestore.

        The dashboard uses this to render the real-time mesh network map,
        showing which devices are online, their locations, and how many
        peers they're connected to.

        Args:
            device_id: Unique device identifier
            status: Node status (online, offline, syncing)
            location: GPS coordinates {lat, lng}
            peer_count: Number of connected mesh peers
            task_count: Number of tasks on this device
        """
        if not self.db:
            logger.debug(f"[DRY RUN] Mesh node update: {device_id} -> {status}")
            return

        node_data = {
            "device_id": device_id,
            "status": status,
            "location": location or {},
            "peer_count": peer_count,
            "task_count": task_count,
            "last_seen": datetime.utcnow().isoformat(),
        }

        self.db.collection("mesh_nodes").document(device_id).set(
            node_data, merge=True
        )
        logger.info(f"Updated mesh node: {device_id} -> {status}")

    async def publish_match_notification(
        self,
        task_id: str,
        volunteer_id: str,
        similarity_score: float,
        volunteer_name: str
    ):
        """
        Publish a match notification to Firestore.

        Triggers a real-time notification in the dashboard and can
        be used to send push notifications to the volunteer's device.

        Args:
            task_id: UUID of the matched task
            volunteer_id: UUID of the matched volunteer
            similarity_score: Cosine similarity (0-1)
            volunteer_name: Volunteer's display name
        """
        if not self.db:
            logger.debug(
                f"[DRY RUN] Match notification: {task_id} -> {volunteer_name} "
                f"(score={similarity_score})"
            )
            return

        notification = {
            "task_id": task_id,
            "volunteer_id": volunteer_id,
            "volunteer_name": volunteer_name,
            "similarity_score": similarity_score,
            "status": "proposed",
            "timestamp": datetime.utcnow().isoformat(),
        }

        self.db.collection("match_events").add(notification)
        logger.info(
            f"Match notification: {task_id} -> {volunteer_name} "
            f"(score={similarity_score:.3f})"
        )


# Module-level singleton
_firebase_service: Optional[FirebaseSyncService] = None


def get_firebase_service() -> FirebaseSyncService:
    """Get or create the singleton FirebaseSyncService instance."""
    global _firebase_service
    if _firebase_service is None:
        _firebase_service = FirebaseSyncService()
    return _firebase_service
