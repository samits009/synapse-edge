"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "@/lib/firebase/config";
import { deploySwarm } from "@/app/actions/deploySwarm";
import TopBar from "@/components/TopBar";
import Sidebar from "@/components/Sidebar";
import dynamic from "next/dynamic";

const CrisisMap = dynamic(() => import("@/components/CrisisMap"), { ssr: false });

interface SquadDoc {
  id: string;
  status: string;
  mesh_signal_strength?: number;
  personnel_count?: number;
  primary_asset?: string;
  eta_minutes?: number;
  location?: { lat: number; lng: number };
}

interface TaskDoc {
  id: string;
  status: string;
  description?: string;
  suggested_squad?: string;
}

export default function LogisticsPage() {
  const [squads, setSquads] = useState<SquadDoc[]>([]);
  const [tasks, setTasks] = useState<TaskDoc[]>([]);
  const [processingTask, setProcessingTask] = useState<string | null>(null);
  const [selectedSquad, setSelectedSquad] = useState<string | null>(null);
  const squadRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

  // Simulated dynamic routing logs
  const [routingLogs, setRoutingLogs] = useState<string[]>([
    "[LOGISTICS] BRIDGE L-14 DESTROYED",
    "[LOGISTICS] RE-CALCULATING SWARM PATHS...",
    "[LOGISTICS] ALPHA: ETA UPDATED +4M",
    "[LOGISTICS] OMEGA: SWERVE ROUTE ENGAGED"
  ]);

  // Ref to hold Firestore listener cleanup functions
  const firestoreUnsubs = useRef<(() => void)[]>([]);

  useEffect(() => {
    // H3: Guard Firestore listeners behind auth state
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      // Cleanup any existing Firestore listeners
      firestoreUnsubs.current.forEach((fn) => fn());
      firestoreUnsubs.current = [];

      if (!user) {
        setSquads([]);
        setTasks([]);
        return;
      }

      // 1. Listen to all squads (authenticated)
      const unsubSquads = onSnapshot(collection(db, "squads"), (snapshot) => {
        const sq = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as SquadDoc));
        setSquads(sq);
      });

      // 2. Listen to pending matches/tasks (authenticated)
      const q = query(collection(db, "field_tasks"), where("status", "==", "MATCHING"));
      const unsubTasks = onSnapshot(q, (snapshot) => {
        const tsk = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as TaskDoc));
        setTasks(tsk);
      });

      firestoreUnsubs.current = [unsubSquads, unsubTasks];
    });

    return () => {
      firestoreUnsubs.current.forEach((fn) => fn());
      unsubAuth();
    };
  }, []);

  // Simulated Routing Events
  useEffect(() => {
    const events = [
      "[LOGISTICS] MESH-GATE: CONNECTION STABLE",
      "[LOGISTICS] ALL NODES SYNCHRONIZED",
      "[LOGISTICS] SECTOR 7: NEW ASSET DETECTED",
      "[LOGISTICS] RE-ROUTING TO AVOID DEAD ZONE"
    ];
    let i = 0;
    const interval = setInterval(() => {
      if (i < events.length) {
        setRoutingLogs((prev) => [...prev, events[i]].slice(-50));
        i++;
      }
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  const handleAccept = async (taskId: string, suggestedSquadId: string) => {
    setProcessingTask(taskId);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Not authenticated");
      const success = await deploySwarm(taskId, suggestedSquadId, idToken);
      if (success) {
        try {
          const audio = new Audio("/ping.wav");
          audio.volume = 0.5;
          audio.play().catch(() => {});
        } catch (e) {}
      }
    } catch (e) {
      console.error(e);
    }
    setProcessingTask(null);
  };

  // Deterministic hash for stable fallback coordinates (prevents marker jumps on re-render)
  const hashToOffset = (str: string, seed: number): number => {
    let hash = seed;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    return ((hash % 1000) / 1000) * 0.5 - 0.25; // range: -0.25 to +0.25
  };

  const mapTasks = squads.map((sq) => ({
    id: sq.id, // keep original ID for click matching
    status: sq.status === "DARK" ? "extracted" : "dispatched",
    urgency: 4,
    intent: sq.id,
    description: `Asset: ${sq.primary_asset || 'N/A'}, Personnel: ${sq.personnel_count}`,
    location: sq.location || { lat: 26.85 + hashToOffset(sq.id, 1), lng: 80.91 + hashToOffset(sq.id, 2) },
  }));

  const handleMapClick = useCallback((taskId: string) => {
    setSelectedSquad(taskId);
    // Scroll the squad card into view
    const el = squadRefs.current.get(taskId);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-[#080808] text-neutral-200 font-mono">
      <TopBar />
      <div className="flex h-full pt-16">
        <Sidebar />
        <main className="ml-56 flex-1 h-[calc(100vh-64px)] p-6 overflow-hidden flex flex-col">
          
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-[280px_1fr_280px] gap-6 min-h-0">
            
            {/* ── LEFT COLUMN: ACTIVE SWARMS + MESH PULSE ── */}
            <div className="flex flex-col gap-6 min-h-0">
              
              {/* Active Swarms */}
              <div className="flex flex-col flex-1 min-h-0 border border-white/5 bg-[#0a0a0a] p-5 relative">
                <div className="flex items-center gap-2 mb-6 border-b border-white/5 pb-3 shrink-0">
                  <span className="text-[#FF5A00] text-[10px]">⬡</span>
                  <h2 className="font-space text-[11px] tracking-[0.25em] text-white font-black uppercase">ACTIVE SWARMS</h2>
                </div>
                
                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
                  {squads.map((squad) => {
                    const isDark = squad.status === "DARK" || squad.mesh_signal_strength === 0;
                    const isRouting = squad.status === "RE-ROUTING";
                    const statusColor = isDark ? "text-neutral-500" : "text-[#FF5A00]";
                    const statusText = isDark ? "OFF-MESH" : isRouting ? "RE-ROUTING" : squad.status || "CONNECTED";
                    
                    return (
                      <div
                        key={squad.id}
                        ref={(el) => { squadRefs.current.set(squad.id, el); }}
                        onClick={() => setSelectedSquad(squad.id === selectedSquad ? null : squad.id)}
                        className={`border p-4 relative group cursor-pointer transition-all ${
                          selectedSquad === squad.id
                            ? "border-[#FF5A00]/60 bg-[#FF5A00]/5 shadow-[0_0_15px_rgba(255,90,0,0.1)]"
                            : "border-white/5 bg-[#111] hover:border-white/10"
                        }`}
                      >
                        {/* Faint top border highlight */}
                        <div className="absolute top-0 left-0 right-0 h-[1px] bg-white/5 group-hover:bg-[#FF5A00]/50 transition-all" />
                        
                        <div className="flex justify-between items-start mb-3">
                          <span className="font-space text-[12px] text-white tracking-[0.1em] font-black uppercase">{squad.id}</span>
                          <span className={`text-[9px] font-black tracking-[0.1em] uppercase ${statusColor}`}>
                            {statusText}
                          </span>
                        </div>
                        
                        <div className="text-[9px] text-neutral-500 font-bold uppercase tracking-[0.1em] mb-5">
                          {squad.personnel_count} PERSONNEL // {squad.primary_asset || "STANDARD EQUIP"}
                        </div>
                        
                        <div className="flex justify-between items-end">
                          <div className="flex gap-1 mb-1">
                            {[1, 2, 3, 4].map(i => {
                              const sig = squad.mesh_signal_strength || 100;
                              const filled = i <= Math.ceil(sig / 25);
                              return (
                                <div key={i} className={`w-2 h-2 rounded-none ${filled ? (isDark ? "bg-neutral-600" : "bg-[#FF5A00]") : "bg-neutral-800"}`} />
                              );
                            })}
                          </div>
                          <div className="text-right">
                            <span className="block font-space text-[8px] text-neutral-600 tracking-[0.2em] mb-0.5">ETA</span>
                            <span className="font-space text-xl font-black text-white tracking-tight leading-none">
                              {(squad.eta_minutes ?? -1) > -1 ? `${squad.eta_minutes}m` : "--m"}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Mesh Pulse */}
              <div className="border border-white/5 bg-[#0a0a0a] p-5 shrink-0 relative">
                <div className="flex items-center gap-2 mb-4 border-b border-white/5 pb-3">
                  <span className="text-[#FF5A00] text-[10px]">⬱</span>
                  <h2 className="font-space text-[11px] tracking-[0.25em] text-white font-black uppercase">MESH PULSE</h2>
                </div>
                
                <div className="flex justify-between text-[9px] text-neutral-500 uppercase tracking-[0.2em] mb-2 font-bold">
                  <span>SYNC NODES</span>
                  <span className="text-white">42 ACTIVE</span>
                </div>
                
                <div className="w-full bg-neutral-900 h-2 mb-3 rounded-none overflow-hidden">
                  <div className="bg-[#FF5A00] h-full" style={{ width: "85%" }} />
                </div>
                
                <div className="font-space text-[8px] text-[#FF5A00] tracking-[0.15em] font-bold">
                  [LATENCY: 14MS] // MESH STABLE
                </div>
              </div>

            </div>

            {/* ── CENTER COLUMN: MAP ── */}
            <div className="flex flex-col min-h-0 border border-white/5 relative group bg-[#0a0a0a]">
              <div className="absolute inset-0 z-0 opacity-80 mix-blend-screen saturate-0">
                <CrisisMap tasks={mapTasks} height="100%" onTaskClick={handleMapClick} />
              </div>
              
              {/* Swarm Logic Overlay Box */}
              <div className="absolute bottom-6 left-6 border border-white/10 bg-[#080808]/95 p-4 z-10 shadow-2xl">
                <div className="text-[#FF5A00] font-space text-[12px] font-black tracking-[0.2em] uppercase mb-1">
                  SWARM LOGIC: CLUSTER ACTIVE
                </div>
                <div className="text-[9px] text-neutral-500 font-bold uppercase tracking-[0.2em]">
                  {squads.length} NODES // 1 ASSET VECTOR
                </div>
              </div>
            </div>

            {/* ── RIGHT COLUMN: ROUTING + VECTORS ── */}
            <div className="flex flex-col gap-6 min-h-0">
              
              {/* Dynamic Routing */}
              <div className="flex flex-col flex-1 min-h-0 border border-white/5 bg-[#0a0a0a] p-5 relative">
                <div className="flex items-center gap-2 mb-6 border-b border-white/5 pb-3 shrink-0">
                  <span className="text-[#FF5A00] text-[10px]">⬡</span>
                  <h2 className="font-space text-[11px] tracking-[0.25em] text-white font-black uppercase">DYNAMIC ROUTING</h2>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar font-mono text-[9px] font-bold uppercase space-y-4">
                  {routingLogs.map((log, i) => (
                    <div key={i} className="text-[#FF5A00]">
                      {log}
                    </div>
                  ))}
                  <div className="text-neutral-600 animate-pulse">_</div>
                </div>
              </div>

              {/* Route Vectors / Pending Tasks */}
              <div className="flex flex-col flex-1 min-h-0 border border-white/5 bg-[#0a0a0a] p-5 relative">
                <div className="flex items-center gap-2 mb-6 border-b border-white/5 pb-3 shrink-0">
                  <span className="text-neutral-500 text-[10px]">⊙</span>
                  <h2 className="font-space text-[11px] tracking-[0.25em] text-neutral-400 font-black uppercase">ROUTE VECTORS</h2>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col relative">
                  {tasks.length === 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center border border-white/5 bg-[#111]">
                      <span className="text-[10px] text-neutral-700 tracking-[0.3em] font-black font-space">
                        AWAITING GPS LOCK
                      </span>
                    </div>
                  ) : (
                    <div className="w-full space-y-4 border border-white/5 bg-[#111] p-4 h-full">
                       <span className="text-[9px] text-[#FF5A00] tracking-[0.3em] font-bold block text-center mb-3">
                        DISPATCH QUEUE
                      </span>
                      {tasks.map((task) => {
                        const isProcessing = processingTask === task.id;
                        return (
                          <div key={task.id} className="border border-white/10 bg-[#080808] p-3 flex flex-col gap-2 relative">
                            <span className="text-[8px] text-[#FF5A00] tracking-widest">{task.id}</span>
                            <div className="text-[9px] text-neutral-400 line-clamp-2 leading-relaxed">
                              {task.description}
                            </div>
                            <button
                              onClick={() => handleAccept(task.id, task.suggested_squad ?? "")}
                              disabled={isProcessing}
                              className={`w-full py-2 mt-2 text-[9px] font-black tracking-[0.2em] uppercase rounded-none transition-all ${
                                isProcessing
                                  ? "bg-[#FF5A00]/50 text-black cursor-wait"
                                  : "bg-[#FF5A00] text-black hover:bg-white"
                              }`}
                            >
                              {isProcessing ? "SYNCING..." : "DISPATCH"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>

        </main>
      </div>
    </div>
  );
}
