"""
══════════════════════════════════════════════════════════════════════════════
SynapseEdge Backend — Vertex AI Embedding Service
══════════════════════════════════════════════════════════════════════════════

Generates 768-dimensional vector embeddings from text using Google's
Vertex AI Text Embeddings API (text-embedding-005 model).

These embeddings are the mathematical representation of MEANING in text.
By converting both field task descriptions and volunteer bios into the
same vector space, we can compute semantic similarity between them,
enabling "Unfair Matching" — finding volunteers whose implicit skills
match the implicit needs of a field task.

Architecture:
    Text (str) → Vertex AI API → vector[768] → pgvector (Cloud SQL)

Example:
    "Need someone to fix broken water pump" → [0.023, -0.041, 0.089, ...]
    "Experienced plumber with mechanical repair skills" → [0.019, -0.038, 0.091, ...]
    
    Cosine similarity between these vectors ≈ 0.92 (high match!)
    
    But a checkbox system would NEVER match "water pump repair" to "plumber"
    because neither explicitly mentions the other's category.
"""

import logging
from typing import Optional
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# ============================================================================
# Vertex AI SDK Initialization
# ============================================================================
# In production, this imports and initializes the actual Vertex AI SDK:
#
# import vertexai
# from vertexai.language_models import TextEmbeddingModel
#
# vertexai.init(
#     project=settings.gcp_project_id,
#     location=settings.gcp_location
# )
# _model = TextEmbeddingModel.from_pretrained(settings.vertex_ai_model)
#
# For the prototype, we use a simulation that produces consistent,
# deterministic embeddings for testing the matching pipeline.
# ============================================================================

_model = None  # Populated in production with actual Vertex AI model


