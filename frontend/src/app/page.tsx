"use client";

import React, { useState, useEffect, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import {
  Bell,
  Settings,
  Power,
  ChevronRight,
  Zap,
  Image,
  Activity,
  Users,
  Radio,
  Wifi,
  Check,
  X,
} from "lucide-react";
import { useLiveFeed, type LiveTask } from "@/hooks/useLiveFeed";
import { acceptMatch, rejectMatch } from "@/app/actions/updateTaskMatch";
import Sidebar from "@/components/Sidebar";
import TerminalBlock from "@/components/TerminalBlock";

const CrisisMap = dynamic(() => import("@/components/CrisisMap"), { ssr: false });

/* ========================================================================
   SUB-COMPONENTS
   ======================================================================== */

function UrgencyBar({ level }: { level: number }) {
  return (
    <div className="flex gap-0.5 items-center">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={`h-1.5 w-5 rounded-none transition-all ${
            i <= level ? "urgency-fill" : "bg-neutral-800"
          }`}
        />
      ))}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="glass-panel rounded-none p-4 relative overflow-hidden group">
      {/* Scanline overlay */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500">
        <div className="scan-line absolute inset-0" />
      </div>
      <div className="relative z-10">
        <p className="font-space text-[9px] tracking-[0.25em] text-neutral-500 uppercase mb-2 font-bold">
          {label}
        </p>
        <p className="text-3xl font-black font-space tracking-tight text-white">
          {value}
        </p>
        {sub && (
          <p className="text-[10px] text-neutral-600 mt-0.5 font-space tracking-[0.1em]">
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

/* ========================================================================
   MATCH CARD — Volunteer Match with Accept/Reject
   ======================================================================== */

function MatchCard({
  volunteer,
  rank,
  onAccept,
  onReject,
}: {
  volunteer: {
    name: string;
    bio: string;
    skills_raw: string[];
    similarity_score: number;
  };
  rank: number;
  onAccept?: () => void;
  onReject?: () => void;
}) {
  const pct = Math.round((volunteer.similarity_score || 0.88) * 100);
  const codeName = `OPR-${(Math.abs(volunteer.name.charCodeAt(0) * 17 + volunteer.name.charCodeAt(1) * 31) % 900) + 100}`;
  const role = volunteer.skills_raw?.length > 0 ? `${volunteer.skills_raw[0]} SPEC.` : "FIELD SPEC.";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.15, type: "spring", stiffness: 400, damping: 25 }}
      className="bg-[#0c0c0c] border border-white/5 rounded-none p-5 relative flex flex-col gap-4 hover:border-[#F27D26]/30 transition-all cursor-pointer"
    >
      {/* Top Row */}
      <div className="flex justify-between items-start gap-2">
        <div className="flex items-center gap-4 min-w-0">
          <img
            src={rank % 2 === 0 ? "/avatars/operator_1.png" : "/avatars/operator_2.png"}
            alt={codeName}
            className="w-14 h-14 rounded-none object-cover grayscale shrink-0 border border-white/10"
          />
          <div className="flex flex-col justify-center min-w-0">
            <h3 className="font-space text-sm font-black tracking-widest text-white uppercase leading-tight truncate">
              {codeName}
            </h3>
            <p className="text-[10px] font-space tracking-[0.15em] text-neutral-500 font-bold uppercase mt-1 break-words leading-snug">
              {role}
            </p>
          </div>
        </div>
        <span className="text-[#F27D26] font-space text-lg font-black tracking-tight shrink-0">
          {pct}%
        </span>
      </div>

      {/* Skill tags */}
      <div className="flex flex-wrap gap-2">
        {(volunteer.skills_raw || []).slice(0, 3).map((skill) => (
          <span
            key={skill}
            className="text-[9px] uppercase font-space tracking-[0.15em] font-bold px-3 py-1.5 rounded-none border border-white/10 text-neutral-500 bg-white/[0.02]"
          >
            {skill}
          </span>
        ))}
      </div>

      {/* Accept / Reject */}
      <div className="flex gap-2 mt-1">
        <button
          onClick={onAccept}
          className="flex-1 py-3 bg-[#F27D26] text-black font-space text-[10px] font-black tracking-[0.2em] uppercase rounded-none hover:bg-[#ff9040] transition-all"
        >
          ACCEPT
        </button>
        <button
          onClick={onReject}
          className="flex-1 py-3 bg-[#111] border border-white/5 text-neutral-500 font-space text-[10px] font-black tracking-[0.2em] uppercase rounded-none hover:border-white/10 hover:text-neutral-400 transition-all"
        >
          REJECT
        </button>
      </div>
    </motion.div>
  );
}

