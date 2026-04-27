"use client";

import React, { useEffect, useRef } from "react";
import anime from "animejs";

export default function TopologicalBackground() {
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!gridRef.current) return;

    // Subtle breathing effect on the grid
    anime({
      targets: gridRef.current,
      opacity: [0.15, 0.25],
      duration: 8000,
      direction: "alternate",
      loop: true,
      easing: "easeInOutSine",
    });
  }, []);

  return (
    <div className="fixed inset-0 z-[-1] bg-slate-950 overflow-hidden pointer-events-none">
      {/* Base dark gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900/50 via-slate-950 to-black"></div>
      
      {/* Topological Grid Pattern */}
      <div 
        ref={gridRef}
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(255,255,255,0.02) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255,255,255,0.02) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
          maskImage: "radial-gradient(circle at center, black 40%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(circle at center, black 40%, transparent 80%)"
        }}
      ></div>

      {/* Ambient moving light orbs */}
      <div className="absolute top-1/4 left-1/4 w-[40vw] h-[40vw] bg-emerald-900/10 rounded-full blur-[120px] mix-blend-screen opacity-50 ambient-orb"></div>
      <div className="absolute bottom-1/4 right-1/4 w-[50vw] h-[50vw] bg-blue-900/10 rounded-full blur-[150px] mix-blend-screen opacity-40 ambient-orb-alt"></div>
    </div>
  );
}
