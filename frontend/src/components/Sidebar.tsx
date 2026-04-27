"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Flame,
  Truck,
  Package,
  Terminal,
  Brain,
  Shield,
  Cpu,
  HelpCircle,
  User,
} from "lucide-react";

const NAV_ITEMS = [
  { icon: Flame, label: "INCIDENTS", href: "/" },
  { icon: Truck, label: "LOGISTICS", href: "/logistics" },
  { icon: Package, label: "RESOURCES", href: "/resources" },
  { icon: Terminal, label: "TERMINAL", href: "/terminal" },
  { icon: Brain, label: "INTEL", href: "/intel" },
  { icon: Shield, label: "BUNKER", href: "/bunker" },
];

const BOTTOM_ITEMS = [
  { icon: Cpu, label: "DIAGNOSTICS", href: "#" },
  { icon: User, label: "SETTINGS", href: "/settings" },
  { icon: HelpCircle, label: "HELP", href: "#" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-16 bottom-0 w-56 flex flex-col z-40 bg-[#0a0a0a]/95 backdrop-blur-2xl border-r border-white/5">
      {/* System Node */}
      <div className="p-5 border-b border-white/5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-none bg-[#111] flex items-center justify-center border border-white/10">
            <User className="w-5 h-5 text-[#F27D26]" />
          </div>
          <div>
            <h2 className="text-[#F27D26] font-space text-xs font-bold tracking-[0.15em] uppercase">
              SYSTEM NODE
            </h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e] shadow-[0_0_6px_#22c55e] animate-pulse" />
              <span className="text-[9px] font-space tracking-[0.2em] text-[#22c55e] uppercase font-bold">
                STABLE
              </span>
            </div>
          </div>
        </div>
        <button aria-label="Deploy assets" className="w-full py-2.5 bg-[#F27D26] text-black font-space text-[10px] font-black tracking-[0.2em] uppercase rounded-none hover:bg-[#ff9040] transition-colors shadow-[0_0_20px_rgba(242,125,38,0.3)] hover:shadow-[0_0_30px_rgba(242,125,38,0.5)] active:scale-[0.98]">
          DEPLOY ASSETS
        </button>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 py-3 flex flex-col">
        {NAV_ITEMS.map((item) => {
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href) && item.href !== "#";
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-3 py-3 px-5 transition-all duration-200 group ${
                isActive
                  ? "bg-[#F27D26]/10 text-[#F27D26] border-l-2 border-[#F27D26]"
                  : "text-neutral-500 border-l-2 border-transparent hover:bg-white/[0.03] hover:text-neutral-300"
              }`}
            >
              <item.icon
                className={`w-4 h-4 ${
                  isActive
                    ? "text-[#F27D26] drop-shadow-[0_0_8px_rgba(242,125,38,0.8)]"
                    : "group-hover:text-neutral-300"
                }`}
              />
              <span
                className={`font-space text-[10px] tracking-[0.2em] font-bold ${
                  isActive ? "drop-shadow-[0_0_8px_rgba(242,125,38,0.5)]" : ""
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom Nav */}
      <div className="border-t border-white/5 py-3">
        {BOTTOM_ITEMS.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="flex items-center gap-3 py-2.5 px-5 text-neutral-600 hover:text-neutral-400 transition-colors group"
          >
            <item.icon className="w-4 h-4 group-hover:text-neutral-400" />
            <span className="font-space text-[10px] tracking-[0.2em] font-bold">
              {item.label}
            </span>
          </Link>
        ))}
      </div>
    </aside>
  );
}
