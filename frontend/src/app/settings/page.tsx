"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  updateProfile,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  deleteUser,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import TopBar from "@/components/TopBar";
import Sidebar from "@/components/Sidebar";
import {
  User as UserIcon,
  Mail,
  Shield,
  Lock,
  Trash2,
  LogOut,
  Save,
  AlertTriangle,
  CheckCircle,
  Camera,
} from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Profile form
  const [displayName, setDisplayName] = useState("");
  const [photoURL, setPhotoURL] = useState("");

  // Password form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Status
  const [profileStatus, setProfileStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [passwordStatus, setPasswordStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        router.push("/login");
        return;
      }
      setUser(firebaseUser);
      setDisplayName(firebaseUser.displayName || "");
      setPhotoURL(firebaseUser.photoURL || "");
      setLoading(false);
    });
    return () => unsub();
  }, [router]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setProfileStatus("saving");
    try {
      await updateProfile(user, {
        displayName: displayName.trim() || null,
        photoURL: photoURL.trim() || null,
      });
      setProfileStatus("saved");
      setTimeout(() => setProfileStatus("idle"), 3000);
    } catch {
      setProfileStatus("error");
    }
  };

  const handleChangePassword = async () => {
    if (!user || !user.email) return;
    setPasswordStatus("saving");
    setStatusMessage("");

    if (newPassword.length < 6) {
      setStatusMessage("Passkey must be at least 6 characters.");
      setPasswordStatus("error");
      return;
    }
    if (newPassword !== confirmPassword) {
      setStatusMessage("Passkeys do not match.");
      setPasswordStatus("error");
      return;
    }

    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      setPasswordStatus("saved");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setStatusMessage("Passkey updated successfully.");
      setTimeout(() => {
        setPasswordStatus("idle");
        setStatusMessage("");
      }, 3000);
    } catch {
      setPasswordStatus("error");
      setStatusMessage("Re-authentication failed. Check current passkey.");
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    try {
      await deleteUser(user);
      router.push("/login");
    } catch {
      setStatusMessage("Re-authentication required. Sign out, sign in again, then retry.");
      setShowDeleteConfirm(false);
    }
  };

  const handleSignOut = async () => {
    await auth.signOut();
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="h-screen bg-[#080808] flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-[#F27D26] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const initials = (displayName || user?.email || "U")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-[#080808] text-neutral-200 font-mono selection:bg-[#F27D26] selection:text-black">
      <TopBar />
      <div className="flex h-full pt-16">
        <Sidebar />
        <main className="ml-56 flex-1 h-[calc(100vh-64px)] p-6 overflow-y-auto">
          <div className="max-w-3xl mx-auto space-y-8">

            {/* Header */}
            <div>
              <h1 className="font-space text-3xl font-black tracking-widest text-white uppercase flex items-center gap-3">
                <UserIcon className="w-8 h-8 text-[#F27D26]" />
                OPERATOR PROFILE
              </h1>
              <span className="text-[10px] tracking-[0.2em] text-[#F27D26] uppercase font-bold">
                {"// SYSTEM CONFIGURATION"}
              </span>
            </div>

            {/* ── PROFILE SECTION ── */}
            <div className="border border-white/10 bg-[#0c0c0c] p-6 space-y-6">
              <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                <Camera className="w-4 h-4 text-[#F27D26]" />
                <h2 className="font-space text-[11px] tracking-[0.25em] text-white font-black uppercase">
                  IDENTITY
                </h2>
              </div>

              {/* Avatar + Info */}
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 rounded-none border-2 border-[#F27D26]/30 bg-[#111] flex items-center justify-center overflow-hidden shrink-0">
                  {photoURL ? (
                    <img src={photoURL} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl font-space font-black text-[#F27D26]">{initials}</span>
                  )}
                </div>
                <div>
                  <p className="font-space text-lg font-black text-white tracking-widest uppercase">
                    {displayName || "UNNAMED NODE"}
                  </p>
                  <p className="text-[10px] text-neutral-500 tracking-[0.15em] flex items-center gap-1.5 mt-1">
                    <Mail className="w-3 h-3" /> {user?.email}
                  </p>
                  <p className="text-[9px] text-neutral-600 tracking-[0.15em] mt-1">
                    UID: {user?.uid.slice(0, 16)}...
                  </p>
                </div>
              </div>

              {/* Editable Fields */}
              <div className="space-y-4">
                <div>
                  <label className="text-[9px] text-neutral-500 tracking-[0.2em] uppercase font-bold block mb-2">
                    DISPLAY NAME
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full bg-[#111] border border-white/10 px-4 py-3 text-sm text-white font-mono tracking-wider focus:border-[#F27D26]/50 focus:outline-none transition-colors rounded-none"
                    placeholder="Enter operator name..."
                  />
                </div>

                <div>
                  <label className="text-[9px] text-neutral-500 tracking-[0.2em] uppercase font-bold block mb-2">
                    PHOTO URL
                  </label>
                  <input
                    type="url"
                    value={photoURL}
                    onChange={(e) => setPhotoURL(e.target.value)}
                    className="w-full bg-[#111] border border-white/10 px-4 py-3 text-sm text-white font-mono tracking-wider focus:border-[#F27D26]/50 focus:outline-none transition-colors rounded-none"
                    placeholder="https://..."
                  />
                </div>

                <div>
                  <label className="text-[9px] text-neutral-500 tracking-[0.2em] uppercase font-bold block mb-2">
                    EMAIL (READ-ONLY)
                  </label>
                  <input
                    type="email"
                    value={user?.email || ""}
                    disabled
                    className="w-full bg-[#111] border border-white/5 px-4 py-3 text-sm text-neutral-600 font-mono tracking-wider rounded-none cursor-not-allowed"
                  />
                </div>

                <button
                  onClick={handleSaveProfile}
                  disabled={profileStatus === "saving"}
                  className={`w-full py-3 font-space text-[10px] font-black tracking-[0.2em] uppercase rounded-none transition-all flex items-center justify-center gap-2 ${
                    profileStatus === "saved"
                      ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/30"
                      : profileStatus === "saving"
                      ? "bg-[#F27D26]/50 text-black cursor-wait animate-pulse"
                      : "bg-[#F27D26] text-black hover:bg-[#ff9040]"
                  }`}
                >
                  {profileStatus === "saved" ? (
                    <><CheckCircle className="w-4 h-4" /> PROFILE SAVED</>
                  ) : profileStatus === "saving" ? (
                    "SAVING..."
                  ) : (
                    <><Save className="w-4 h-4" /> SAVE PROFILE</>
                  )}
                </button>
              </div>
            </div>

            {/* ── SECURITY SECTION ── */}
            <div className="border border-white/10 bg-[#0c0c0c] p-6 space-y-6">
              <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                <Lock className="w-4 h-4 text-[#F27D26]" />
                <h2 className="font-space text-[11px] tracking-[0.25em] text-white font-black uppercase">
                  SECURITY
                </h2>
              </div>

              {/* Account Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="border border-white/5 bg-[#111] p-4">
                  <p className="text-[9px] text-neutral-500 tracking-[0.2em] uppercase font-bold mb-1">PROVIDER</p>
                  <p className="text-sm text-white font-space font-bold uppercase tracking-widest">
                    {user?.providerData?.[0]?.providerId === "google.com" ? "GOOGLE" : "EMAIL/PASSWORD"}
                  </p>
                </div>
                <div className="border border-white/5 bg-[#111] p-4">
                  <p className="text-[9px] text-neutral-500 tracking-[0.2em] uppercase font-bold mb-1">LAST SIGN-IN</p>
                  <p className="text-sm text-white font-space font-bold tracking-widest">
                    {user?.metadata?.lastSignInTime
                      ? new Date(user.metadata.lastSignInTime).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "N/A"}
                  </p>
                </div>
                <div className="border border-white/5 bg-[#111] p-4">
                  <p className="text-[9px] text-neutral-500 tracking-[0.2em] uppercase font-bold mb-1">ACCOUNT CREATED</p>
                  <p className="text-sm text-white font-space font-bold tracking-widest">
                    {user?.metadata?.creationTime
                      ? new Date(user.metadata.creationTime).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "N/A"}
                  </p>
                </div>
                <div className="border border-white/5 bg-[#111] p-4">
                  <p className="text-[9px] text-neutral-500 tracking-[0.2em] uppercase font-bold mb-1">EMAIL VERIFIED</p>
                  <p className={`text-sm font-space font-bold tracking-widest ${user?.emailVerified ? "text-emerald-500" : "text-red-500"}`}>
                    {user?.emailVerified ? "VERIFIED" : "UNVERIFIED"}
                  </p>
                </div>
              </div>

              {/* Change Password */}
              {user?.providerData?.[0]?.providerId !== "google.com" && (
                <div className="space-y-4 pt-4 border-t border-white/5">
                  <h3 className="text-[10px] text-neutral-500 tracking-[0.2em] uppercase font-bold">
                    CHANGE PASSKEY
                  </h3>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="CURRENT PASSKEY"
                    className="w-full bg-[#111] border border-white/10 px-4 py-3 text-sm text-white font-mono tracking-wider focus:border-[#F27D26]/50 focus:outline-none transition-colors rounded-none placeholder:text-neutral-700 placeholder:text-[10px]"
                  />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="NEW PASSKEY (MIN 6 CHARS)"
                    className="w-full bg-[#111] border border-white/10 px-4 py-3 text-sm text-white font-mono tracking-wider focus:border-[#F27D26]/50 focus:outline-none transition-colors rounded-none placeholder:text-neutral-700 placeholder:text-[10px]"
                  />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="CONFIRM NEW PASSKEY"
                    className="w-full bg-[#111] border border-white/10 px-4 py-3 text-sm text-white font-mono tracking-wider focus:border-[#F27D26]/50 focus:outline-none transition-colors rounded-none placeholder:text-neutral-700 placeholder:text-[10px]"
                  />

                  {statusMessage && (
                    <div className={`text-[10px] font-bold tracking-[0.1em] uppercase p-3 border ${
                      passwordStatus === "error"
                        ? "border-red-500/20 bg-red-500/5 text-red-500"
                        : "border-emerald-500/20 bg-emerald-500/5 text-emerald-500"
                    }`}>
                      {statusMessage}
                    </div>
                  )}

                  <button
                    onClick={handleChangePassword}
                    disabled={passwordStatus === "saving" || !currentPassword || !newPassword}
                    className="w-full py-3 bg-[#F27D26] text-black font-space text-[10px] font-black tracking-[0.2em] uppercase rounded-none hover:bg-[#ff9040] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {passwordStatus === "saving" ? "UPDATING..." : "UPDATE PASSKEY"}
                  </button>
                </div>
              )}
            </div>

            {/* ── ACCOUNT ACTIONS ── */}
            <div className="border border-white/10 bg-[#0c0c0c] p-6 space-y-6">
              <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                <Shield className="w-4 h-4 text-[#F27D26]" />
                <h2 className="font-space text-[11px] tracking-[0.25em] text-white font-black uppercase">
                  ACCOUNT ACTIONS
                </h2>
              </div>

              <button
                onClick={handleSignOut}
                className="w-full py-3 border border-white/10 bg-[#111] text-neutral-400 font-space text-[10px] font-black tracking-[0.2em] uppercase rounded-none hover:border-[#F27D26]/30 hover:text-[#F27D26] transition-all flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" /> SIGN OUT
              </button>

              {/* Danger Zone */}
              <div className="border border-red-500/20 bg-red-500/5 p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  <span className="text-[10px] text-red-500 font-black tracking-[0.2em] uppercase">
                    DANGER ZONE
                  </span>
                </div>
                <p className="text-[10px] text-neutral-500 leading-relaxed tracking-wide">
                  Deleting your account is irreversible. All data associated with this node will be permanently erased.
                </p>

                {!showDeleteConfirm ? (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full py-3 border border-red-500/30 bg-transparent text-red-500 font-space text-[10px] font-black tracking-[0.2em] uppercase rounded-none hover:bg-red-500/10 transition-all flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" /> DELETE ACCOUNT
                  </button>
                ) : (
                  <div className="flex gap-3">
                    <button
                      onClick={handleDeleteAccount}
                      className="flex-1 py-3 bg-red-600 text-white font-space text-[10px] font-black tracking-[0.2em] uppercase rounded-none hover:bg-red-500 transition-all"
                    >
                      CONFIRM DELETE
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 py-3 border border-white/10 text-neutral-500 font-space text-[10px] font-black tracking-[0.2em] uppercase rounded-none hover:text-white transition-all"
                    >
                      CANCEL
                    </button>
                  </div>
                )}
              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}
