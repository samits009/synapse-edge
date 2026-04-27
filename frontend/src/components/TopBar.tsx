"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { Bell, Settings, Power } from "lucide-react";

const TOP_LINKS = [
  { label: "STRATEGY", href: "/" },
  { label: "LOGISTICS", href: "/logistics" },
  { label: "RESOURCES", href: "/resources" },
  { label: "ARCHIVE", href: "#" },
];

export default function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [clock, setClock] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTimeout(() => {
      setMounted(true);
      setClock(new Date().toISOString().slice(11, 19));
    }, 0);
    const t = setInterval(
      () => setClock(new Date().toISOString().slice(11, 19)),
      1000
    );
    return () => clearInterval(t);
  }, []);

  const handleSignOut = async () => {
    await signOut(auth);
    router.push("/login");
  };

  return (
    <header className="fixed top-0 left-0 w-full h-16 flex justify-between items-center px-6 z-50 bg-[#080808]/90 backdrop-blur-xl border-b border-white/5">
      <div className="flex items-center gap-8">
        <Link href="/" className="flex flex-col leading-none">
          <h1 className="font-space text-xl font-black tracking-tight uppercase">
            <span className="text-white">SYNAPSE</span>
            <span className="text-[#F27D26]">-EDGE</span>
          </h1>
          <span className="font-space text-[8px] tracking-[0.35em] text-[#F27D26] font-bold uppercase">
            MISSION CONTROL
          </span>
        </Link>

        <nav className="hidden lg:flex items-center gap-1">
          {TOP_LINKS.map((link) => {
            const isActive =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href) && link.href !== "#";
            return (
              <Link
                key={link.label}
                href={link.href}
                className={`font-space text-[10px] tracking-[0.15em] font-bold px-3 py-1.5 transition-all ${
                  isActive
                    ? "text-[#F27D26] border-b border-[#F27D26]"
                    : "text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.03]"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center gap-3">
        <span className="font-space text-[10px] tracking-[0.15em] text-[#F27D26] font-bold hidden md:inline-block drop-shadow-[0_0_8px_rgba(242,125,38,0.5)]">
          {mounted ? `${clock} UTC` : "--:--:-- UTC"}
        </span>

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
            onClick={handleSignOut}
            className="p-2 hover:bg-red-500/10 hover:text-red-500 rounded-none transition-all active:scale-95"
          >
            <Power className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
