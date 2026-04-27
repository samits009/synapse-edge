"use client";

import { useState, useEffect, useCallback, useRef } from "react";

/* ========================================================================
   SynapseEdge — Simulation Engine Hook
   ========================================================================
   Generates realistic mock events on timed intervals to drive the
   Mission Control UI without a live backend. Simulates:

     1. Incoming field reports arriving from mesh-synced devices
     2. Gemini AI extraction completing after a processing delay
     3. pgvector matching returning ranked volunteer matches
     4. Telegram dispatch firing for top matches

   Usage:
     const { tasks, stats, events, isRunning, toggle } = useSimulation();
   ======================================================================== */

// ── Types ─────────────────────────────────────────────────────────────

export interface SimVolunteerMatch {
  volunteer_name: string;
  volunteer_bio: string;
  volunteer_skills: string[];
  similarity_score: number;
}

export interface SimTask {
  id: string;
  raw_text: string;
  intent: string;
  urgency: number;
  skills_needed: string[];
  description: string;
  status: "incoming" | "extracting" | "matching" | "dispatched" | "resolved";
  sync_hops: number;
  location: { lat: number; lng: number };
  created_at: string;
  matches: SimVolunteerMatch[];
}

export interface SimEvent {
  id: string;
  type: "task_ingested" | "extraction_complete" | "match_found" | "dispatch_sent";
  message: string;
  timestamp: string;
  taskId: string;
}

export interface SimStats {
  tasks: { total: number; incoming: number; extracting: number; dispatched: number; resolved: number };
  volunteers: { total: number; available: number; embedded: number };
  matching: { total_matches: number; avg_similarity: number };
  pipeline: { avg_extraction_ms: number; avg_matching_ms: number };
}

// ── Seed Data ─────────────────────────────────────────────────────────

const CRISIS_SCENARIOS: Omit<SimTask, "id" | "status" | "created_at" | "matches">[] = [
  {
    raw_text:
      "Village Rampur Block C\nNeed immediate medical supplies — 3 children high fever\nno clean water since Tuesday. Hand pump broke.\nPriority: VERY URGENT",
    intent: "medical_supply_request",
    urgency: 4,
    skills_needed: ["medical_first_aid", "plumbing", "water_systems"],
    description:
      "Urgent medical supplies needed for children with high fever. Water hand pump is broken, requiring plumbing repair.",
    sync_hops: 2,
    location: { lat: 26.4499, lng: 80.3319 },
  },
  {
    raw_text:
      "Shelter camp Sector 7 — roughly 40 families displaced.\nNeed tarps, blankets, Bhojpuri speaker for registration.\nRoads washed out from north side.",
    intent: "shelter_logistics",
    urgency: 3,
    skills_needed: ["logistics", "translation_bhojpuri", "shelter_setup"],
    description:
      "Shelter camp needs tarps and blankets for 40 displaced families. Bhojpuri translator required. North road access blocked.",
    sync_hops: 1,
    location: { lat: 25.6093, lng: 85.1376 },
  },
  {
    raw_text:
      "School building tilted — cracks in east wall.\nPeople still inside collecting belongings.\nNeed structural assessment ASAP.\nContact: Sarpanch Ravi 99XXX12345",
    intent: "structural_assessment",
    urgency: 5,
    skills_needed: ["civil_engineering", "structural_assessment", "evacuation"],
    description:
      "School building structurally compromised with visible cracks. People inside. Requires immediate structural assessment and evacuation.",
    sync_hops: 3,
    location: { lat: 28.6139, lng: 77.209 },
  },
  {
    raw_text:
      "Rice stocks critically low — Block D warehouse\n200+ people waiting since morning. Generator also down.\nNeed fuel and food distribution team.",
    intent: "food_distribution",
    urgency: 4,
    skills_needed: ["logistics", "food_safety", "generator_repair"],
    description:
      "Food warehouse in Block D running critically low. Generator failure compounding the crisis. 200+ people awaiting distribution.",
    sync_hops: 1,
    location: { lat: 27.1767, lng: 78.0081 },
  },
  {
    raw_text:
      "Bridge on NH-47 has collapsed near Km 32.\nTwo trucks stranded, one carrying medicines.\nNeed crane and alternate route coordination.",
    intent: "infrastructure_emergency",
    urgency: 5,
    skills_needed: ["heavy_machinery", "route_planning", "rescue_ops"],
    description:
      "Highway bridge collapse blocking medicine supply route. Two trucks stranded. Requires heavy machinery and alternate route coordination.",
    sync_hops: 4,
    location: { lat: 26.8467, lng: 80.9462 },
  },
];

