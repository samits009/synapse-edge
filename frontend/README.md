# SynapseEdge — AI-Powered Disaster Response Command Center

> Real-time tactical command center for orchestrating volunteer responses to crisis field reports using Google Gemini AI and Firebase.

---

## Features

- **AI Volunteer Matching** — Gemini 1.5 Pro parses unstructured crisis text and semantically matches volunteers by skill set
- **Real-Time Tactical Map** — Leaflet-powered map with live pulsing markers; hover-to-highlight shows volunteer locations
- **Live Firestore Sync** — Field reports, squad status, and matches update in real time across all operators
- **Accept / Reject Flow** — Operators can accept or reject AI-suggested volunteers; rejections auto-promote the next best candidate
- **Terminal CLI (The Kernel)** — Type `SEED` to inject realistic mock crisis scenarios; `STATUS` for system health
- **Logistics Tracker** — Synced map + squad roster; click a map marker to scroll to the matching squad card
- **Zero-Trust Security** — All server actions require Firebase ID Token verification via Admin SDK
- **Google Cloud Run Ready** — Multi-stage Dockerfile with `standalone` output for minimal image size

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Server Actions) |
| AI | Google Gemini 1.5 Pro |
| Database | Firebase Firestore |
| Authentication | Firebase Auth (Email/Password + Google SSO) |
| Map | Leaflet.js |
| Animations | Framer Motion |
| Charts | D3.js |
| Deployment | Google Cloud Run (Docker) |

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/synapse-edge.git
cd synapse-edge/frontend
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
cp .env.local.example .env.local
```

Fill in all values in `.env.local`. See `.env.local.example` for descriptions of each key.

You will need:
- A **Google Gemini API key** from [Google AI Studio](https://aistudio.google.com/app/apikey)
- A **Firebase project** with Firestore and Authentication enabled
- A **Firebase Service Account** JSON (for the Admin SDK)

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Deployment — Google Cloud Run

The app ships with a production-ready `Dockerfile` and is configured with `output: "standalone"` in `next.config.ts`.

```bash
# Authenticate
gcloud auth login
gcloud config set project YOUR_GCP_PROJECT_ID

# Enable required APIs
gcloud services enable run.googleapis.com cloudbuild.googleapis.com secretmanager.googleapis.com

# Deploy (Cloud Build handles the Docker build automatically)
gcloud run deploy synapse-edge \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-secrets "GEMINI_API_KEY=GEMINI_API_KEY:latest" \
  --set-secrets "FIREBASE_PRIVATE_KEY=FIREBASE_PRIVATE_KEY:latest" \
  --set-secrets "FIREBASE_CLIENT_EMAIL=FIREBASE_CLIENT_EMAIL:latest" \
  --set-secrets "FIREBASE_PROJECT_ID=FIREBASE_PROJECT_ID:latest"
```

> **After deployment:** Add your Cloud Run URL to Firebase Console → Authentication → Authorized Domains.

---

## Project Structure

```
frontend/
├── src/
│   ├── app/                  # Next.js App Router pages
│   │   ├── page.tsx          # Mission Control (Incidents dashboard)
│   │   ├── logistics/        # Active squad tracking
│   │   ├── resources/        # Asset deployment
│   │   ├── intel/            # Strategic intelligence memos
│   │   ├── terminal/         # CLI (The Kernel)
│   │   ├── bunker/           # Secure vault
│   │   ├── settings/         # Operator profile management
│   │   ├── login/            # Authentication
│   │   ├── api/              # Next.js API routes
│   │   └── actions/          # Server Actions (auth-gated)
│   ├── components/           # Reusable UI components
│   │   ├── CrisisMap.tsx     # Leaflet tactical map
│   │   ├── Sidebar.tsx       # Navigation
│   │   ├── TopBar.tsx        # Header with clock + auth controls
│   │   └── D3Sparkline.tsx   # Animated signal chart
│   ├── hooks/
│   │   └── useLiveFeed.ts    # Real-time Firestore subscription
│   └── lib/
│       ├── firebase/         # Firebase client config
│       ├── firebase-admin.ts # Admin SDK (server-side)
│       ├── security.ts       # Token verification
│       └── utils.ts          # Zod validation schemas
├── Dockerfile                # Multi-stage Docker build
├── .dockerignore
├── next.config.ts            # standalone output mode
└── .env.local.example        # Environment variable reference
```

---

## License

MIT
