"""
======================================================================
SynapseEdge — Telegram Dispatch Service (PHASE 2)
======================================================================

Sends real-time mission dispatch alerts to matched volunteers via
the Telegram Bot API.  Triggered at the tail of the vector-matching
pipeline in tasks.py after pgvector returns the top-K matches.

Integration point:
    tasks.py / ingest_task()
        -> matching_service.find_matches()
        -> dispatch_service.dispatch_to_volunteer()   <-- HERE

Environment:
    TELEGRAM_BOT_TOKEN   — BotFather token
    TELEGRAM_ENABLED     — "true" to send real requests (default: false)
"""

import logging
import httpx
from uuid import UUID
from typing import Optional
from datetime import datetime, timezone

from app.config import get_settings

logger = logging.getLogger(__name__)


class TelegramDispatchService:
    """
    Sends formatted mission dispatch messages to volunteers via Telegram.

    In development mode (TELEGRAM_ENABLED=false), all dispatches are
    logged but not sent, producing a dry-run trace in stdout so judges
    can see the full pipeline without a live bot token.
    """

    URGENCY_EMOJI = {1: "🟢", 2: "🟡", 3: "🟠", 4: "🔴", 5: "🚨"}

    def __init__(self):
        self.settings = get_settings()
        self.token: str = getattr(self.settings, "telegram_bot_token", "")
        self.enabled: bool = bool(self.token and self.token != "MOCK_TOKEN")
        self.base_url = f"https://api.telegram.org/bot{self.token}"

        if self.enabled:
            logger.info("✓ Telegram dispatch LIVE — bot token configured")
        else:
            logger.info("⚠ Telegram dispatch DRY-RUN — no valid bot token")

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def dispatch_to_volunteer(
        self,
        task_id: UUID,
        task_intent: str,
        task_description: str,
        urgency: int,
        skills_needed: list[str],
        volunteer_name: str,
        volunteer_id: UUID,
        similarity_score: float,
        telegram_chat_id: Optional[str] = None,
    ) -> bool:
        """
        Build and send (or dry-run) a mission dispatch message.

        Returns True if the message was delivered or dry-run logged,
        False only on a real HTTP failure.
        """
        urgency_icon = self.URGENCY_EMOJI.get(urgency, "⚪")
        score_pct = f"{similarity_score * 100:.1f}"
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

        message = (
            f"{urgency_icon} *SYNAPSE EDGE — MISSION DISPATCH* {urgency_icon}\n"
            f"{'━' * 32}\n\n"
            f"Hello *{volunteer_name}*,\n"
            f"You have been matched to an urgent field task.\n\n"
            f"📋 *Intent:* `{task_intent}`\n"
            f"⚠️ *Urgency:* {urgency}/5\n"
            f"🎯 *Match Score:* {score_pct}%\n"
            f"🛠 *Skills Required:* {', '.join(skills_needed)}\n\n"
            f"📝 *Description:*\n_{task_description[:300]}_\n\n"
            f"🆔 Task `{str(task_id)[:8]}...`\n"
            f"🕐 {timestamp}\n\n"
            f"Reply /accept to confirm deployment.\n"
            f"Reply /decline to pass."
        )

        # ── Dry-run mode ──────────────────────────────────────────────
        if not self.enabled or not telegram_chat_id:
            logger.info(
                f"[DISPATCH DRY-RUN] Task {str(task_id)[:8]} → "
                f"{volunteer_name} (score={score_pct}%)\n"
                f"--- Telegram Message ---\n{message}\n"
                f"--- End Message ---"
            )
            return True

        # ── Live send ─────────────────────────────────────────────────
        return await self._send_message(telegram_chat_id, message)

    async def send_status_update(
        self,
        telegram_chat_id: str,
        task_id: UUID,
        new_status: str,
    ) -> bool:
        """Send a task status change notification."""
        status_icons = {
            "dispatched": "🚀",
            "resolved": "✅",
            "failed": "❌",
        }
        icon = status_icons.get(new_status, "ℹ️")

        message = (
            f"{icon} *Task Update*\n\n"
            f"Task `{str(task_id)[:8]}...` status changed to "
            f"*{new_status.upper()}*."
        )

        if not self.enabled:
            logger.info(f"[STATUS DRY-RUN] {task_id} → {new_status}")
            return True

        return await self._send_message(telegram_chat_id, message)

    # ------------------------------------------------------------------
    # Private
    # ------------------------------------------------------------------

    async def _send_message(self, chat_id: str, text: str) -> bool:
        """Execute the actual Telegram Bot API POST."""
        payload = {
            "chat_id": chat_id,
            "text": text,
            "parse_mode": "Markdown",
        }
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    f"{self.base_url}/sendMessage", json=payload
                )
                resp.raise_for_status()
                logger.info(f"✓ Telegram message sent to chat {chat_id}")
                return True
        except httpx.HTTPStatusError as e:
            logger.error(
                f"✗ Telegram API error {e.response.status_code}: "
                f"{e.response.text}"
            )
            return False
        except httpx.RequestError as e:
            logger.error(f"✗ Telegram request failed: {e}")
            return False


# ======================================================================
# Module-level singleton
# ======================================================================

_dispatch_service: Optional[TelegramDispatchService] = None


def get_dispatch_service() -> TelegramDispatchService:
    global _dispatch_service
    if _dispatch_service is None:
        _dispatch_service = TelegramDispatchService()
    return _dispatch_service
