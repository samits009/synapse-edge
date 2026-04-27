"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import TopBar from "@/components/TopBar";
import Sidebar from "@/components/Sidebar";
import { Terminal as TerminalIcon } from "lucide-react";
import { motion } from "framer-motion";
import { auth } from "@/lib/firebase/config";
import { seedMockReports } from "@/app/actions/seedMockData";

const BOOT_SEQUENCE = [
  "INITIALIZING KERNEL...",
  "LOADING MODULE: NODE_01",
  "ESTABLISHING SECURE CONNECTION...",
  "HANDSHAKE ACCEPTED",
  "DECRYPTING LOGS...",
  "SYSTEM ONLINE. TYPE 'HELP' TO BEGIN."
];

export default function TerminalPage() {
  const [logs, setLogs] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const endOfLogsRef = useRef<HTMLDivElement>(null);

  const [fluxData] = useState(() => 
    [...Array(50)].map(() => ({
      height: Math.random() * 80 + 20,
      duration: Math.random() * 1.5 + 0.5
    }))
  );

  // Boot sequence
  useEffect(() => {
    let index = 0;
    const interval = setInterval(() => {
      if (index < BOOT_SEQUENCE.length) {
        setLogs((prev) => [...prev, BOOT_SEQUENCE[index]].slice(-200));
        index++;
      } else {
        clearInterval(interval);
      }
    }, 400); // 400ms delay between boot logs
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll
  useEffect(() => {
    endOfLogsRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const handleCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const cmd = input.trim().toUpperCase().slice(0, 100); // Limit command length
    const newLogs = [...logs, `> ${cmd}`];

    switch (cmd) {
      case "HELP":
        newLogs.push("AVAILABLE COMMANDS:");
        newLogs.push("  SCAN    - INITIATE DEEP SYSTEM SCAN");
        newLogs.push("  MESH    - VERIFY GRID INTEGRITY");
        newLogs.push("  STATUS  - SHOW SYSTEM STATUS");
        newLogs.push("  SEED    - LOAD MOCK FIELD REPORTS INTO FIRESTORE");
        newLogs.push("  CLEAR   - WIPE TERMINAL DISPLAY");
        break;
      case "SCAN":
        newLogs.push("SCANNING...");
        newLogs.push("NO ANOMALIES DETECTED IN SECTOR 4.");
        break;
      case "MESH":
        newLogs.push("PINGING MESH NODES...");
        newLogs.push("NODE_01: CONNECTED");
        newLogs.push("NODE_02: CONNECTED");
        newLogs.push("NODE_03: LATENCY 14MS");
        newLogs.push("GRID INTEGRITY: 100%");
        break;
      case "CLEAR":
        setLogs([]);
        setInput("");
        return;
      case "STATUS":
        newLogs.push("SYSTEM STATUS:");
        newLogs.push(`  USER: ${auth.currentUser?.email || "NOT AUTHENTICATED"}`);
        newLogs.push(`  UID: ${auth.currentUser?.uid?.slice(0, 16) || "N/A"}...`);
        newLogs.push(`  PROVIDER: ${auth.currentUser?.providerData?.[0]?.providerId || "N/A"}`);
        newLogs.push(`  KERNEL: SYNAPSE-EDGE v2.0.0`);
        newLogs.push(`  UPTIME: ${Math.floor(performance.now() / 1000)}s`);
        newLogs.push(`  MESH: STABLE`);
        break;
      case "SEED": {
        newLogs.push("INITIATING FIELD REPORT SEED...");
        setLogs(newLogs.slice(-200));
        setInput("");
        try {
          const idToken = await auth.currentUser?.getIdToken();
          if (!idToken) {
            setLogs((prev) => [...prev, "[ERROR] NOT AUTHENTICATED. SIGN IN FIRST."].slice(-200));
            return;
          }
          const result = await seedMockReports(idToken);
          if (result.success) {
            setLogs((prev) => [...prev, `[SUCCESS] ${result.count} FIELD REPORTS LOADED INTO FIRESTORE.`, "NAVIGATE TO INCIDENTS TO VIEW."].slice(-200));
          } else {
            setLogs((prev) => [...prev, `[ERROR] ${result.error}`].slice(-200));
          }
        } catch {
          setLogs((prev) => [...prev, "[ERROR] SEED OPERATION FAILED."].slice(-200));
        }
        return;
      }
      default:
        newLogs.push(`COMMAND NOT RECOGNIZED: '${cmd}'`);
    }

    setLogs(newLogs.slice(-200));
    setInput("");
  };

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-[#080808] text-neutral-200 font-mono selection:bg-[#F27D26] selection:text-black">
      <TopBar />
      <div className="flex h-full pt-16">
        <Sidebar />
        <main className="ml-56 flex-1 h-[calc(100vh-64px)] p-6 overflow-hidden flex flex-col">
          
          <div className="flex items-center justify-between mb-6 shrink-0">
            <div>
              <h1 className="font-space text-3xl font-black tracking-widest text-white uppercase flex items-center gap-3">
                <TerminalIcon className="w-8 h-8 text-[#F27D26]" />
                THE KERNEL
              </h1>
              <span className="text-[10px] tracking-[0.2em] text-[#F27D26] uppercase font-bold">
                {"// SYSTEM TERMINAL INTERFACE"}
              </span>
            </div>
          </div>

          {/* Terminal Console */}
          <div className="flex-1 flex flex-col border border-white/10 bg-[#0c0c0c] relative overflow-hidden glass-panel min-h-0">
            {/* Scanline Animation Overlay */}
            <div className="absolute inset-0 pointer-events-none opacity-20 z-10">
              <div className="scan-line absolute inset-0" />
            </div>

            <div className="flex-1 overflow-y-auto p-6 font-mono text-[12px] leading-relaxed text-[#44f6a3] custom-scrollbar tracking-wide relative z-20">
              {logs.map((log, i) => (
                <div key={`log-${i}-${(log ?? "").slice(0, 16)}`} className="mb-2 whitespace-pre-wrap">
                  {log}
                </div>
              ))}
              <div ref={endOfLogsRef} />
            </div>

            {/* Input Form */}
            <form onSubmit={handleCommand} className="flex items-center border-t border-white/10 bg-[#080808] p-4 relative z-20 shrink-0">
              <span className="text-[#F27D26] font-black mr-3 animate-pulse">{">"}</span>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="flex-1 bg-transparent border-none outline-none text-[#44f6a3] font-mono text-[12px] tracking-widest placeholder:text-neutral-700 uppercase"
                placeholder="AWAITING COMMAND..."
                autoFocus
                spellCheck={false}
                autoComplete="off"
              />
            </form>
          </div>

          {/* Log Flux Footer */}
          <div className="mt-6 border border-white/10 bg-[#0c0c0c] p-4 shrink-0 glass-panel">
            <div className="text-[9px] font-space tracking-[0.25em] text-neutral-500 font-bold uppercase mb-3">
              LOG FLUX // REAL-TIME SYSTEM ACTIVITY
            </div>
            <div className="flex items-end h-8 gap-[2px] w-full overflow-hidden">
              {fluxData.map((data, i) => (
                <motion.div
                  key={i}
                  className="w-full bg-[#F27D26]/60 border-t border-[#F27D26]"
                  initial={{ height: "10%" }}
                  animate={{
                    height: ["10%", `${data.height}%`, "10%"]
                  }}
                  transition={{
                    duration: data.duration,
                    repeat: Infinity,
                    repeatType: "mirror",
                    ease: "easeInOut"
                  }}
                />
              ))}
            </div>
          </div>

        </main>
      </div>
    </div>
  );
}
