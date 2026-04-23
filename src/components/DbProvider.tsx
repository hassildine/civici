"use client";

import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useAuth } from "@clerk/nextjs";
import { closeAndForgetDbForUser, getDbForUser, type CiviciDexie } from "@/lib/db";

const DbContext = createContext<CiviciDexie | null>(null);

export function DbProvider({ children }: { children: ReactNode }) {
  const { userId, isLoaded } = useAuth();
  const priorUserId = useRef<string | null>(null);

  const db = useMemo(() => {
    if (!userId) return null;
    return getDbForUser(userId);
  }, [userId]);

  useEffect(() => {
    const prev = priorUserId.current;
    if (userId) {
      if (prev && prev !== userId) {
        closeAndForgetDbForUser(prev);
      }
      priorUserId.current = userId;
    } else {
      priorUserId.current = null;
    }
  }, [userId]);

  if (!isLoaded) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-50 text-neutral-600">
        Loading…
      </main>
    );
  }

  if (!userId) {
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