const VOLUNTEER_POOL: SimVolunteerMatch[] = [
  { volunteer_name: "Dr. Priya Sharma", volunteer_bio: "Trauma surgeon, remote-area deployment. Water purification certified.", volunteer_skills: ["trauma_surgery", "water_purification", "triage"], similarity_score: 0.842 },
  { volunteer_name: "Marcus Chen", volunteer_bio: "Mechanical engineer. Repairs generators and solar panel systems in field.", volunteer_skills: ["mechanical_repair", "solar_systems", "generators"], similarity_score: 0.615 },
  { volunteer_name: "Ananya Verma", volunteer_bio: "Social worker from Patna, fluent in Bhojpuri and Hindi. Refugee camp coordination.", volunteer_skills: ["translation_hindi", "bhojpuri", "camp_coordination"], similarity_score: 0.791 },
  { volunteer_name: "Raj Patel", volunteer_bio: "Licensed structural engineer, 8 years post-earthquake assessment. Red Cross certified.", volunteer_skills: ["structural_engineering", "damage_assessment", "red_cross"], similarity_score: 0.923 },
  { volunteer_name: "Kenji Watanabe", volunteer_bio: "Search and rescue specialist, confined space operations and building collapse.", volunteer_skills: ["search_rescue", "confined_space", "evacuation"], similarity_score: 0.788 },
  { volunteer_name: "Sofia Rodriguez", volunteer_bio: "Logistics coordinator, 5 years WFP field ops. Fluent in Spanish, Hindi, English.", volunteer_skills: ["logistics", "food_safety", "supply_chain"], similarity_score: 0.856 },
  { volunteer_name: "Amit Desai", volunteer_bio: "Civil engineer specializing in bridge and road assessment. JCB and crane operator certified.", volunteer_skills: ["heavy_machinery", "civil_engineering", "route_planning"], similarity_score: 0.901 },
];

// ── Hook ──────────────────────────────────────────────────────────────

let taskCounter = 0;
let eventCounter = 0;

function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${(++taskCounter).toString(16).padStart(4, "0")}`;
}

export function useSimulation(intervalMs: number = 8000) {
  const [tasks, setTasks] = useState<SimTask[]>([]);
  const [events, setEvents] = useState<SimEvent[]>([]);
  const [isRunning, setIsRunning] = useState(true);
  const scenarioIndex = useRef(0);

  const computeStats = useCallback((): SimStats => {
    const incoming = tasks.filter((t) => t.status === "incoming").length;
    const extracting = tasks.filter((t) => t.status === "extracting" || t.status === "matching").length;
    const dispatched = tasks.filter((t) => t.status === "dispatched").length;
    const resolved = tasks.filter((t) => t.status === "resolved").length;
    const allScores = tasks.flatMap((t) => t.matches.map((m) => m.similarity_score));
    const avgSim = allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0;

    return {
      tasks: { total: tasks.length, incoming, extracting, dispatched, resolved },
      volunteers: { total: 156, available: 156 - dispatched * 2, embedded: 156 },
      matching: { total_matches: allScores.length, avg_similarity: avgSim },
      pipeline: { avg_extraction_ms: 1840, avg_matching_ms: 320 },
    };
  }, [tasks]);

  const addEvent = useCallback((type: SimEvent["type"], message: string, taskId: string) => {
    setEvents((prev) => [
      {
        id: `evt-${++eventCounter}`,
        type,
        message,
        timestamp: new Date().toISOString(),
        taskId,
      },
      ...prev.slice(0, 49), // cap at 50
    ]);
  }, []);

  // Simulate the full pipeline for one task
  const ingestTask = useCallback(async () => {
    const scenario = CRISIS_SCENARIOS[scenarioIndex.current % CRISIS_SCENARIOS.length];
    scenarioIndex.current++;

    const taskId = generateId("TSK");

    // Jitter the location slightly so markers don't overlap
    const jitter = () => (Math.random() - 0.5) * 0.5;
    const location = {
      lat: scenario.location.lat + jitter(),
      lng: scenario.location.lng + jitter(),
    };

    const newTask: SimTask = {
      ...scenario,
      id: taskId,
      status: "incoming",
      location,
      created_at: new Date().toISOString(),
      matches: [],
    };

    // Stage 1: Incoming
    setTasks((prev) => [newTask, ...prev]);
    addEvent("task_ingested", `Field report received via mesh (${scenario.sync_hops} hops)`, taskId);

    // Stage 2: AI Extraction (1.5-2.5s delay)
    await sleep(1500 + Math.random() * 1000);
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: "extracting" as const } : t))
    );
    addEvent("extraction_complete", `Gemini extracted intent: ${scenario.intent}`, taskId);

    // Stage 3: Vector Matching (1-2s delay)
    await sleep(1000 + Math.random() * 1000);
    const matchCount = 1 + Math.floor(Math.random() * 2);
    const shuffled = [...VOLUNTEER_POOL].sort(() => Math.random() - 0.5);
    const matches = shuffled.slice(0, matchCount).map((v) => ({
      ...v,
      similarity_score: Math.round((0.7 + Math.random() * 0.25) * 1000) / 1000,
    })).sort((a, b) => b.similarity_score - a.similarity_score);

    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: "dispatched" as const, matches } : t))
    );
    addEvent("match_found", `pgvector: ${matches[0].volunteer_name} (${(matches[0].similarity_score * 100).toFixed(1)}%)`, taskId);

    // Stage 4: Telegram dispatch confirmation
    await sleep(500);
    addEvent("dispatch_sent", `Telegram alert sent to ${matches[0].volunteer_name}`, taskId);
  }, [addEvent]);

  // Auto-run loop
  useEffect(() => {
    if (!isRunning) return;

    // Immediately ingest first task
    ingestTask();

    const timer = setInterval(() => {
      ingestTask();
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isRunning, intervalMs, ingestTask]);

  const toggle = useCallback(() => setIsRunning((r) => !r), []);

  const stats = computeStats();

  return { tasks, stats, events, isRunning, toggle, ingestTask };
}

// ── Helpers ───────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
