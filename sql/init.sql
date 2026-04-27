-- ============================================================================
-- SynapseEdge — Project Cortex
-- PostgreSQL + pgvector Schema Initialization
-- ============================================================================
-- This script initializes the database schema for the Latent Vector Routing
-- engine. It requires PostgreSQL 15+ with the pgvector extension installed.
-- ============================================================================

-- Enable the pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- VOLUNTEERS TABLE
-- Stores volunteer profiles with unstructured bios that are embedded into
-- 768-dimensional vectors for semantic skill matching.
-- ============================================================================
CREATE TABLE IF NOT EXISTS volunteers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    email           VARCHAR(255) UNIQUE NOT NULL,
    phone           VARCHAR(50),
    -- The unstructured bio is the PRIMARY source for latent skill detection.
    -- Example: "I'm a retired nurse who speaks Urdu and Spanish. I've organized
    -- supply chains for three floods and can drive heavy vehicles."
    -- This gets embedded into a 768-dim vector for semantic matching.
    bio             TEXT NOT NULL,
    -- Optional explicit skills (supplementary, not primary matching source)
    skills_raw      TEXT[] DEFAULT '{}',
    -- Geolocation for proximity-aware matching
    location_lat    DOUBLE PRECISION,
    location_lng    DOUBLE PRECISION,
    -- Availability toggle for real-time dispatch
    availability    BOOLEAN DEFAULT true,
    -- Vertex AI text-embedding-005 vector (768 dimensions)
    embedding       vector(768),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- FIELD TASKS TABLE
-- Stores structured task data extracted from handwritten field notes via the
-- Snap-to-Semantics engine. Each task arrives from Android via Firebase sync.
-- ============================================================================
CREATE TABLE IF NOT EXISTS field_tasks (
    -- UUID generated on-device (Room DB) — ensures cross-device uniqueness
    id                  UUID PRIMARY KEY,
    -- Raw OCR text extracted by ML Kit from the handwritten note
    raw_text            TEXT NOT NULL,
    -- AI-extracted structured fields (Gemini Nano / Gemini Pro)
    intent              VARCHAR(100),
    urgency             INTEGER CHECK (urgency BETWEEN 1 AND 5),
    skills_needed       TEXT[] DEFAULT '{}',
    -- AI-generated natural language summary for embedding
    description         TEXT,
    -- Geolocation from device GPS at capture time
    location_lat        DOUBLE PRECISION,
    location_lng        DOUBLE PRECISION,
    -- Provenance tracking
    source_device_id    VARCHAR(255),
    -- Number of mesh relay hops before reaching backend
    sync_hops           INTEGER DEFAULT 0,
    -- Vertex AI text-embedding-005 vector (768 dimensions)
    embedding           vector(768),
    -- Lifecycle status: unmatched → matched → dispatched → resolved
    status              VARCHAR(50) DEFAULT 'unmatched',
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    matched_at          TIMESTAMPTZ
);

-- ============================================================================
-- TASK MATCHES TABLE
-- Junction table storing task↔volunteer match proposals with similarity scores.
-- The matching engine proposes top-K matches; dispatchers confirm.
-- ============================================================================
CREATE TABLE IF NOT EXISTS task_matches (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id             UUID NOT NULL REFERENCES field_tasks(id) ON DELETE CASCADE,
    volunteer_id        UUID NOT NULL REFERENCES volunteers(id) ON DELETE CASCADE,
    -- Cosine similarity score (0.0 = orthogonal, 1.0 = identical)
    similarity_score    DOUBLE PRECISION NOT NULL,
    -- Match lifecycle: proposed → accepted → dispatched → completed → rejected
    status              VARCHAR(50) DEFAULT 'proposed',
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    -- Prevent duplicate matches
    UNIQUE(task_id, volunteer_id)
);