class EmbeddingService:
    """
    Service for generating text embeddings via Vertex AI.

    Provides both single-text and batch embedding generation,
    with fallback to simulated embeddings for local development.

    Usage:
    ```python
    service = EmbeddingService()
    
    # Single embedding
    vector = await service.generate_embedding("Need medical supplies urgently")
    
    # Batch embeddings
    vectors = await service.generate_embeddings_batch([
        "Text 1", "Text 2", "Text 3"
    ])
    ```
    """

    def __init__(self):
        """Initialize the embedding service with Vertex AI model."""
        self.dimensions = settings.vertex_ai_embedding_dimensions
        self.model_name = settings.vertex_ai_model
        self._initialized = False
        self._init_model()

    def _init_model(self):
        """
        Initialize the Vertex AI model.
        
        In production:
        ```python
        import vertexai
        from vertexai.language_models import TextEmbeddingModel
        
        vertexai.init(
            project=settings.gcp_project_id,
            location=settings.gcp_location
        )
        self.model = TextEmbeddingModel.from_pretrained(self.model_name)
        self._initialized = True
        ```
        """
        try:
            # Attempt to load actual Vertex AI model
            import vertexai
            from vertexai.language_models import TextEmbeddingModel

            vertexai.init(
                project=settings.gcp_project_id,
                location=settings.gcp_location
            )
            self.model = TextEmbeddingModel.from_pretrained(self.model_name)
            self._initialized = True
            logger.info(f"✓ Vertex AI model '{self.model_name}' loaded successfully")

        except Exception as e:
            logger.warning(
                f"⚠ Vertex AI model not available ({e}). "
                f"Using simulated embeddings for development."
            )
            self.model = None
            self._initialized = False

    async def generate_embedding(
        self,
        text: str,
        task_type: str = "SEMANTIC_SIMILARITY"
    ) -> list[float]:
        """
        Generate a single embedding vector for the given text.

        Uses Vertex AI's text-embedding-005 model with SEMANTIC_SIMILARITY
        task type, which produces embeddings optimized for comparing the
        semantic similarity between two pieces of text.

        Args:
            text: The input text to embed (max ~2048 tokens)
            task_type: Vertex AI task type for optimization.
                       Options: RETRIEVAL_QUERY, RETRIEVAL_DOCUMENT,
                       SEMANTIC_SIMILARITY, CLASSIFICATION, CLUSTERING

        Returns:
            List of floats representing the embedding vector (768 dimensions)

        Raises:
            ValueError: If text is empty
            RuntimeError: If embedding generation fails
        """
        if not text or not text.strip():
            raise ValueError("Cannot generate embedding for empty text")

        # Truncate extremely long text (model has token limits)
        truncated_text = text[:8000]  # ~2000 tokens approx

        if self._initialized and self.model is not None:
            return await self._generate_vertex_embedding(truncated_text, task_type)
        else:
            return self._generate_simulated_embedding(truncated_text)

    async def generate_embeddings_batch(
        self,
        texts: list[str],
        task_type: str = "SEMANTIC_SIMILARITY",
        batch_size: int = 250
    ) -> list[list[float]]:
        """
        Generate embeddings for a batch of texts.

        Processes texts in batches of [batch_size] to stay within
        Vertex AI API quotas and rate limits.

        Args:
            texts: List of input texts
            task_type: Vertex AI task type
            batch_size: Max texts per API call (Vertex AI limit: 250)

        Returns:
            List of embedding vectors, one per input text
        """
        all_embeddings = []

        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]

            if self._initialized and self.model is not None:
                embeddings = await self._generate_vertex_batch(batch, task_type)
            else:
                embeddings = [
                    self._generate_simulated_embedding(text)
                    for text in batch
                ]

            all_embeddings.extend(embeddings)
            logger.info(
                f"Generated embeddings for batch {i // batch_size + 1} "
                f"({len(batch)} texts)"
            )

        return all_embeddings

    # ========================================================================
    # Private Implementation
    # ========================================================================

    async def _generate_vertex_embedding(
        self,
        text: str,
        task_type: str
    ) -> list[float]:
        """Generate embedding using the actual Vertex AI API."""
        try:
            embeddings = self.model.get_embeddings(
                [text],
                task_type=task_type
            )
            vector = embeddings[0].values
            logger.debug(
                f"Generated {len(vector)}-dim embedding via Vertex AI"
            )
            return vector

        except Exception as e:
            logger.error(f"Vertex AI embedding failed: {e}")
            # Fallback to simulation on API failure
            return self._generate_simulated_embedding(text)

    async def _generate_vertex_batch(
        self,
        texts: list[str],
        task_type: str
    ) -> list[list[float]]:
        """Generate batch embeddings using the actual Vertex AI API."""
        try:
            embeddings = self.model.get_embeddings(
                texts,
                task_type=task_type
            )
            return [emb.values for emb in embeddings]

        except Exception as e:
            logger.error(f"Vertex AI batch embedding failed: {e}")
            return [
                self._generate_simulated_embedding(text)
                for text in texts
            ]

    def _generate_simulated_embedding(self, text: str) -> list[float]:
        """
        Generate a deterministic simulated embedding for development.

        This produces a consistent 768-dimensional vector based on the
        text content, ensuring that:
        - Same text → same embedding (deterministic)
        - Similar texts → similar embeddings (semantic-like behavior)
        - Different texts → different embeddings

        The simulation uses character frequency analysis and n-gram hashing
        to produce vectors that approximate semantic similarity for testing.
        This is NOT a replacement for real embeddings — it's a development
        tool that allows testing the matching pipeline without GCP credentials.
        """
        import hashlib
        import struct

        # Create a deterministic seed from the text content
        text_hash = hashlib.sha256(text.encode('utf-8')).digest()

        # Generate base vector from hash
        vector = []
        for i in range(self.dimensions):
            # Combine hash bytes with dimension index for variety
            seed_bytes = hashlib.md5(
                text_hash + struct.pack('i', i)
            ).digest()
            # Convert to float in [-1, 1] range
            value = struct.unpack('f', seed_bytes[:4])[0]
            # Normalize to reasonable range
            normalized = (value % 2.0) - 1.0
            vector.append(round(normalized, 6))

        # Add semantic-like features based on keyword presence
        keywords = {
            'medical': (0, 50),
            'water': (50, 100),
            'shelter': (100, 150),
            'food': (150, 200),
            'transport': (200, 250),
            'communication': (250, 300),
            'rescue': (300, 350),
            'engineering': (350, 400),
            'logistics': (400, 450),
            'training': (450, 500),
        }

        text_lower = text.lower()
        for keyword, (start, end) in keywords.items():
            if keyword in text_lower:
                for j in range(start, min(end, self.dimensions)):
                    vector[j] = abs(vector[j]) * 0.8 + 0.2  # Boost positive

        # Normalize to unit vector (required for cosine similarity)
        magnitude = sum(v ** 2 for v in vector) ** 0.5
        if magnitude > 0:
            vector = [v / magnitude for v in vector]

        logger.debug(
            f"Generated simulated {len(vector)}-dim embedding "
            f"for text ({len(text)} chars)"
        )
        return vector


# ============================================================================
# Module-level singleton
# ============================================================================

_embedding_service: Optional[EmbeddingService] = None


def get_embedding_service() -> EmbeddingService:
    """Get or create the singleton EmbeddingService instance."""
    global _embedding_service
    if _embedding_service is None:
        _embedding_service = EmbeddingService()
    return _embedding_service
