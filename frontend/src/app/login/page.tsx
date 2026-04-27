"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { Cpu, Satellite, Shield, Zap, Mail, Lock, ArrowRight } from "lucide-react";

type LoginStatus = "AWAITING_INPUT" | "DECRYPTING" | "GRANTED";
type AuthTab = "signin" | "signup";

const FEATURES = [
  { icon: Zap, title: "Real-Time Swarm Dispatch", desc: "AI-powered volunteer-to-crisis matching engine" },
  { icon: Satellite, title: "Mesh Network Sync", desc: "Global state synchronization via Firebase" },
  { icon: Shield, title: "Tactical Intelligence", desc: "Gemini-driven threat analysis & prediction" },
  { icon: Cpu, title: "Kernel Terminal", desc: "Direct system access & diagnostics interface" },
];

export default function LoginPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AuthTab>("signin");
  const [nodeId, setNodeId] = useState("");
  const [passkey, setPasskey] = useState("");
  const [error, setError] = useState("");
  const [loginStatus, setLoginStatus] = useState<LoginStatus>("AWAITING_INPUT");
  const [showPassword, setShowPassword] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState(0);

  const MAX_ATTEMPTS = 5;
  const LOCKOUT_DURATION_MS = 30_000; // 30 seconds

  const handleHandshake = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Brute-force protection
    if (Date.now() < lockoutUntil) {
      const remaining = Math.ceil((lockoutUntil - Date.now()) / 1000);
      setError(`[SYS_LOCKOUT] NODE FROZEN — RETRY IN ${remaining}s`);
      return;
    }

    setLoginStatus("DECRYPTING");

    try {
      if (activeTab === "signup") {
        await createUserWithEmailAndPassword(auth, nodeId, passkey);
      } else {
        await signInWithEmailAndPassword(auth, nodeId, passkey);
      }

      setLoginStatus("GRANTED");
      setAttempts(0); // Reset on success

      try {
        const audio = new Audio("/ping.wav");
        audio.volume = 0.4;
        audio.play().catch(() => {});
      } catch {}

      setTimeout(() => {
        router.push("/");
      }, 800);
    } catch (err: unknown) {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      setLoginStatus("AWAITING_INPUT");

      // Parse Firebase error code for user-friendly messages
      const code = (err as { code?: string })?.code || "";

      if (newAttempts >= MAX_ATTEMPTS) {
        setLockoutUntil(Date.now() + LOCKOUT_DURATION_MS);
        setError(`[SYS_LOCKOUT] TOO MANY ATTEMPTS — FROZEN FOR 30 SECONDS`);
      } else if (code === "auth/email-already-in-use") {
        setError(`[SYS_ERR] NODE ALREADY REGISTERED — SWITCH TO SIGN IN`);
      } else if (code === "auth/weak-password") {
        setError(`[SYS_ERR] PASSKEY TOO WEAK — MINIMUM 6 CHARACTERS`);
      } else if (code === "auth/invalid-email") {
        setError(`[SYS_ERR] INVALID NODE IDENTIFIER FORMAT`);
      } else {
        setError(`[SYS_ERR] UNAUTHORIZED NODE (${MAX_ATTEMPTS - newAttempts} ATTEMPTS REMAINING)`);
      }
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setLoginStatus("DECRYPTING");
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      setLoginStatus("GRANTED");

      try {
        const audio = new Audio("/ping.wav");
        audio.volume = 0.4;
        audio.play().catch(() => {});
      } catch {}

      setTimeout(() => {
        router.push("/");
      }, 800);
    } catch {
      setLoginStatus("AWAITING_INPUT");
      setError("[SYS_ERR] PROVIDER HANDSHAKE FAILED");
    }
  };

  const buttonText =
    loginStatus === "DECRYPTING"
      ? activeTab === "signup" ? "REGISTERING NODE..." : "VERIFYING KEY SIGNATURE..."
      : loginStatus === "GRANTED"
      ? "ACCESS GRANTED"
      : activeTab === "signup" ? "REGISTER NODE" : "INITIATE UPLINK";

  const isDisabled = loginStatus !== "AWAITING_INPUT";

  return (
    <div className="relative min-h-screen bg-[#080808] flex font-mono selection:bg-[#FF5A00] selection:text-black">

      {/* ─── FULL-PAGE LOGO BACKGROUND ─── */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: "url('/logo-bg.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          opacity: 0.06,
        }}
      />

      {/* ─── LEFT PANEL: BRANDING ─── */}
      <div className="hidden lg:flex lg:w-[45%] relative flex-col justify-between p-12 overflow-hidden">
        {/* Subtle radial glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(255,90,0,0.06)_0%,transparent_60%)] pointer-events-none" />
        {/* Grid overlay */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,90,0,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,90,0,0.5) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        <div className="relative z-10">
          {/* Logo */}
          <div className="w-14 h-14 bg-[#FF5A00]/10 border border-[#FF5A00]/30 flex items-center justify-center mb-8 overflow-hidden">
            <img src="/favicon.png" alt="SynapseEdge" className="w-10 h-10 object-contain" />
          </div>

          <h1 className="font-space text-4xl font-black tracking-[0.1em] text-white uppercase leading-none mb-3">
            Synapse<span className="text-[#FF5A00]">Edge</span>
          </h1>
          <p className="text-[11px] text-neutral-500 tracking-[0.15em] uppercase font-bold max-w-xs leading-relaxed">
            Tactical crisis response orchestration for the modern battlefield
          </p>

          {/* Feature List */}
          <div className="mt-14 space-y-6">
            {FEATURES.map((feat) => (
              <div key={feat.title} className="flex items-start gap-4 group">
                <div className="w-9 h-9 bg-[#111] border border-white/5 flex items-center justify-center shrink-0 group-hover:border-[#FF5A00]/30 transition-colors">
                  <feat.icon className="w-4 h-4 text-[#FF5A00]/70" />
                </div>
                <div>
                  <h3 className="text-[11px] font-black text-white tracking-[0.1em] uppercase mb-0.5">
                    {feat.title}
                  </h3>
                  <p className="text-[10px] text-neutral-600 tracking-wide">
                    {feat.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom trust line */}
        <div className="relative z-10 flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-[#FF5A00] shadow-[0_0_6px_#FF5A00] animate-pulse" />
          <span className="text-[8px] text-neutral-600 tracking-[0.2em] uppercase">
            Trusted by <span className="text-[#FF5A00] font-bold">10,000+</span> operators worldwide
          </span>
        </div>
      </div>

      {/* ─── RIGHT PANEL: AUTH FORM ─── */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 relative">
        {/* Vertical divider on desktop */}
        <div className="hidden lg:block absolute left-0 top-[10%] bottom-[10%] w-[1px] bg-gradient-to-b from-transparent via-white/5 to-transparent" />

        <div className="w-full max-w-[420px]">
          {/* Tab Switcher */}
          <div className="flex mb-10 border border-white/10 bg-[#0c0c0c] rounded-none overflow-hidden">
            <button
              onClick={() => setActiveTab("signin")}
              className={`flex-1 py-3 text-[10px] font-black tracking-[0.25em] uppercase transition-all ${
                activeTab === "signin"
                  ? "bg-[#FF5A00] text-black"
                  : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              SIGN IN
            </button>
            <button
              onClick={() => setActiveTab("signup")}
              className={`flex-1 py-3 text-[10px] font-black tracking-[0.25em] uppercase transition-all ${
                activeTab === "signup"
                  ? "bg-[#FF5A00] text-black"
                  : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              SIGN UP
            </button>
          </div>

          {/* Welcome Header */}
          <div className="mb-10">
            <h2 className="text-2xl font-black text-white tracking-[0.05em] uppercase mb-2 font-space">
              {activeTab === "signin" ? "Welcome back." : "Create Node."}
            </h2>
            <p className="text-[10px] text-neutral-500 tracking-[0.15em] uppercase">
              {activeTab === "signin"
                ? "Enter credentials to access your node"
                : "Register a new operator identity"}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleHandshake} className="space-y-7">
            {/* Email */}
            <div>
              <label className="block text-[9px] text-neutral-400 tracking-[0.25em] font-bold uppercase mb-2.5">
                EMAIL ADDRESS
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600" />
                <input
                  type="email"
                  value={nodeId}
                  onChange={(e) => setNodeId(e.target.value)}
                  required
                  disabled={isDisabled}
                  spellCheck={false}
                  autoComplete="email"
                  placeholder="operator@synapse.edge"
                  className="w-full bg-[#111] border border-white/10 text-white text-[12px] tracking-wider pl-12 pr-4 py-3.5 placeholder:text-neutral-700 outline-none focus:border-[#FF5A00]/60 transition-colors rounded-none disabled:opacity-40"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-[9px] text-neutral-400 tracking-[0.25em] font-bold uppercase mb-2.5">
                PASSWORD
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={passkey}
                  onChange={(e) => setPasskey(e.target.value)}
                  required
                  disabled={isDisabled}
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  className="w-full bg-[#111] border border-white/10 text-white text-[12px] tracking-[0.3em] pl-12 pr-12 py-3.5 placeholder:text-neutral-700 outline-none focus:border-[#FF5A00]/60 transition-colors rounded-none disabled:opacity-40"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[8px] text-neutral-600 hover:text-[#FF5A00] tracking-widest uppercase transition-colors"
                >
                  {showPassword ? "HIDE" : "SHOW"}
                </button>
              </div>
            </div>

            {/* Remember / Forgot */}
            <div className="flex justify-between items-center">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input type="checkbox" className="sr-only peer" />
                <div className="w-3.5 h-3.5 border border-white/10 bg-[#111] peer-checked:bg-[#FF5A00] peer-checked:border-[#FF5A00] transition-colors" />
                <span className="text-[9px] text-neutral-500 tracking-widest uppercase group-hover:text-neutral-300 transition-colors">
                  REMEMBER ME
                </span>
              </label>
              <button type="button" className="text-[9px] text-[#FF5A00]/70 tracking-widest uppercase hover:text-[#FF5A00] transition-colors">
                FORGOT PASSWORD?
              </button>
            </div>

            {/* Error */}
            {error && (
              <div className="text-red-500 text-[10px] font-bold tracking-[0.1em] uppercase p-3 border border-red-500/20 bg-red-500/5">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isDisabled}
              className={`w-full py-4 text-[11px] font-black tracking-[0.2em] uppercase rounded-none flex items-center justify-center gap-3 transition-all duration-200 ${
                loginStatus === "GRANTED"
                  ? "bg-emerald-500 text-black shadow-[0_0_24px_rgba(16,185,129,0.3)]"
                  : loginStatus === "DECRYPTING"
                  ? "bg-[#FF5A00]/50 text-black cursor-wait animate-pulse"
                  : "bg-[#FF5A00] text-black hover:bg-[#e04d00] active:scale-[0.98] shadow-[0_0_20px_rgba(255,90,0,0.2)] hover:shadow-[0_0_30px_rgba(255,90,0,0.4)]"
              }`}
            >
              {buttonText}
              {loginStatus === "AWAITING_INPUT" && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4 my-8">
            <div className="flex-1 h-[1px] bg-white/5" />
            <span className="text-[8px] text-neutral-600 tracking-[0.25em] uppercase font-bold">
              OR CONTINUE WITH
            </span>
            <div className="flex-1 h-[1px] bg-white/5" />
          </div>

          {/* Social Buttons */}
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={handleGoogleSignIn}
              disabled={isDisabled}
              className="flex items-center justify-center gap-2.5 py-3 border border-white/10 bg-[#0c0c0c] hover:border-white/20 hover:bg-[#111] transition-all rounded-none disabled:opacity-40"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84Z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z" fill="#EA4335"/>
              </svg>
              <span className="text-[10px] text-neutral-400 font-bold tracking-[0.1em] uppercase">
                GOOGLE
              </span>
            </button>
            <button
              disabled={isDisabled}
              className="flex items-center justify-center gap-2.5 py-3 border border-white/10 bg-[#0c0c0c] hover:border-white/20 hover:bg-[#111] transition-all rounded-none disabled:opacity-40 cursor-not-allowed"
            >
              <Shield className="w-4 h-4 text-neutral-500" />
              <span className="text-[10px] text-neutral-400 font-bold tracking-[0.1em] uppercase">
                SSO
              </span>
            </button>
          </div>

          {/* Footer */}
          <p className="text-center mt-8 text-[9px] text-neutral-600 tracking-widest uppercase">
            {activeTab === "signin" ? (
              <>
                NO NODE? <button onClick={() => setActiveTab("signup")} className="text-[#FF5A00] font-bold hover:underline underline-offset-4">REGISTER</button>
              </>
            ) : (
              <>
                EXISTING OPERATOR? <button onClick={() => setActiveTab("signin")} className="text-[#FF5A00] font-bold hover:underline underline-offset-4">SIGN IN</button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
