"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ensureDatabaseReady, createBlankSheet } from "@/lib/db";
import { AppSidebar } from "@/components/AppSidebar";
import { useDb } from "@/components/DbProvider";
import { ProfileMenu } from "@/components/ProfileMenu";
import {
  CIVICI_APP_SHELL_CLASS,
  CIVICI_MAIN_COLUMN_CLASS,
  DEFAULT_ACCENT_COLOR,
  resolveSheetAccentColor,
} from "@/lib/theme";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const db = useDb();
  const router = useRouter();
  const recentSheets = useLiveQuery(
    async () => await db.sheets.orderBy("lastOpenedAt").reverse().limit(12).toArray(),
    [db],
  );
  const sheetCount = useLiveQuery(async () => await db.sheets.count(), [db]);
  const leads = useLiveQuery(async () => await db.leads.toArray(), [db]);
  const sent = useLiveQuery(
    async () => await db.queue.where("status").equals("sent").toArray(),
    [db],
  );

  useEffect(() => {
    void ensureDatabaseReady(db);
  }, [db]);

  const guestSignIns = leads?.length ?? 0;
  const totalContacts = leads?.length ?? 0;
  const messagesSent = sent?.length ?? 0;
  const sheetsTotal = sheetCount ?? 0;

  async function handleNewSheet() {
    const id = await createBlankSheet(db);
    void router.push(`/sheet/${id}`);
  }

  function formatOpenedAt(iso: string) {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  return (
    <main className={CIVICI_APP_SHELL_CLASS}>
      <div className="mx-auto flex min-h-screen max-w-[1440px] gap-4">
        <AppSidebar />
        <section className={CIVICI_MAIN_COLUMN_CLASS}>
          <div className="mb-6 flex justify-end">
            <ProfileMenu />
          </div>

          <header className="rounded-xl border border-neutral-200 bg-white px-6 py-7 shadow-sm">
            <p className="text-sm font-medium text-neutral-600">Good to see you</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-neutral-950">
              Pick up where you left off
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-600">
              Your sign-in sheets, guests, and follow-ups stay in sync. Open a recent sheet below,
              or start a fresh one for your next open house. You have{" "}
              <span className="font-semibold text-neutral-900">{totalContacts}</span> contacts across
              all sheets.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void handleNewSheet()}
                className="rounded-md bg-neutral-950 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-800"
              >
                New sign-in sheet
              </button>
              <Link
                href="/contacts"
                className="rounded-md border border-neutral-300 bg-white px-5 py-2.5 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-50"
              >
                All contacts
              </Link>
              <Link
                href="/activity"
                className="rounded-md border border-neutral-300 bg-white px-5 py-2.5 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-50"
              >
                Message log
              </Link>
            </div>
          </header>

          <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Saved sheets" value={String(sheetsTotal)} />
            <StatCard label="Open house guests" value={String(guestSignIns)} />
            <StatCard label="Total contacts" value={String(totalContacts)} />
            <StatCard label="Thank-you messages sent" value={String(messagesSent)} />
          </section>

          <section className="mt-8">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-neutral-950">Recent sheets</h2>
                <p className="text-sm text-neutral-600">
                  Each sheet keeps its own title, logo, and colors — open one to continue.
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {(recentSheets ?? []).map((s) => (
                <Link
                  key={s.id}
                  href={`/sheet/${s.id}`}
                  className="group flex items-center gap-4 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-neutral-300 hover:shadow-md"
                >
                  <div
                    className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50"
                    style={{ color: resolveSheetAccentColor(s.accentColor) }}
                  >
                    {s.logoUrl ? (
                      <Image
                        src={s.logoUrl}
                        alt=""
                        width={56}
                        height={56}
                        className="h-full w-full object-contain p-1"
                        unoptimized
                      />
                    ) : (
                      <span className="text-xs font-semibold tracking-wide">Sheet</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-neutral-950 group-hover:underline">
                      {s.eventName || "Untitled sheet"}
                    </p>
                    <p className="truncate text-xs text-neutral-600">{s.officeName}</p>
                    <p className="mt-1 text-xs text-neutral-500">
                      Opened {formatOpenedAt(s.lastOpenedAt)}
                    </p>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-2 py-1 text-xs font-medium text-white"
                    style={{ backgroundColor: resolveSheetAccentColor(s.accentColor) }}
                  >
                    Open
                  </span>
                </Link>
              ))}
            </div>
            {(recentSheets?.length ?? 0) === 0 ? (
              <p className="mt-4 rounded-lg border border-dashed border-neutral-200 bg-neutral-50 px-4 py-8 text-center text-sm text-neutral-600">
                No sheets yet. Create your first sign-in sheet to see it here.
              </p>
            ) : null}
          </section>
        </section>
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-neutral-600">{label}</p>
      <p className="mt-2 text-3xl font-semibold" style={{ color: DEFAULT_ACCENT_COLOR }}>
        {value}
      </p>
    </article>
  );
}
