"use client";

import React, { useState, useEffect } from "react";
import TopBar from "@/components/TopBar";
import Sidebar from "@/components/Sidebar";
import { Brain, Activity, Radio, AlertTriangle } from "lucide-react";

const MEMOS = [
  { id: "INT-849", type: "HF-INTERCEPT", threat: "CRITICAL", text: "UNIDENTIFIED ASSET MOVEMENT IN SECTOR 7. PROBABLE MESH INTERFERENCE DETECTED.", time: "08:14:22 UTC" },
  { id: "INT-848", type: "AI-PREDICT", threat: "HIGH", text: "WEATHER PATTERN SHIFT INDICATES 84% CHANCE OF FLASH FLOODING AT PRIMARY EXTRACTION POINT.", time: "08:11:05 UTC" },
  { id: "INT-847", type: "SYS-LOG", threat: "LOW", text: "ROUTINE MESH HANDSHAKE COMPLETED FOR SQUAD-ALPHA.", time: "08:05:41 UTC" },
  { id: "INT-846", type: "HF-INTERCEPT", threat: "HIGH", text: "COMMUNICATION DROP EXPECTED IN THE VALLEY. RECOMMEND SWITCH TO SAT-LINK.", time: "07:54:19 UTC" },
  { id: "INT-845", type: "AI-PREDICT", threat: "LOW", text: "RESOURCE DEPLETION ALGORITHM NOMINAL. SUPPLY LINES SECURE.", time: "07:42:00 UTC" },
];

