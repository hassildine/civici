"use client";

import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useAuth } from "@clerk/nextjs";
import { closeAndForgetDbForUser, getDbForUser, type CiviciDexie } from "@/lib/db";

const DbContext = createContext<CiviciDexie | null>(null);

/** Last known Clerk user id — same origin as IndexedDB; used only when offline so the app still opens *your* DB. */
const SESSION_USER_ID_KEY = "civici.clerkUserId";

function readSessionUserId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(SESSION_USER_ID_KEY);
  } catch {
    return null;
  }
}

function writeSessionUserId(userId: string) {
  try {
    sessionStorage.setItem(SESSION_USER_ID_KEY, userId);
  } catch {
    /* private mode / quota */
  }
}

function clearSessionUserId() {
  try {
    sessionStorage.removeItem(SESSION_USER_ID_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Resolves which Clerk account owns local storage (IndexedDB).
 * - Online: always trust Clerk’s `userId` once `isLoaded` (or wait).
 * - Offline: if Clerk hasn’t finished yet, fall back to the last signed-in id so sheets/contacts still load.
 * - Signed out: Clerk says no user → never use the fallback (cleared on sign-out).
 */
function useResolvedClerkUserId(): string | null {
  const { userId, isLoaded } = useAuth();

  return useMemo(() => {
    if (userId) return userId;
    if (isLoaded && !userId) return null;
    if (typeof window !== "undefined" && !window.navigator.onLine) {
      const cached = readSessionUserId();
      if (cached) return cached;
    }
    return null;
  }, [userId, isLoaded]);
}

export function DbProvider({ children }: { children: ReactNode }) {
  const { userId, isLoaded } = useAuth();
  const resolvedUserId = useResolvedClerkUserId();
  const priorUserId = useRef<string | null>(null);

  useEffect(() => {
    if (userId) {
      writeSessionUserId(userId);
    } else if (isLoaded && !userId) {
      clearSessionUserId();
    }
  }, [userId, isLoaded]);

  const db = useMemo(() => {
    if (!resolvedUserId) return null;
    return getDbForUser(resolvedUserId);
  }, [resolvedUserId]);

  useEffect(() => {
    const prev = priorUserId.current;
    const active = resolvedUserId;
    if (active) {
      if (prev && prev !== active) {
        closeAndForgetDbForUser(prev);
      }
      priorUserId.current = active;
    } else if (isLoaded && !active) {
      if (prev) closeAndForgetDbForUser(prev);
      priorUserId.current = null;
    }
  }, [resolvedUserId, isLoaded]);

  if (!resolvedUserId) {
    if (!isLoaded) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-neutral-50 text-neutral-600">
          Loading…
        </main>
      );
    }
    return <>{children}</>;
  }

  if (!db) {
    return <>{children}</>;
  }

  return <DbContext.Provider value={db}>{children}</DbContext.Provider>;
}

export function useDb(): CiviciDexie {
  const db = useContext(DbContext);
  if (!db) {
    throw new Error("useDb requires a signed-in user (DbProvider with userId).");
  }
  return db;
}
