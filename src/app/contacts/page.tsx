"use client";

import { useEffect, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, ensureDatabaseReady } from "@/lib/db";
import { exportLeadsToCsv } from "@/lib/sheetClient";
import { AppSidebar } from "@/components/AppSidebar";
import { ProfileMenu } from "@/components/ProfileMenu";
import { CIVICI_APP_SHELL_CLASS, CIVICI_MAIN_COLUMN_CLASS } from "@/lib/theme";

export default function ContactsPage() {
  const leads = useLiveQuery(
    async () => await db.leads.orderBy("createdAt").reverse().toArray(),
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
            <h1 className="text-2xl font-bold text-neutral-950">All contacts</h1>
            <p className="mt-1 text-sm text-neutral-600">
              Everyone captured across your sign-in sheets, with the sheet each row came from.
            </p>
            <button
              type="button"
              onClick={() => void exportLeadsToCsv()}
              className="mt-4 rounded-md bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-800"
            >
              Export all (CSV)
            </button>
          </header>

          <section className="mt-4 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
            <div className="grid grid-cols-5 border-b border-neutral-200 bg-neutral-50 p-3 text-sm font-semibold text-neutral-800">
              <div>Sheet</div>
              <div>Name</div>
              <div>Email</div>
              <div>Phone</div>
              <div>Title on form</div>
            </div>
            {(leads ?? []).map((lead) => (
              <div
                key={lead.id}
                className="grid grid-cols-5 border-b border-neutral-100 p-3 text-sm"
              >
                <div className="truncate text-neutral-800">
                  {sheetTitleById.get(lead.sheetId) ?? "—"}
                </div>
                <div>{lead.fullName}</div>
                <div>{lead.email || "—"}</div>
                <div>{lead.phone}</div>
                <div className="truncate text-neutral-600">{lead.eventName}</div>
              </div>
            ))}
          </section>
        </section>
      </div>
    </main>
  );
}