export default function IntelPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTimeout(() => setMounted(true), 0);
  }, []);

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-[#080808] text-neutral-200 font-mono selection:bg-[#F27D26] selection:text-black">
      <TopBar />
      <div className="flex h-full pt-16">
        <Sidebar />
        <main className="ml-56 flex-1 h-[calc(100vh-64px)] p-6 overflow-hidden flex flex-col">
          
          <div className="flex items-center justify-between mb-8 shrink-0">
            <div>
              <h1 className="font-space text-3xl font-black tracking-widest text-white uppercase flex items-center gap-3">
                <Brain className="w-8 h-8 text-[#44f6a3]" />
                INTEL DB
              </h1>
              <span className="text-[10px] tracking-[0.2em] text-[#44f6a3] uppercase font-bold">
                {"// STRATEGIC SYNTHESIS"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
            
            {/* Left Column: Hero & Gauges */}
            <div className="col-span-1 lg:col-span-2 flex flex-col gap-6 min-h-0">
              
              {/* Hero Element */}
              <div className="border border-white/10 bg-[#0c0c0c] p-10 flex flex-col items-center justify-center relative overflow-hidden glass-panel shrink-0 h-48">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(68,246,163,0.05)_0%,rgba(0,0,0,0)_70%)] pointer-events-none" />
                <h1 className="text-6xl md:text-7xl font-space font-black tracking-tighter uppercase leading-none z-10 text-center">
                  <span className="text-white">GEMINI</span><br/>
                  {/* Transparent stroke technique */}
                  <span className="text-transparent" style={{ WebkitTextStroke: "2px #44f6a3" }}>SYNTHETIX</span>
                </h1>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 min-h-0">
                {/* Strategic Analysis Card */}
                <div className="border border-white/10 bg-[#0c0c0c] p-6 relative glass-panel flex flex-col">
                  <div className="flex items-center gap-2 mb-6 border-b border-white/5 pb-3">
                    <Activity className="w-4 h-4 text-[#44f6a3]" />
                    <h2 className="text-[11px] font-space tracking-[0.25em] text-white font-black uppercase">STRATEGIC ANALYSIS</h2>
                  </div>
                  
                  <div className="flex-1 flex flex-col justify-center space-y-6">
                    <div>
                      <div className="flex justify-between text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2">
                        <span>THREAT PROBABILITY</span>
                        <span className="text-[#F27D26]">84.2%</span>
                      </div>
                      <div className="w-full bg-neutral-900 h-1.5">
                        <div className="bg-[#F27D26] h-full" style={{ width: "84.2%" }} />
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex justify-between text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2">
                        <span>GRID STABILITY</span>
                        <span className="text-[#44f6a3]">92.1%</span>
                      </div>
                      <div className="w-full bg-neutral-900 h-1.5">
                        <div className="bg-[#44f6a3] h-full" style={{ width: "92.1%" }} />
                      </div>
                    </div>
                    
                    <div className="mt-4 p-4 border border-white/5 bg-[#111]">
                      <p className="text-[10px] text-neutral-400 uppercase tracking-widest leading-loose">
                        AI CONSENSUS: Maintain holding pattern in Sector 7. Await further telemetry from Drone-01 before committing ground assets.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Threat Vector Radar Gauge */}
                <div className="border border-white/10 bg-[#0c0c0c] p-6 relative glass-panel flex flex-col items-center justify-center overflow-hidden">
                  <div className="absolute top-6 left-6 flex items-center gap-2 border-b border-white/5 pb-2 w-[calc(100%-48px)]">
                    <Radio className="w-4 h-4 text-[#F27D26]" />
                    <h2 className="text-[11px] font-space tracking-[0.25em] text-white font-black uppercase">THREAT VECTOR</h2>
                  </div>

                  <div className="relative w-48 h-48 mt-8 flex items-center justify-center">
                    {/* Outer Ring */}
                    <div className={`absolute inset-0 rounded-full border border-[#F27D26]/20 border-dashed ${mounted ? 'animate-[spin_20s_linear_infinite]' : ''}`} />
                    {/* Middle Ring */}
                    <div className={`absolute inset-4 rounded-full border border-[#44f6a3]/20 border-dotted ${mounted ? 'animate-[spin_15s_linear_infinite_reverse]' : ''}`} />
                    {/* Inner Ring */}
                    <div className="absolute inset-12 rounded-full border border-white/10" />
                    
                    {/* Radar Sweep */}
                    <div className={`absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,transparent_0deg,rgba(68,246,163,0.1)_90deg,transparent_90deg)] ${mounted ? 'animate-[spin_4s_linear_infinite]' : ''}`} />
                    
                    {/* Center Point */}
                    <div className="w-2 h-2 rounded-full bg-white shadow-[0_0_10px_white]" />

                    {/* Plotted Blips */}
                    <div className="absolute top-10 left-12 w-2 h-2 rounded-full bg-[#F27D26] animate-pulse shadow-[0_0_8px_#F27D26]" />
                    <div className="absolute bottom-16 right-10 w-2 h-2 rounded-full bg-[#44f6a3] animate-pulse shadow-[0_0_8px_#44f6a3]" />
                    <div className="absolute top-20 right-14 w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Intelligence Stream */}
            <div className="flex flex-col border border-white/10 bg-[#0c0c0c] glass-panel min-h-0">
              <div className="p-6 border-b border-white/5 flex items-center gap-2 shrink-0">
                <AlertTriangle className="w-4 h-4 text-[#F27D26]" />
                <h2 className="text-[11px] font-space tracking-[0.25em] text-white font-black uppercase">INTELLIGENCE STREAM</h2>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-3">
                {MEMOS.map((memo) => {
                  const getBadgeColor = (threat: string) => {
                    if (threat === "CRITICAL") return "bg-red-500/10 text-red-500 border-red-500/30";
                    if (threat === "HIGH") return "bg-[#F27D26]/10 text-[#F27D26] border-[#F27D26]/30";
                    return "bg-[#44f6a3]/10 text-[#44f6a3] border-[#44f6a3]/30";
                  };

                  return (
                    <div key={memo.id} className="border border-white/5 bg-[#111] p-4 flex flex-col gap-3 relative group hover:border-white/10 transition-colors">
                      <div className="flex justify-between items-start">
                        <span className="text-[9px] font-black text-white tracking-[0.1em]">{memo.id} {"//"} {memo.type}</span>
                        <span className={`text-[8px] font-black tracking-widest px-2 py-0.5 border ${getBadgeColor(memo.threat)}`}>
                          {memo.threat}
                        </span>
                      </div>
                      <p className="text-[10px] text-neutral-400 tracking-wide leading-relaxed uppercase font-mono">
                        {memo.text}
                      </p>
                      <div className="text-[8px] text-neutral-600 tracking-widest text-right mt-1">
                        {memo.time}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

        </main>
      </div>
    </div>
  );
}