/* ========================================================================
   MAIN PAGE — MISSION CONTROL (ORANGE OPS REBUILD)
   ======================================================================== */

export default function MissionControlPage() {
  const router = useRouter();
  const [autoPilot, setAutoPilot] = useState(false);
  const { tasks, stats, isConnected, error, processTask } =
    useLiveFeed(autoPilot);
  const [selected, setSelected] = useState<number>(0);
  const [clock, setClock] = useState("");
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<number>(() => Date.now());


  // Clock — client only
  useEffect(() => {
    setTimeout(() => {
      setMounted(true);
      setClock(new Date().toISOString().slice(11, 19));
      setNow(Date.now());
    }, 0);
    const t = setInterval(
      () => {
        setClock(new Date().toISOString().slice(11, 19));
        setNow(Date.now());
      },
      1000
    );
    return () => clearInterval(t);
  }, []);

  const activeTask = tasks[selected] || null;

  // Auto-select newest task
  useEffect(() => {
    if (tasks.length > 0) setTimeout(() => setSelected(0), 0);
  }, [tasks.length]);

  return (
    <div className="h-screen overflow-hidden flex flex-col relative text-neutral-200">
      {/* ── TOP BAR ─────────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 w-full h-16 flex justify-between items-center px-6 z-50 bg-[#080808]/90 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-8">
          {/* Brand */}
          <Link href="/" className="flex flex-col leading-none">
            <h1 className="font-space text-xl font-black tracking-tight uppercase">
              <span className="text-white">SYNAPSE</span>
              <span className="text-[#F27D26]">-EDGE</span>
            </h1>
            <span className="font-space text-[8px] tracking-[0.35em] text-[#F27D26] font-bold uppercase">
              MISSION CONTROL
            </span>
          </Link>

          {/* Top Nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {[
              { label: "STRATEGY", href: "/" },
              { label: "LOGISTICS", href: "/logistics" },
              { label: "RESOURCES", href: "/resources" },
              { label: "ARCHIVE", href: "#" },
            ].map((link, i) => (
              <Link
                key={link.label}
                href={link.href}
                className={`font-space text-[10px] tracking-[0.15em] font-bold px-3 py-1.5 transition-all ${
                  i === 0
                    ? "text-[#F27D26] border-b border-[#F27D26]"
                    : "text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.03]"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {/* Auto-Pilot Toggle */}
          <button
            onClick={() => {
              setAutoPilot(!autoPilot);
              toast(
                autoPilot
                  ? "Auto-Pilot OFF — manual mode"
                  : "Auto-Pilot ENGAGED",
                { icon: autoPilot ? "🔴" : "🟢", duration: 3000 }
              );
            }}
            className={`font-space text-[9px] tracking-[0.2em] font-black px-3 py-1.5 border rounded-none transition-all cursor-pointer ${
              autoPilot
                ? "bg-[#F27D26]/10 border-[#F27D26]/40 text-[#F27D26] shadow-[0_0_12px_rgba(242,125,38,0.2)]"
                : "bg-white/[0.03] border-white/10 text-neutral-500 hover:text-neutral-300"
            }`}
          >
            AUTO-PILOT {autoPilot ? "ON" : "OFF"}
          </button>

          {/* UTC Clock */}
          <span className="font-space text-[10px] tracking-[0.15em] text-[#F27D26] font-bold hidden md:inline-block drop-shadow-[0_0_8px_rgba(242,125,38,0.5)]">
            {mounted ? `${clock} UTC` : "--:--:-- UTC"}
          </span>

          {/* Icon buttons */}
          <div className="flex gap-1 text-[#F27D26]">
            <button aria-label="Notifications" className="p-2 hover:bg-[#F27D26]/10 rounded-none transition-all active:scale-95">
              <Bell className="w-4 h-4" />
            </button>
            <button
              aria-label="Settings"
              onClick={() => router.push("/settings")}
              className="p-2 hover:bg-[#F27D26]/10 rounded-none transition-all active:scale-95"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              aria-label="Sign Out"
              onClick={async () => { await signOut(auth); router.push("/login"); }}
              className="p-2 hover:bg-red-500/10 hover:text-red-500 rounded-none transition-all active:scale-95"
            >
              <Power className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ── SIDEBAR + MAIN ──────────────────────────────────────── */}
      <div className="flex h-full pt-16">
        <Sidebar />

        <main className="ml-56 flex-1 h-[calc(100vh-64px)] overflow-y-auto p-5 flex flex-col gap-4">
          {/* ── STATUS INDICATORS ─────────────────────────────────── */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  isConnected
                    ? "bg-[#F27D26] shadow-[0_0_8px_#F27D26] animate-pulse"
                    : "bg-red-500"
                }`}
              />
              <span className="font-space text-[9px] tracking-[0.2em] text-[#F27D26] font-black uppercase">
                FIREBASE LIVE
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#F27D26] shadow-[0_0_8px_#F27D26] animate-pulse" />
              <span className="font-space text-[9px] tracking-[0.2em] text-[#F27D26] font-black uppercase">
                VECTOR SEARCH ONLINE
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  error
                    ? "bg-red-500 shadow-[0_0_8px_#ef4444]"
                    : "bg-[#F27D26] shadow-[0_0_8px_#F27D26] animate-pulse"
                }`}
              />
              <span
                className={`font-space text-[9px] tracking-[0.2em] font-black uppercase ${
                  error ? "text-red-500" : "text-[#F27D26]"
                }`}
              >
                SYNC STATUS {error ? "ERROR" : "LIVE"}
              </span>
            </div>
          </div>

          {/* ── METRIC CARDS ──────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="TOTAL TASKS" value={stats.total.toLocaleString()} />
            <StatCard
              label="INCOMING AI"
              value={`${stats.incoming || 84}/s`}
            />
            <StatCard
              label="ACTIVE MISSIONS"
              value={stats.dispatched}
            />
            <StatCard label="VOLUNTEERS" value={340} />
          </div>

          {/* ── MAIN 3-COLUMN GRID ────────────────────────────────── */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-[280px_1fr_260px] gap-4 min-h-0">
            {/* ── LEFT: Field Reports + Task Feed ─────────────────── */}
            <div className="flex flex-col gap-4 min-h-0">
              {/* Field Reports */}
              <div className="glass-panel rounded-none overflow-hidden flex flex-col flex-1 min-h-0 relative">
                {/* Scanline */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none z-10">
                  <div className="scan-line absolute inset-0" />
                </div>

                <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2 shrink-0">
                  <ChevronRight className="w-3 h-3 text-[#F27D26]" />
                  <h2 className="font-space text-[10px] tracking-[0.2em] text-white font-black uppercase">
                    FIELD REPORTS
                  </h2>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  <AnimatePresence mode="popLayout">
                    {tasks.map((task, idx) => (
                      <motion.button
                        key={task.id}
                        layout
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{
                          type: "spring",
                          stiffness: 500,
                          damping: 30,
                        }}
                        onClick={() => setSelected(idx)}
                        className={`w-full text-left p-3 rounded-none border transition-all duration-200 ${
                          idx === selected
                            ? "bg-[#F27D26]/5 border-[#F27D26]/30"
                            : "bg-transparent border-transparent hover:bg-white/[0.02] hover:border-white/5"
                        }`}
                      >
                        <div className="flex justify-between items-center mb-2">
                          <span
                            className={`font-space text-[9px] tracking-[0.2em] font-black uppercase ${
                              task.dispatched
                                ? "text-[#22c55e]"
                                : "text-neutral-500"
                            }`}
                          >
                            {task.dispatched ? "DISPATCHED" : "PENDING"}
                          </span>
                          <span className="text-[9px] font-space tracking-[0.1em] text-neutral-600">
                            T-
                            {task.createdAt
                              ? `${Math.floor(
                                  (now -
                                    task.createdAt.toMillis()) /
                                    60000
                                )}m`
                              : "0m"}
                          </span>
                        </div>
                        <p className="text-[11px] text-white font-bold leading-snug line-clamp-2 uppercase tracking-wide mb-2">
                          {task.raw_text?.slice(0, 60)}
                        </p>
                        <UrgencyBar level={task.urgency || 0} />
                      </motion.button>
                    ))}
                  </AnimatePresence>

                  {tasks.length === 0 && (
                    <p className="text-[10px] text-neutral-600 font-space tracking-[0.15em] p-3 animate-pulse uppercase">
                      {isConnected
                        ? "Awaiting field reports..."
                        : "Connecting to Firestore..."}
                    </p>
                  )}
                </div>
              </div>

              {/* Task Feed (Terminal Style) */}
              <div className="glass-panel rounded-none overflow-hidden h-40 flex flex-col shrink-0">
                <div className="px-4 py-2.5 border-b border-white/5 flex items-center gap-2 shrink-0">
                  <ChevronRight className="w-3 h-3 text-[#F27D26]" />
                  <h2 className="font-space text-[10px] tracking-[0.2em] text-white font-black uppercase">
                    TASK FEED
                  </h2>
                </div>
                <div className="flex-1 overflow-y-auto p-3 font-mono text-[10px] space-y-1">
                  {tasks.slice(0, 8).map((t) => (
                    <div key={t.id} className="flex gap-2 leading-tight">
                      <span
                        className={`shrink-0 font-bold ${
                          t.status === "incoming"
                            ? "text-[#F27D26]"
                            : t.dispatched
                            ? "text-[#22c55e]"
                            : "text-neutral-600"
                        }`}
                      >
                        [{t.status === "incoming" ? "WARN" : t.dispatched ? "SYS" : "AI"}]
                      </span>
                      <span className="text-neutral-500 line-clamp-1 flex-1">
                        {t.raw_text?.slice(0, 50)}
                      </span>
                    </div>
                  ))}
                  <div className="text-[#F27D26] mt-1">
                    {">"} AWAITING COMMAND..{" "}
                    <span className="inline-block w-2 h-3 bg-[#F27D26] animate-[cursor-blink_1s_step-end_infinite]" />
                  </div>
                </div>
              </div>
            </div>

            {/* ── CENTER: Tactical Map (Full Height) ────────────── */}
            <div className="flex flex-col gap-4 min-h-0">
              <div className="glass-panel rounded-none overflow-hidden relative flex-1 min-h-[500px]">
                {/* Scanline */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none z-20">
                  <div className="scan-line absolute inset-0" />
                </div>
                <Suspense
                  fallback={
                    <div className="h-full bg-[#0a0a0a] flex items-center justify-center">
                      <span className="text-[10px] font-space tracking-[0.2em] text-neutral-600 animate-pulse uppercase">
                        LOADING TACTICAL MAP...
                      </span>
                    </div>
                  }
                >
                  <CrisisMap
                    tasks={tasks}
                    height="100%"
                    onTaskClick={(taskId) => {
                      const idx = tasks.findIndex((t) => t.id === taskId);
                      if (idx !== -1) setSelected(idx);
                    }}
                  />
                </Suspense>
              </div>
            </div>

            {/* ── RIGHT: Vector Matching ──────────────────────────── */}
            <div className="flex flex-col gap-4 min-h-0">
              <div className="glass-panel rounded-none overflow-hidden flex flex-col flex-1 min-h-0">
                <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2 shrink-0">
                  <ChevronRight className="w-3 h-3 text-[#F27D26]" />
                  <h2 className="font-space text-[10px] tracking-[0.2em] text-white font-black uppercase">
                    MATCHES
                  </h2>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {activeTask?.matched_volunteer ? (
                    <>
                      <MatchCard
                        volunteer={activeTask.matched_volunteer}
                        rank={0}
                        onAccept={async () => {
                          const idToken = await auth.currentUser?.getIdToken();
                          if (!idToken) { toast.error("Not authenticated"); return; }
                          const res = await acceptMatch(activeTask.id, activeTask.matched_volunteer!.name, idToken);
                          if (res.success) toast.success("Volunteer accepted & dispatched", { icon: "✅" });
                          else toast.error(res.error || "Failed to accept");
                        }}
                        onReject={async () => {
                          const idToken = await auth.currentUser?.getIdToken();
                          if (!idToken) { toast.error("Not authenticated"); return; }
                          const res = await rejectMatch(activeTask.id, activeTask.matched_volunteer!.name, idToken);
                          if (res.success) toast("Volunteer rejected — next candidate promoted", { icon: "🔄" });
                          else toast.error(res.error || "Failed to reject");
                        }}
                      />
                      {(activeTask.all_matches || []).slice(1).map((m, i) => (
                        <MatchCard
                          key={m.name}
                          volunteer={m}
                          rank={i + 1}
                          onAccept={async () => {
                            const idToken = await auth.currentUser?.getIdToken();
                            if (!idToken) { toast.error("Not authenticated"); return; }
                            const res = await acceptMatch(activeTask.id, m.name, idToken);
                            if (res.success) toast.success(`${m.name} accepted & dispatched`, { icon: "✅" });
                            else toast.error(res.error || "Failed to accept");
                          }}
                          onReject={async () => {
                            const idToken = await auth.currentUser?.getIdToken();
                            if (!idToken) { toast.error("Not authenticated"); return; }
                            const res = await rejectMatch(activeTask.id, m.name, idToken);
                            if (res.success) toast(`${m.name} rejected`, { icon: "❌" });
                            else toast.error(res.error || "Failed to reject");
                          }}
                        />
                      ))}
                    </>
                  ) : activeTask ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                      {activeTask.status === "extracting" ||
                      activeTask.status === "matching" ? (
                        <>
                          <div className="h-6 w-6 border-2 border-[#F27D26] border-t-transparent rounded-full animate-spin" />
                          <p className="text-[10px] font-space tracking-[0.15em] text-neutral-500 uppercase">
                            {activeTask.status === "extracting"
                              ? "Extracting intent..."
                              : "Vector searching..."}
                          </p>
                        </>
                      ) : (
                        <>
                          <Zap className="w-6 h-6 text-[#F27D26]/50" />
                          <p className="text-[10px] font-space tracking-[0.15em] text-neutral-500 text-center uppercase">
                            {autoPilot
                              ? "Auto-pilot processing..."
                              : "Ready for AI"}
                          </p>
                          {!autoPilot && (
                            <button
                              onClick={() => processTask(activeTask)}
                              className="px-5 py-2 bg-[#F27D26] text-black font-space text-[9px] font-black tracking-[0.2em] uppercase rounded-none hover:bg-[#ff9040] transition-all active:scale-[0.97] shadow-[0_0_15px_rgba(242,125,38,0.3)]"
                            >
                              PROCESS AI
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-[10px] font-space tracking-[0.15em] text-neutral-700 uppercase">
                        No task selected
                      </p>
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
