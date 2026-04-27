"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
  type Unsubscribe,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "@/lib/firebase/config";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface MatchCandidate {
  name: string;
  bio: string;
  skills_raw: string[];
  telegramHandle: string;
  similarity_score: number;
}

export interface LiveTask {
  id: string;
  raw_text: string;
  intent: string;
  urgency: number;
  skills_needed: string[];
  description: string;
  location_lat: number | null;
  location_lng: number | null;
  sync_hops: number;
  status: "incoming" | "extracting" | "matching" | "dispatched" | "resolved";
  matched_volunteer?: MatchCandidate;
  all_matches?: MatchCandidate[];
  match_reason?: string;
  dispatched: boolean;
  createdAt: { toMillis: () => number } | null;
}

export interface LiveStats {
  total: number;
  incoming: number;
  dispatched: number;
}

export function useLiveFeed(autoPilot: boolean = false) {
  const [tasks, setTasks] = useState<LiveTask[]>([]);
  const [stats, setStats] = useState<LiveStats>({ total: 0, incoming: 0, dispatched: 0 });
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track previously seen task IDs to fire toasts only on NEW tasks
  const [seenIds] = useState(() => new Set<string>());

  // Track tasks currently being processed to avoid duplicate API calls
  const processingIds = useRef(new Set<string>());

  // Auto-pilot: process incoming tasks automatically
  const triggerProcess = useCallback(async (task: LiveTask) => {
    if (processingIds.current.has(task.id)) return;
    processingIds.current.add(task.id);

    try {
      toast.info(`Processing: ${task.raw_text.slice(0, 60)}...`, {
        icon: "🧠",
        duration: 3000,
      });

      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("User not authenticated.");

      const res = await fetch("/api/process-task", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify({ rawText: task.raw_text, taskId: task.id }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const result = await res.json();
      if (result.success && result.matches?.[0]) {
        toast.success(
          `Match Found: ${result.matches[0].name}. Dispatching via Telegram...`,
          { icon: "🚨", duration: 5000 }
        );
      }
    } catch (err) {
      console.error("Auto-pilot process failed:", err);
      toast.error(`Processing failed: ${err instanceof Error ? err.message : "Unknown error"}`, {
        icon: "❌",
        duration: 4000,
      });
      processingIds.current.delete(task.id);
    }
  }, []);

  // Manual process function exposed to the dashboard
  const processTask = useCallback(
    async (task: LiveTask) => {
      await triggerProcess(task);
    },
    [triggerProcess]
  );

  useEffect(() => {
    // Only run on client
    if (typeof window === "undefined") return;

    let firestoreUnsub: Unsubscribe | undefined;

    // Guard: only connect to Firestore once the user is authenticated
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      // Tear down any existing Firestore listener
      firestoreUnsub?.();
      firestoreUnsub = undefined;

      if (!user) {
        setIsConnected(false);
        setTasks([]);
        setStats({ total: 0, incoming: 0, dispatched: 0 });
        return;
      }

      try {
        const q = query(
          collection(db, "field_tasks"),
          orderBy("createdAt", "desc"),
          limit(20)
        );

        firestoreUnsub = onSnapshot(
          q,
          (snapshot) => {
            setIsConnected(true);
            setError(null);

            const liveTasks: LiveTask[] = snapshot.docs.map((doc) => ({
              id: doc.id,
              ...(doc.data() as Omit<LiveTask, "id">),
            }));

            // Fire toasts for newly arrived tasks
            liveTasks.forEach((t) => {
              if (!seenIds.has(t.id)) {
                seenIds.add(t.id);

                // Auto-pilot: automatically process incoming tasks
                if (autoPilot && t.status === "incoming" && !processingIds.current.has(t.id)) {
                  triggerProcess(t);
                }

                // Toast for dispatched tasks we haven't seen before
                if (t.dispatched && t.matched_volunteer) {
                  toast.success(
                    `Match Found: ${t.matched_volunteer.name}. Dispatching via Telegram...`,
                    { icon: "🚨", duration: 4000 }
                  );
                }
              }
            });

            setTasks(liveTasks);
            setStats({
              total: liveTasks.length,
              incoming: liveTasks.filter((t) => t.status === "incoming").length,
              dispatched: liveTasks.filter((t) => t.dispatched).length,
            });
          },
          (err) => {
            console.error("Firestore onSnapshot error:", err);
            setError(err.message);
            setIsConnected(false);
          }
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to connect to Firestore";
        setTimeout(() => setError(msg), 0);
      }
    });

    return () => {
      firestoreUnsub?.();
      unsubAuth();
    };
  }, [autoPilot]); // eslint-disable-line react-hooks/exhaustive-deps

  return { tasks, stats, isConnected, error, processTask };
}
