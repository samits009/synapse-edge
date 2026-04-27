"use client";

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import React, {
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { auth } from "./config";

/* ========================================================================
   SynapseEdge — Firebase Authentication Layer
   ========================================================================
   Provides:
     • signIn / signUp / signOut wrappers
     • AuthProvider context with current user state
     • useAuth() hook for any client component
     • useRequireAuth() hook that redirects if not logged in
   ======================================================================== */

// ── Auth Functions ────────────────────────────────────────────────────

export async function signIn(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signUp(email: string, password: string) {
  return createUserWithEmailAndPassword(auth, email, password);
}

export async function signOut() {
  return firebaseSignOut(auth);
}

// ── Auth Context ──────────────────────────────────────────────────────

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = React.createContext<AuthContextType>({
  user: null,
  loading: true,
});

const AuthContextProvider = AuthContext.Provider;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return React.createElement(AuthContextProvider, { value: { user, loading } }, children);
}

// ── Hooks ─────────────────────────────────────────────────────────────

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}

/**
 * useRequireAuth — Redirects to /login if no active session.
 *
 * Usage in any protected page component:
 *   const { user, loading } = useRequireAuth();
 *   if (loading) return <LoadingSpinner />;
 */
export function useRequireAuth(redirectTo: string = "/login") {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      window.location.href = redirectTo;
    }
  }, [user, loading, redirectTo]);

  return { user, loading };
}
