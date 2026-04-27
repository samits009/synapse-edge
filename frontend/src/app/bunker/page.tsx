"use client";

import React, { useState } from "react";
import TopBar from "@/components/TopBar";
import Sidebar from "@/components/Sidebar";
import { Shield, Fingerprint, Lock, Unlock, Database, Cpu, HardDrive } from "lucide-react";

type VaultState = "locked" | "authenticating" | "unlocked";

const ASSETS = [
  { id: "V-99", name: "GEMINI KERNEL SOURCE", type: "CRITICAL DATA", icon: Database },
  { id: "V-42", name: "OFFLINE MESH SCHEMATICS", type: "BLUEPRINTS", icon: Cpu },
  { id: "V-07", name: "ENCRYPTED VOLUNTEER DB", type: "USER DATA", icon: HardDrive },
  { id: "V-12", name: "SATELLITE OVERRIDE CODES", type: "SECURITY", icon: Lock },
];

export default function BunkerPage() {
  const [vaultState, setVaultState] = useState<VaultState>("locked");

  const handleAuthenticate = () => {
    if (vaultState !== "locked") return;
    setVaultState("authenticating");
    setTimeout(() => {
      setVaultState("unlocked");
    }, 2000);
  };

  const handleLockdown = () => {
    setVaultState("locked");
  };

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-[#080808] text-neutral-200 font-mono selection:bg-[#F27D26] selection:text-black">
      <TopBar />
      <div className="flex h-full pt-16">
        <Sidebar />
        <main className="ml-56 flex-1 h-[calc(100vh-64px)] p-6 overflow-hidden flex flex-col items-center justify-center relative">
          
          <div className="absolute top-6 left-6 flex items-center gap-3">
            <Shield className={`w-8 h-8 ${vaultState === 'unlocked' ? 'text-[#44f6a3]' : 'text-red-500'}`} />
            <div>
              <h1 className="font-space text-3xl font-black tracking-widest text-white uppercase leading-none">
                THE BUNKER
              </h1>
              <span className={`text-[10px] tracking-[0.2em] font-bold uppercase ${vaultState === 'unlocked' ? 'text-[#44f6a3]' : 'text-red-500'}`}>
                {"// SECURE LOCKBOX"}
              </span>
            </div>
          </div>

          {/* STATE: LOCKED or AUTHENTICATING */}
          {(vaultState === "locked" || vaultState === "authenticating") && (
            <div className="flex flex-col items-center gap-8">
              <div 
                className="relative cursor-pointer group"
                onClick={handleAuthenticate}
              >
                {/* Rotating Glowing Borders */}
                {vaultState === "authenticating" && (
                  <>
                    <div className="absolute -inset-4 border-2 border-[#44f6a3]/50 rounded-full animate-[spin_2s_linear_infinite]" />
                    <div className="absolute -inset-8 border-2 border-dashed border-[#F27D26]/50 rounded-full animate-[spin_3s_linear_infinite_reverse]" />
                    <div className="absolute inset-0 bg-[#44f6a3]/10 rounded-full animate-pulse blur-xl" />
                  </>
                )}
                
                <div className={`w-32 h-32 rounded-full border-4 flex items-center justify-center transition-all duration-300 ${
                  vaultState === "authenticating" 
                    ? "border-[#44f6a3] shadow-[0_0_30px_rgba(68,246,163,0.4)] bg-[#44f6a3]/5" 
                    : "border-neutral-800 bg-[#0c0c0c] group-hover:border-neutral-600"
                }`}>
                  <Fingerprint className={`w-16 h-16 ${vaultState === "authenticating" ? "text-[#44f6a3] animate-pulse" : "text-neutral-500"}`} />
                </div>
              </div>
              
              <div className="text-center font-space">
                <div className="text-2xl font-black tracking-widest text-white uppercase mb-2">
                  {vaultState === "authenticating" ? "AUTHENTICATING..." : "SECURE VAULT ENTRY"}
                </div>
                <div className="text-[10px] tracking-[0.2em] text-neutral-500 uppercase">
                  {vaultState === "authenticating" ? "VERIFYING BIOMETRIC HASH" : "AWAITING CLEARANCE"}
                </div>
              </div>
            </div>
          )}

          {/* STATE: UNLOCKED */}
          {vaultState === "unlocked" && (
            <div className="w-full max-w-4xl flex flex-col gap-10 mt-12 animate-fade-in-up">
              
              {/* Secured Assets Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {ASSETS.map((asset) => (
                  <div key={asset.id} className="border border-white/10 bg-[#0c0c0c] p-6 glass-panel flex items-start gap-5 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-r from-[#44f6a3]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    
                    <div className="w-12 h-12 bg-[#111] border border-white/10 flex items-center justify-center shrink-0">
                      <asset.icon className="w-6 h-6 text-[#44f6a3]" />
                    </div>
                    
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-[10px] font-black tracking-widest text-[#44f6a3] px-1.5 py-0.5 bg-[#44f6a3]/10 border border-[#44f6a3]/20">
                          {asset.id}
                        </span>
                        <span className="text-[9px] font-bold text-neutral-500 tracking-[0.2em] uppercase">
                          {asset.type}
                        </span>
                      </div>
                      <h3 className="font-space text-sm font-black text-white uppercase tracking-widest leading-tight">
                        {asset.name}
                      </h3>
                    </div>
                  </div>
                ))}
              </div>

              {/* Lockdown Button */}
              <div className="flex justify-center mt-8">
                <button
                  onClick={handleLockdown}
                  className="bg-red-600 text-black font-space text-xl font-black tracking-[0.3em] uppercase px-16 py-6 border-2 border-red-500 shadow-[8px_8px_0_#ef4444] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[6px_6px_0_#ef4444] active:translate-x-[8px] active:translate-y-[8px] active:shadow-none transition-all duration-75 flex items-center gap-4 group"
                >
                  <Unlock className="w-6 h-6 group-hover:hidden" />
                  <Lock className="w-6 h-6 hidden group-hover:block" />
                  INITIATE LOCKDOWN
                </button>
              </div>

            </div>
          )}

        </main>
      </div>
    </div>
  );
}
