# ============================================================================
# SynapseEdge Backend — Cloud Run Dockerfile
# ============================================================================
# Production-ready container image for Google Cloud Run deployment.
#
# Build:  docker build -t synapse-edge-backend .
# Run:    docker run -p 8080:8080 synapse-edge-backend
# Deploy: gcloud run deploy synapse-edge --source .
# ============================================================================

# Use an official lightweight Python image
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080

# Set working directory
WORKDIR /app

# Install system dependencies required by asyncpg and cryptography
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        build-essential \
        libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency file first (Docker layer caching optimization)
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose the port Cloud Run will route traffic to
EXPOSE ${PORT}

# Health check for Cloud Run
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/health')" || exit 1

# Start the application with Uvicorn
# - Workers: 1 per Cloud Run instance (Cloud Run handles scaling)
# - Host: 0.0.0.0 required for Cloud Run networking
# - Port: Must match PORT env var
CMD uvicorn app.main:app \
    --host 0.0.0.0 \
    --port ${PORT} \
    --workers 1 \
    --log-level info \
    --access-log
