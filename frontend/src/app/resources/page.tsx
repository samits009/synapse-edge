"use client";

import React, { useState } from "react";

import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";

/* ── COMPONENTS ────────────────────────────────────────────── */

function DeployButton({ label }: { label: string }) {
  const [status, setStatus] = useState<"idle" | "authorizing" | "deployed">("idle");

  const handleClick = () => {
    if (status !== "idle") return;
    setStatus("authorizing");
    setTimeout(() => {
      try {
        const audio = new Audio("/ping.wav");
        audio.volume = 0.5;
        audio.play().catch(() => {});
      } catch {}
      setStatus("deployed");
    }, 800);
  };

  return (
    <button
      onClick={handleClick}
      disabled={status !== "idle"}
      className={`w-full py-3 font-mono text-[10px] font-black tracking-[0.2em] uppercase rounded-none transition-all ${
        status === "idle"
          ? "bg-[#FF5A00] text-black hover:bg-[#ff7b33]"
          : status === "authorizing"
          ? "bg-[#FF5A00]/50 text-black animate-pulse cursor-wait"
          : "bg-green-500/10 text-green-500 border border-green-500/30 cursor-not-allowed"
      }`}
    >
      {status === "idle" && label}
      {status === "authorizing" && "AUTHORIZING..."}
      {status === "deployed" && "DEPLOYED"}
    </button>
  );
}

function PredictiveBurnCard({ name, pct, time, color = "#FF5A00" }: { name: string, pct: string, time: string, color?: string }) {
  return (
    <div className="border border-white/5 bg-slate-950 p-5 mb-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />
      <div className="flex justify-between items-center mb-6">
        <span className="font-mono text-[11px] text-white tracking-[0.15em] font-bold">{name}</span>
        <span className="font-mono text-[10px] font-bold" style={{ color }}>{pct}</span>
      </div>
      <div className="font-mono text-[9px] text-neutral-500 tracking-[0.2em] mb-1">EST. DEPLETION</div>
      <div className="font-space text-4xl font-black" style={{ color }}>{time}</div>
    </div>
  );
}

const DemandForecast = () => (
  <div className="border border-white/5 bg-slate-950 p-5 mt-auto h-40 flex flex-col relative overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />
    <span className="font-mono text-[9px] text-neutral-500 tracking-[0.2em] mb-4">DEMAND FORECAST</span>
    <div className="flex-1 w-full relative mt-2">
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="w-full h-full overflow-visible">
        <path d="M0,5 Q25,5 50,15 T100,35" fill="none" stroke="#FF5A00" strokeWidth="2" />
        <path d="M0,5 Q25,5 50,15 T100,35 L100,40 L0,40 Z" fill="url(#gradient)" opacity="0.15" />
        <defs>
          <linearGradient id="gradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#FF5A00" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  </div>
);

function SolutionMatchCard({ code, score, title, desc, tags }: { code: string, score: string, title: string, desc: string, tags: string[] }) {
  return (
    <div className="border border-white/5 bg-slate-950 p-5 mb-4 relative overflow-hidden flex flex-col gap-4">
      <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />
      <div className="flex justify-between items-start">
        <span className="font-mono text-[9px] text-neutral-500 tracking-[0.2em]">{code}</span>
        <span className="font-space text-sm font-black text-[#FF5A00]">{score}</span>
      </div>
      <div>
        <h3 className="font-space text-sm text-white font-black tracking-[0.1em] mb-2">{title}</h3>
        <p className="font-mono text-[10px] text-neutral-400 italic leading-relaxed">{desc}</p>
      </div>
      
      <div className="flex flex-wrap gap-2">
        {tags.map((t) => (
          <span key={t} className="px-2 py-1 border border-white/10 text-neutral-500 text-[8px] font-mono uppercase tracking-[0.15em] bg-white/[0.02]">{t}</span>
        ))}
      </div>
      
      <div className="mt-2">
        <DeployButton label="DEPLOY MATCH" />
      </div>
    </div>
  );
}

