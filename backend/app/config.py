"""
SynapseEdge Backend — Configuration Module

Centralized configuration management using Pydantic Settings.
All configuration is loaded from environment variables and .env files,
following the 12-factor app methodology.

Environment variables take precedence over .env file values.
"""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.

    Priority order:
    1. Environment variables (highest)
    2. .env file
    3. Default values (lowest)
    """

    # ── Google Cloud Platform ─────────────────────────────────────────────
    gcp_project_id: str = "synapse-edge-demo"
    gcp_location: str = "us-central1"

    # ── Vertex AI ─────────────────────────────────────────────────────────
    vertex_ai_model: str = "text-embedding-005"
    vertex_ai_embedding_dimensions: int = 768

    # ── Database ──────────────────────────────────────────────────────────
    database_url: str = "postgresql+asyncpg://postgres:password@localhost:5432/synapse_edge"

    # ── Firebase ──────────────────────────────────────────────────────────
    firebase_credentials_path: str = "./firebase-service-account.json"

    # ── API Server ────────────────────────────────────────────────────────
    api_host: str = "0.0.0.0"
    api_port: int = 8080
    cors_origins: str = "http://localhost:3000,https://synapse-edge.web.app"

    # ── Vector Matching ───────────────────────────────────────────────────
    default_match_limit: int = 5
    similarity_threshold: float = 0.5

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse comma-separated CORS origins into a list."""
        return [origin.strip() for origin in self.cors_origins.split(",")]


@lru_cache()
def get_settings() -> Settings:
    """
    Cached settings singleton.
    
    Uses @lru_cache to ensure settings are loaded only once,
    then reused across the application lifecycle.
    """
    return Settings()
