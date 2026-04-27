"""
══════════════════════════════════════════════════════════════════════════════
SynapseEdge Backend — Vector Matching Service (pgvector)
══════════════════════════════════════════════════════════════════════════════

The semantic matching engine that finds the best volunteer matches for
incoming field tasks using pgvector's cosine similarity search.

This is the "Unfair Match" engine — named because it can match needs to
capabilities that no human-designed category system would ever connect.

Example of an "Unfair Match":
    Task: "Children sick, hand pump broken, flooded road to district HQ"
    Match: "Marcus Chen — logistics coordinator, drone pilot, HAM radio operator,
            can repair generators and solar panels"

    A checkbox system would NEVER match these. But the vector embeddings
    capture the semantic overlap: logistics → supply delivery, drone →
    aerial reconnaissance of flooded road, generator repair → mechanical
    aptitude for pump repair.

    Cosine similarity: 0.78 — strong semantic match!

Architecture:
    Task embedding → pgvector <=> operator → Top-K volunteers by similarity
"""

import logging
import math
from uuid import UUID
from typing import Optional
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.embedding_service import get_embedding_service
from app.models.task import TaskMatchResult

logger = logging.getLogger(__name__)


class MatchingService:
    """
    Semantic vector matching engine using pgvector.

    Performs cosine similarity search over volunteer embeddings to find
    the best matches for a given task's embedding vector.

    The <=> operator in pgvector computes COSINE DISTANCE (0 = identical,
    2 = opposite). We convert to COSINE SIMILARITY (1 = identical, -1 = opposite)
    using: similarity = 1 - distance.

    Usage:
    ```python
    service = MatchingService()
    
    # Find top 5 volunteer matches for a task
    matches = await service.find_matches(
        db_session,
        task_embedding=[0.1, 0.2, ...],  # 768-dim vector
        limit=5,
        threshold=0.5
    )
    ```
    """

    def __init__(self):
        self.embedding_service = get_embedding_service()

    async def find_matches(
        self,
        db: AsyncSession,
        task_embedding: list[float],
        limit: int = 5,
        threshold: float = 0.3,
        task_location: Optional[tuple[float, float]] = None,
        only_available: bool = True
    ) -> list[TaskMatchResult]:
        """
        Find the top-K volunteer matches for a task embedding.

        Uses pgvector's HNSW index for approximate nearest neighbor search,
        achieving sub-millisecond query times even with 100K+ volunteers.

        The query:
        ```sql
        SELECT *, 1 - (embedding <=> :query_vector) AS similarity
        FROM volunteers
        WHERE availability = true
          AND 1 - (embedding <=> :query_vector) >= :threshold
        ORDER BY similarity DESC
        LIMIT :limit
        ```

        Args:
            db: Async database session
            task_embedding: The task's 768-dim embedding vector
            limit: Maximum number of matches to return
            threshold: Minimum cosine similarity (0-1) to qualify as a match
            task_location: Optional (lat, lng) for distance calculation
            only_available: If True, only match available volunteers

        Returns:
            List of TaskMatchResult ordered by similarity (highest first)
        """
        # Convert embedding to pgvector format: '[0.1, 0.2, ...]'
        vector_str = "[" + ",".join(str(v) for v in task_embedding) + "]"

        # Build the SQL query with pgvector cosine similarity
        availability_filter = "AND availability = true" if only_available else ""

        query = text(f"""
            SELECT 
                id,
                name,
                bio,
                skills_raw,
                location_lat,
                location_lng,
                1 - (embedding <=> :query_vector::vector) AS similarity
            FROM volunteers
            WHERE embedding IS NOT NULL
              {availability_filter}
              AND 1 - (embedding <=> :query_vector::vector) >= :threshold
            ORDER BY similarity DESC
            LIMIT :limit
        """)

        result = await db.execute(
            query,
            {
                "query_vector": vector_str,
                "threshold": threshold,
                "limit": limit,
            }
        )

        rows = result.fetchall()
        logger.info(
            f"Found {len(rows)} volunteer matches "
            f"(threshold={threshold}, limit={limit})"
        )

        matches = []
        for row in rows:
            # Calculate geographic distance if both locations are available
            distance_km = None
            if task_location and row.location_lat and row.location_lng:
                distance_km = self._haversine_distance(
                    task_location[0], task_location[1],
                    row.location_lat, row.location_lng
                )

            # Parse skills_raw from PostgreSQL array
            skills = row.skills_raw if row.skills_raw else []

            matches.append(TaskMatchResult(
                volunteer_id=row.id,
                volunteer_name=row.name,
                volunteer_bio=row.bio,
                volunteer_skills=skills,
                similarity_score=round(float(row.similarity), 4),
                distance_km=round(distance_km, 2) if distance_km else None,
            ))

        return matches

    async def embed_and_store_task(
        self,
        db: AsyncSession,
        task_id: UUID,
        description: str
    ) -> list[float]:
        """
        Generate embedding for a task and store it in the database.

        Args:
            db: Async database session
            task_id: UUID of the task to update
            description: Text to embed (AI-generated task description)

        Returns:
            The generated embedding vector
        """
        # Generate embedding via Vertex AI
        embedding = await self.embedding_service.generate_embedding(
            description,
            task_type="SEMANTIC_SIMILARITY"
        )

        # Store in database
        vector_str = "[" + ",".join(str(v) for v in embedding) + "]"
        query = text("""
            UPDATE field_tasks 
            SET embedding = :embedding::vector
            WHERE id = :task_id
        """)

        await db.execute(query, {
            "embedding": vector_str,
            "task_id": str(task_id),
        })
        await db.commit()

        logger.info(f"Stored embedding for task {task_id} ({len(embedding)} dims)")
        return embedding

    async def embed_and_store_volunteer(
        self,
        db: AsyncSession,
        volunteer_id: UUID,
        bio: str
    ) -> list[float]:
        """
        Generate embedding for a volunteer's bio and store it.

        The bio embedding captures the volunteer's LATENT capabilities —
        skills that are implied but not explicitly categorized.

        Args:
            db: Async database session
            volunteer_id: UUID of the volunteer
            bio: The volunteer's unstructured bio text

        Returns:
            The generated embedding vector
        """
        embedding = await self.embedding_service.generate_embedding(
            bio,
            task_type="SEMANTIC_SIMILARITY"
        )

        vector_str = "[" + ",".join(str(v) for v in embedding) + "]"
        query = text("""
            UPDATE volunteers 
            SET embedding = :embedding::vector,
                updated_at = NOW()
            WHERE id = :volunteer_id
        """)

        await db.execute(query, {
            "embedding": vector_str,
            "volunteer_id": str(volunteer_id),
        })
        await db.commit()

        logger.info(f"Stored embedding for volunteer {volunteer_id}")
        return embedding

    async def save_matches(
        self,
        db: AsyncSession,
        task_id: UUID,
        matches: list[TaskMatchResult]
    ) -> None:
        """
        Persist match results to the task_matches junction table.

        Args:
            db: Async database session
            task_id: UUID of the matched task
            matches: List of match results to persist
        """
        for match in matches:
            query = text("""
                INSERT INTO task_matches (task_id, volunteer_id, similarity_score, status)
                VALUES (:task_id, :volunteer_id, :similarity_score, 'proposed')
                ON CONFLICT (task_id, volunteer_id) DO UPDATE 
                SET similarity_score = :similarity_score
            """)

            await db.execute(query, {
                "task_id": str(task_id),
                "volunteer_id": str(match.volunteer_id),
                "similarity_score": match.similarity_score,
            })

        await db.commit()
        logger.info(f"Saved {len(matches)} matches for task {task_id}")

    # ========================================================================
    # Utility Functions
    # ========================================================================

    @staticmethod
    def _haversine_distance(
        lat1: float, lng1: float,
        lat2: float, lng2: float
    ) -> float:
        """
        Calculate the great-circle distance between two GPS coordinates.

        Uses the Haversine formula for accurate distance on a sphere.

        Args:
            lat1, lng1: First point (task location)
            lat2, lng2: Second point (volunteer location)

        Returns:
            Distance in kilometers
        """
        R = 6371  # Earth's radius in kilometers

        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lng = math.radians(lng2 - lng1)

        a = (
            math.sin(delta_lat / 2) ** 2
            + math.cos(lat1_rad) * math.cos(lat2_rad)
            * math.sin(delta_lng / 2) ** 2
        )
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

        return R * c


# ============================================================================
# Module-level singleton
# ============================================================================

_matching_service: Optional[MatchingService] = None


def get_matching_service() -> MatchingService:
    """Get or create the singleton MatchingService instance."""
    global _matching_service
    if _matching_service is None:
        _matching_service = MatchingService()
    return _matching_service