-- ============================================================================
-- MESH SYNC LOG TABLE
-- Audit trail for mesh relay operations — tracks the gossip protocol
-- ============================================================================
CREATE TABLE IF NOT EXISTS mesh_sync_log (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id             UUID NOT NULL REFERENCES field_tasks(id) ON DELETE CASCADE,
    from_device_id      VARCHAR(255) NOT NULL,
    to_device_id        VARCHAR(255) NOT NULL,
    hop_number          INTEGER NOT NULL,
    synced_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- HNSW (Hierarchical Navigable Small World) indexes for fast ANN search
-- ============================================================================

-- Volunteer embedding index — optimized for cosine distance queries
-- This enables sub-millisecond nearest-neighbor search across 100K+ volunteers
CREATE INDEX IF NOT EXISTS idx_volunteers_embedding
    ON volunteers USING hnsw (embedding vector_cosine_ops);

-- Task embedding index — for reverse matching (find similar tasks)
CREATE INDEX IF NOT EXISTS idx_field_tasks_embedding
    ON field_tasks USING hnsw (embedding vector_cosine_ops);

-- Standard B-tree indexes for filtered queries
CREATE INDEX IF NOT EXISTS idx_volunteers_availability
    ON volunteers (availability) WHERE availability = true;

CREATE INDEX IF NOT EXISTS idx_field_tasks_status
    ON field_tasks (status);

CREATE INDEX IF NOT EXISTS idx_field_tasks_urgency
    ON field_tasks (urgency DESC);

CREATE INDEX IF NOT EXISTS idx_task_matches_status
    ON task_matches (status);

-- ============================================================================
-- SEED DATA (Development)
-- Sample volunteers with diverse latent skill bios
-- ============================================================================
INSERT INTO volunteers (name, email, bio, skills_raw, location_lat, location_lng, availability)
VALUES
    (
        'Dr. Priya Sharma',
        'priya.sharma@example.com',
        'I am a trauma surgeon with 12 years of field hospital experience. I have worked with MSF in Syria and South Sudan. Fluent in Hindi, English, and basic Arabic. Certified in disaster triage protocols and can set up field medical stations from scratch. Also trained in water purification systems.',
        ARRAY['medicine', 'triage', 'surgery', 'water-purification'],
        28.6139, 77.2090, true
    ),
    (
        'Marcus Chen',
        'marcus.chen@example.com',
        'Software engineer turned humanitarian logistics coordinator. Expert in supply chain optimization, fleet management, and warehouse operations. Built custom tracking systems for UNHCR refugee camp distributions. Licensed HAM radio operator and drone pilot. Can repair generators and solar panel systems.',
        ARRAY['logistics', 'technology', 'drones', 'radio'],
        37.7749, -122.4194, true
    ),
    (
        'Fatima Al-Hassan',
        'fatima.alhassan@example.com',
        'Community health worker specializing in maternal and child health in rural areas. 8 years of experience conducting health surveys and vaccination drives. Speak Arabic, French, and Swahili. Trained in psychosocial first aid and community mobilization. Can organize and train local volunteer teams rapidly.',
        ARRAY['health', 'community-organizing', 'translation', 'training'],
        -1.2921, 36.8219, true
    ),
    (
        'Raj Patel',
        'raj.patel@example.com',
        'Civil engineer with expertise in emergency shelter construction and structural damage assessment. Experienced with bamboo, tarpaulin, and prefab shelter systems. Have deployed to earthquake zones in Nepal and Turkey. Also skilled in GIS mapping and can operate heavy construction equipment including excavators.',
        ARRAY['engineering', 'construction', 'shelters', 'GIS'],
        19.0760, 72.8777, true
    ),
    (
        'Sarah Okonkwo',
        'sarah.okonkwo@example.com',
        'Former military communications officer now working in disaster preparedness. Expert in setting up mesh communication networks, satellite phones, and portable internet solutions. Trained in search and rescue operations. Can coordinate multi-agency response efforts and manage incident command systems. Experienced rock climber and wilderness navigator.',
        ARRAY['communications', 'search-rescue', 'navigation', 'leadership'],
        6.5244, 3.3792, true
    );
