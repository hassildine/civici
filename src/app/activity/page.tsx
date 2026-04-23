"use client";

import { useEffect, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, ensureDatabaseReady } from "@/lib/db";
import { AppSidebar } from "@/components/AppSidebar";
import { ProfileMenu } from "@/components/ProfileMenu";
import { CIVICI_APP_SHELL_CLASS, CIVICI_MAIN_COLUMN_CLASS } from "@/lib/theme";

export default function ActivityPage() {
  const queue = useLiveQuery(
    async () => await db.queue.orderBy("updatedAt").reverse().toArray(),
    [],
  );
  const sheets = useLiveQuery(async () => await db.sheets.toArray(), []);
  useEffect(() => {
    void ensureDatabaseReady();
  }, []);

  const sheetTitleById = useMemo(() => {
    const map = new Map<string, string>();
    (sheets ?? []).forEach((s) => map.set(s.id, s.eventName || "Untitled sheet"));
    return map;
  }, [sheets]);

  return (
    <main className={CIVICI_APP_SHELL_CLASS}>
      <div className="mx-auto flex min-h-screen max-w-[1440px] gap-4">
        <AppSidebar />
        <section className={CIVICI_MAIN_COLUMN_CLASS}>
          <div className="mb-4 flex justify-end">
            <ProfileMenu />
          </div>
          <header className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h1 className="text-2xl font-bold text-neutral-950">Message activity</h1>
            <p className="mt-1 text-sm text-neutral-600">
              Thank-you sends and sync status for your queued rows.
            </p>
          </header>

          <section className="mt-4 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
            <div className="grid grid-cols-5 border-b border-neutral-200 bg-neutral-50 p-3 text-sm font-semibold text-neutral-800">
              <div>Sheet</div>
              <div>Queue ID</div>
              <div>Status</div>
              <div>Updated</div>
              <div>Error</div>
            </div>
            {(queue ?? []).map((item) => (
              <div key={item.id} className="grid grid-cols-5 border-b border-neutral-100 p-3 text-sm">
                <div className="truncate text-neutral-800">
                  {sheetTitleById.get(item.sheetId) ?? "—"}
                </div>
                <div className="truncate font-mono text-xs">{item.id.slice(0, 8)}…</div>
                <div className="capitalize">{item.status}</div>
                <div>{new Date(item.updatedAt).toLocaleString()}</div>
                <div className="truncate">{item.error ?? "—"}</div>
              </div>
            ))}
          </section>
        </section>
      </div>
    </main>
  );
}