const ProgressBar = ({ label, pct }: { label: string, pct: number }) => (
  <div className="mb-4">
    <div className="flex justify-between text-[9px] font-mono tracking-[0.15em] text-neutral-400 mb-2">
      <span>{label}</span>
      <span>{pct}%</span>
    </div>
    <div className="h-1 w-full bg-white/5">
      <div className="h-full bg-[#FF5A00]" style={{ width: `${pct}%` }} />
    </div>
  </div>
);

/* ── PAGE ──────────────────────────────────────────────────── */

export default function ResourcesPage() {
  return (
    <div className="h-screen overflow-hidden flex flex-col bg-[#020617] text-neutral-200">
      <TopBar />
      <div className="flex h-full pt-16">
        <Sidebar />
        <main className="ml-56 flex-1 h-[calc(100vh-64px)] overflow-y-auto p-6">
          
          <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr_320px] gap-6 h-full min-h-[700px]">
            
            {/* ── LEFT: PREDICTIVE BURN ────────────────────────── */}
            <div className="flex flex-col min-h-0 h-full">
              <div className="flex items-center gap-2 mb-6 border-b border-white/5 pb-2">
                <span className="text-[#FF5A00] font-mono text-xs">↘</span>
                <h2 className="font-space text-[11px] tracking-[0.2em] text-white font-black uppercase">PREDICTIVE BURN</h2>
              </div>
              
              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar flex flex-col">
                <PredictiveBurnCard name="TRAUMA KITS" pct="18% L/H" time="42m" />
                <PredictiveBurnCard name="CLEAN WATER" pct="45% L/H" time="128m" />
                <PredictiveBurnCard name="FUEL (DIESEL)" pct="8% L/H" time="15m" color="#ef4444" />
                
                <DemandForecast />
              </div>
              
              <div className="mt-6 flex items-center gap-2 border-b border-white/5 pb-2">
                <span className="text-[#FF5A00] font-mono text-xs">$</span>
                <h2 className="font-space text-[11px] tracking-[0.2em] text-white font-black uppercase">BOUNTY LEDGER</h2>
              </div>
            </div>

            {/* ── CENTER: ASSET LIQUIDITY ──────────────────────── */}
            <div className="flex flex-col min-h-0 h-full">
              <div className="flex justify-between items-start mb-6 border-b border-white/5 pb-2">
                <h2 className="font-space text-[11px] tracking-[0.2em] text-[#FF5A00] font-black uppercase">ASSET LIQUIDITY</h2>
                <div className="text-right">
                  <div className="font-mono text-[8px] tracking-[0.2em] text-neutral-500 mb-1">CRITICALITY INDEX</div>
                  <div className="font-space text-2xl font-black text-white">0.84</div>
                </div>
              </div>

              <div className="mb-6">
                <h1 className="font-space text-5xl md:text-6xl font-black text-white tracking-widest leading-none mb-1">RESOURCE</h1>
                <h1 className="font-space text-5xl md:text-6xl font-black tracking-widest leading-none" style={{ WebkitTextStroke: "1px rgba(255,255,255,0.7)", color: "transparent" }}>PROJECTION</h1>
              </div>

              {/* Chart Area */}
              <div className="flex-1 min-h-[300px] border border-white/5 bg-slate-950 relative p-6 mb-6">
                <svg viewBox="0 0 800 300" className="w-full h-full overflow-visible">
                  {/* Grid lines */}
                  <path d="M0,60 L800,60 M0,120 L800,120 M0,180 L800,180 M0,240 L800,240" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                  
                  {/* Labels */}
                  <text x="-20" y="64" fill="#555" fontSize="10" fontFamily="monospace" textAnchor="end">100</text>
                  <text x="-20" y="124" fill="#555" fontSize="10" fontFamily="monospace" textAnchor="end">75</text>
                  <text x="-20" y="184" fill="#555" fontSize="10" fontFamily="monospace" textAnchor="end">50</text>
                  <text x="-20" y="244" fill="#555" fontSize="10" fontFamily="monospace" textAnchor="end">25</text>
                  <text x="-20" y="304" fill="#555" fontSize="10" fontFamily="monospace" textAnchor="end">0</text>

                  <text x="100" y="320" fill="#555" fontSize="10" fontFamily="monospace" textAnchor="middle">12:00</text>
                  <text x="250" y="320" fill="#555" fontSize="10" fontFamily="monospace" textAnchor="middle">13:00</text>
                  <text x="400" y="320" fill="#555" fontSize="10" fontFamily="monospace" textAnchor="middle">14:00</text>
                  <text x="550" y="320" fill="#555" fontSize="10" fontFamily="monospace" textAnchor="middle">15:00</text>
                  <text x="700" y="320" fill="#555" fontSize="10" fontFamily="monospace" textAnchor="middle">16:00</text>

                  {/* Step down line (Orange) */}
                  <path d="M100,60 L250,60 L250,120 L400,120 L400,180 L550,180 L550,240 L700,240" fill="none" stroke="#FF5A00" strokeWidth="2.5" />
                  
                  {/* Dotted line (Green Mitigation) */}
                  <path d="M100,60 L700,280" fill="none" stroke="#22c55e" strokeWidth="1.5" strokeDasharray="4,4" />
                  
                  {/* Nodes */}
                  <circle cx="100" cy="60" r="4" fill="#FF5A00" stroke="#020617" strokeWidth="2" />
                  <circle cx="250" cy="120" r="4" fill="#FF5A00" stroke="#020617" strokeWidth="2" />
                  <circle cx="400" cy="180" r="4" fill="#FF5A00" stroke="#020617" strokeWidth="2" />
                  <circle cx="550" cy="240" r="4" fill="#FF5A00" stroke="#020617" strokeWidth="2" />
                  <circle cx="700" cy="240" r="4" fill="#FF5A00" stroke="#020617" strokeWidth="2" />

                  <circle cx="250" cy="115" r="3" fill="#22c55e" />
                  <circle cx="400" cy="170" r="3" fill="#22c55e" />
                  <circle cx="550" cy="225" r="3" fill="#22c55e" />
                  <circle cx="700" cy="280" r="3" fill="#22c55e" />
                </svg>
              </div>

              {/* Bottom Panels */}
              <div className="grid grid-cols-2 gap-6 h-40 shrink-0">
                <div className="border border-white/5 bg-slate-950 p-5 flex flex-col justify-center">
                  <div className="font-mono text-[9px] text-neutral-500 tracking-[0.2em] mb-5">STOCK OVERVIEW</div>
                  <ProgressBar label="RATIONS" pct={23} />
                  <ProgressBar label="COTS" pct={54} />
                  <ProgressBar label="SANITATION" pct={85} />
                </div>
                <div className="border border-[#FF5A00]/20 bg-[#FF5A00]/5 p-5 flex flex-col justify-between">
                  <div>
                    <div className="font-mono text-[9px] text-[#FF5A00] tracking-[0.2em] mb-3 flex items-center gap-2">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin-slow">
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                      </svg>
                      ASSET SYNTHESIS
                    </div>
                    <p className="font-mono text-[10px] text-neutral-300 italic mb-2">Gemini detected ambulance shortage.</p>
                    <p className="font-mono text-[10px] text-white">
                      <span className="text-[#FF5A00] font-bold">Recommendation:</span> School Bus + Stadium Triage (Sector 7).
                    </p>
                  </div>
                  <DeployButton label="DEPLOY SYNTHESIS" />
                </div>
              </div>
            </div>

            {/* ── RIGHT: SOLUTION MATCH ────────────────────────── */}
            <div className="flex flex-col min-h-0 h-full">
              <div className="flex items-center gap-2 mb-6 border-b border-white/5 pb-2">
                <span className="text-[#FF5A00] font-mono text-xs">⬡</span>
                <h2 className="font-space text-[11px] tracking-[0.2em] text-white font-black uppercase">SOLUTION MATCH</h2>
              </div>
              
              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                <SolutionMatchCard 
                  code="AMB-GHOST"
                  score="84%"
                  title="SCHOOL BUS EVAC"
                  desc="Utilizing school bus for non-critical triage transport."
                  tags={["SECTOR 7", "TRANSPORT"]}
                />
                <SolutionMatchCard 
                  code="MED-POPUP"
                  score="92%"
                  title="STADIUM TRIAGE"
                  desc="Converting local stadium locker rooms into trauma stations."
                  tags={["SECTOR 7", "MEDICAL"]}
                />
              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}

