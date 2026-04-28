# 🧠 SynapseEdge — Project Cortex

> Offline-First Semantic Orchestration Engine for Crisis Response

**Google Solution Challenge 2026**

## The Problem
In crisis response, field workers collect unstructured handwritten notes that get lost in translation. Volunteers with matching skills go unmatched because rigid checkbox-based CRMs can't understand implicit needs.

## The Solution
SynapseEdge lets field workers **snap photos of handwritten notes entirely offline**. On-device AI extracts structured intent. Data syncs peer-to-peer via mesh networks until it reaches Wi-Fi. The backend uses **Vector Embeddings** to semantically match unstructured field needs to volunteer capabilities.

## Architecture

| Layer | Stack | Purpose |
|-------|-------|---------|
| **Edge** | Android/Kotlin, CameraX, ML Kit, Gemini Nano | Offline image → structured JSON |
| **Mesh** | Nearby Connections API (P2P_CLUSTER) | Offline peer-to-peer sync |
| **Backend** | Python/FastAPI, Cloud Run, Vertex AI | Embedding generation + vector routing |
| **Database** | Cloud SQL + pgvector | Semantic similarity matching |
| **Dashboard** | Next.js + Firebase | Real-time mission control |

## Quick Start

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Dashboard
```bash
cd dashboard
npm install
npm run dev
```

### Android
Open `android/` in Android Studio and run on emulator/device.

## License
MIT - BUILT FOR GOOGLE SOLUTION CHALLENGE 2026
