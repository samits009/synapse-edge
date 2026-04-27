"use client";

import React, { useMemo } from "react";
import { useTypewriter } from "@/hooks/useTypewriter";

/* ========================================================================
   TerminalBlock — AI Extraction Terminal Display
   ========================================================================
   Renders a JSON string with a character-by-character typewriter effect
   inside a command-center styled terminal window.

   Props:
     content   — The raw string (typically JSON) to type out
     title     — Terminal window title bar label
     speed     — Typing speed in ms per character (default 18)
     delay     — Delay before typing starts in ms (default 0)
     accent    — Color accent: "emerald" | "blue" | "violet" | "amber"
   ======================================================================== */

interface TerminalBlockProps {
  content: string;
  title?: string;
  speed?: number;
  delay?: number;
  accent?: "emerald" | "blue" | "violet" | "amber";
}

const ACCENT_MAP = {
  emerald: {
    dot: "bg-emerald-500",
    title: "text-emerald-500",
    cursor: "bg-emerald-500",
    glow: "shadow-[0_0_15px_rgba(16,185,129,0.06)]",
    border: "border-emerald-500/10",
    text: "text-emerald-300",
  },
  blue: {
    dot: "bg-blue-500",
    title: "text-blue-500",
    cursor: "bg-blue-500",
    glow: "shadow-[0_0_15px_rgba(59,130,246,0.06)]",
    border: "border-blue-500/10",
    text: "text-blue-300",
  },
  violet: {
    dot: "bg-violet-500",
    title: "text-violet-500",
    cursor: "bg-violet-500",
    glow: "shadow-[0_0_15px_rgba(139,92,246,0.06)]",
    border: "border-violet-500/10",
    text: "text-violet-300",
  },
  amber: {
    dot: "bg-amber-500",
    title: "text-amber-500",
    cursor: "bg-amber-500",
    glow: "shadow-[0_0_15px_rgba(245,158,11,0.06)]",
    border: "border-amber-500/10",
    text: "text-amber-300",
  },
};

export default function TerminalBlock({
  content,
  title = "GEMINI OUTPUT",
  speed = 18,
  delay = 0,
  accent = "emerald",
}: TerminalBlockProps) {
  const { displayText, isTyping } = useTypewriter(content, speed, delay);
  const theme = ACCENT_MAP[accent];

  // Line count for gutter numbers
  const lines = useMemo(() => displayText.split("\n"), [displayText]);

  return (
    <div
      className={`
        rounded-xl overflow-hidden
        bg-[#0a0f1a] border border-slate-800/60
        ${theme.glow}
        transition-shadow duration-700
      `}
    >
      {/* ── Title Bar ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/80 border-b border-slate-800/50">
        <div className="flex items-center gap-3">
          {/* macOS-style dots */}
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
          </div>
          <span className={`text-[10px] font-mono uppercase tracking-[0.2em] ${theme.title}`}>
            {title}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isTyping && (
            <span className="flex items-center gap-1.5 text-[9px] font-mono text-slate-500 uppercase tracking-widest">
              <span className={`w-1.5 h-1.5 rounded-full ${theme.dot} animate-pulse`} />
              streaming
            </span>
          )}
          {!isTyping && (
            <span className="text-[9px] font-mono text-slate-600 uppercase tracking-widest">
              complete
            </span>
          )}
        </div>
      </div>

      {/* ── Terminal Body ──────────────────────────────────────────── */}
      <div className="flex max-h-[400px] overflow-y-auto">
        {/* Line numbers gutter */}
        <div className="select-none py-4 pl-4 pr-3 text-right border-r border-slate-800/30 shrink-0">
          {lines.map((_, i) => (
            <div
              key={i}
              className="text-[11px] font-mono leading-[1.65] text-slate-700"
            >
              {i + 1}
            </div>
          ))}
        </div>

        {/* Code content */}
        <div className="flex-1 p-4 overflow-x-auto">
          <pre className={`text-[12px] font-mono leading-[1.65] whitespace-pre ${theme.text}`}>
            {displayText}
            {isTyping && (
              <span
                className={`
                  inline-block w-[7px] h-[14px] ml-[1px]
                  ${theme.cursor} opacity-90
                  animate-[cursor-blink_1s_step-end_infinite]
                `}
              />
            )}
          </pre>
        </div>
      </div>
    </div>
  );
}
