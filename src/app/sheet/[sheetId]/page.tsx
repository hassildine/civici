"use client";

import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { ensureDatabaseReady, touchSheetLastOpened, createBlankSheet } from "@/lib/db";
import { downloadOfflineSheetBundle, syncPendingLeads } from "@/lib/sheetClient";
import { AppSidebar } from "@/components/AppSidebar";
import { useDb } from "@/components/DbProvider";
import { ProfileMenu } from "@/components/ProfileMenu";
import {
  CIVICI_APP_SHELL_CLASS,
  CIVICI_MAIN_COLUMN_CLASS_TALL,
  resolveSheetAccentColor,
} from "@/lib/theme";

type DraftRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  notes: string;
};

function createEmptyRow(): DraftRow {
  return {
    id: crypto.randomUUID(),
    name: "",
    email: "",
    phone: "",
    notes: "",
  };
}

export default function SheetByIdPage() {
  const db = useDb();
  const params = useParams();
  const router = useRouter();
  const sheetId = typeof params.sheetId === "string" ? params.sheetId : "";

  const [isOnline, setIsOnline] = useState(
    typeof window === "undefined" ? true : window.navigator.onLine,
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [draftRows, setDraftRows] = useState<DraftRow[]>(
    Array.from({ length: 12 }, () => createEmptyRow()),
  );

  const sheet = useLiveQuery(
    async () => (sheetId ? await db.sheets.get(sheetId) : undefined),
    [sheetId, db],
  );
  const leads = useLiveQuery(
    async () =>
      sheetId
        ? await db.leads.where("sheetId").equals(sheetId).sortBy("createdAt")
        : [],
    [sheetId, db],
  );
  const pending = useLiveQuery(
    async () => await db.queue.where("status").equals("pending").toArray(),
    [db],
  );

  const pendingForSheet = useMemo(() => {
    if (!sheetId || !pending || !leads) return 0;
    const leadIds = new Set(leads.map((l) => l.id));
    return pending.filter((q) => leadIds.has(q.leadId)).length;
  }, [sheetId, pending, leads]);

  useEffect(() => {
    void ensureDatabaseReady(db);
  }, [db]);

  useEffect(() => {
    if (!sheetId) return;
    void touchSheetLastOpened(db, sheetId);
  }, [sheetId, db]);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  async function queueRow(row: DraftRow) {
    if (!sheet || !row.name.trim() || !row.phone.trim()) return;
    const createdAt = new Date().toISOString();
    const leadId = crypto.randomUUID();

    await db.transaction("rw", db.leads, db.queue, async () => {
      await db.leads.put({
        id: leadId,
        sheetId: sheet.id,
        fullName: row.name.trim(),
        email: row.email.trim(),
        phone: row.phone.trim(),
        notes: row.notes.trim(),
        eventName: sheet.eventName,
        createdAt,
      });
      await db.queue.put({
        id: crypto.randomUUID(),
        leadId,
        sheetId: sheet.id,
        status: "pending",
        createdAt,
        updatedAt: createdAt,
      });
    });
  }

  async function saveRows() {
    const filledRows = draftRows.filter((row) => row.name.trim() || row.phone.trim());
    for (const row of filledRows) {
      await queueRow(row);
    }
    setDraftRows(Array.from({ length: 12 }, () => createEmptyRow()));
    if (isOnline && sheet) {
      await runSyncFlow();
    }
  }

  async function runSyncFlow() {
    if (!sheet || isSyncing) return;
    setIsSyncing(true);
    try {
      await syncPendingLeads(db);
    } finally {
      setIsSyncing(false);
    }
  }

  useEffect(() => {
    if (!isOnline || !sheet) return;
    void runSyncFlow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, sheet?.id, sheet?.offlineSheetDownloaded, db]);

  async function updateColumnHeader(
    key: "name" | "email" | "phone" | "notes",
    value: string,
  ) {
    if (!sheet) return;
    await db.sheets.update(sheet.id, {
      columnHeaders: {
        ...sheet.columnHeaders,
        [key]: value,
      },
      updatedAt: new Date().toISOString(),
    });
  }

  async function updateSheetName(value: string) {
    if (!sheet) return;
    await db.sheets.update(sheet.id, {
      eventName: value,
      updatedAt: new Date().toISOString(),
    });
  }

  async function handleNewDocument() {
    const id = await createBlankSheet(db);
    void router.push(`/sheet/${id}`);
  }

  function clearDraftOnly() {
    setDraftRows(Array.from({ length: 12 }, () => createEmptyRow()));
  }

  useEffect(() => {
    if (!sheetId) return;
    void ensureDatabaseReady(db).then(async () => {
      const exists = await db.sheets.get(sheetId);
      if (!exists) router.replace("/sheet");
    });
  }, [sheetId, router, db]);

  if (!sheetId) {
    return <main className="p-8">Loading…</main>;
  }

  if (!sheet) {
    return <main className="p-8">Loading sheet…</main>;
  }

  const effectiveSheetTitle = (sheet.eventName || "Sign-in sheet").trim();
  const effectiveLogoUrl = (sheet.logoUrl || "").trim();
  const accent = resolveSheetAccentColor(sheet.accentColor);

  return (
    <main className={CIVICI_APP_SHELL_CLASS}>
      <div className="mx-auto flex min-h-screen max-w-[1440px] gap-4">
        <AppSidebar />
        <section className={CIVICI_MAIN_COLUMN_CLASS_TALL}>
          <div className="mb-4 flex justify-end">
            <ProfileMenu />
          </div>
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="rounded-md bg-neutral-950 px-4 py-3 text-left text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-800"
              onClick={() => void handleNewDocument()}
            >
              + New sheet
            </button>
            <button
              type="button"
              className="rounded-md border border-neutral-300 bg-white px-4 py-3 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-50"
              onClick={clearDraftOnly}
            >
              Clear rows
            </button>
            <div className="rounded-md border border-neutral-200 bg-white px-4 py-2.5 text-sm text-neutral-600">
              {isOnline ? "Online — syncs automatically" : "Offline — saves on this device"}
            </div>
            <div className="rounded-md border border-neutral-200 bg-white px-4 py-2.5 text-sm text-neutral-600">
              This sheet: {leads?.length ?? 0} saved · {pendingForSheet} pending send
            </div>
          </div>

          <div className="mx-auto mb-3 max-w-5xl">
            <label className="block text-xs font-medium text-neutral-600">Sheet name</label>
            <input
              type="text"
              value={sheet.eventName}
              onChange={(e) => void updateSheetName(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm outline-none focus:border-neutral-400"
              placeholder="e.g. 123 Main St — Open house"
            />
          </div>

          <article className="rounded-xl border border-neutral-200 bg-neutral-50 p-6">
            <div className="mx-auto w-full max-w-5xl overflow-hidden rounded-lg border border-neutral-300 bg-white shadow-sm">
              <div className="flex min-h-[3.25rem] flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
                <h3
                  className="min-w-0 flex-1 text-lg font-semibold uppercase tracking-wide"
                  style={{ color: accent }}
                >
                  {effectiveSheetTitle}
                </h3>
                <div className="flex shrink-0 items-center justify-end">
                  {effectiveLogoUrl ? (
                    <Image
                      src={effectiveLogoUrl}
                      alt="Sheet logo"
                      width={200}
                      height={48}
                      className="h-10 max-h-10 w-auto max-w-[min(220px,42vw)] object-contain object-right"
                      unoptimized
                    />
                  ) : (
                    <div className="rounded-md border border-neutral-300 bg-neutral-50 px-3 py-1 text-xs font-semibold tracking-wide text-neutral-500">
                      logo
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-4 border-y border-neutral-300 text-center text-xs font-semibold">
                <div className="border-r border-neutral-300 p-1">
                  <input
                    value={sheet.columnHeaders.name}
                    onChange={(event) => void updateColumnHeader("name", event.target.value)}
                    className="w-full bg-transparent px-2 py-1 text-center text-xs font-semibold outline-none"
                    style={{ color: accent }}
                  />
                </div>
                <div className="border-r border-neutral-300 p-1">
                  <input
                    value={sheet.columnHeaders.email}
                    onChange={(event) => void updateColumnHeader("email", event.target.value)}
                    className="w-full bg-transparent px-2 py-1 text-center text-xs font-semibold outline-none"
                    style={{ color: accent }}
                  />
                </div>
                <div className="border-r border-neutral-300 p-1">
                  <input
                    value={sheet.columnHeaders.phone}
                    onChange={(event) => void updateColumnHeader("phone", event.target.value)}
                    className="w-full bg-transparent px-2 py-1 text-center text-xs font-semibold outline-none"
                    style={{ color: accent }}
                  />
                </div>
                <div className="p-1">
                  <input
                    value={sheet.columnHeaders.notes}
                    onChange={(event) => void updateColumnHeader("notes", event.target.value)}
                    className="w-full bg-transparent px-2 py-1 text-center text-xs font-semibold outline-none"
                    style={{ color: accent }}
                  />
                </div>
              </div>

              {draftRows.map((row) => (
                <div key={row.id} className="grid grid-cols-4 border-b border-neutral-200">
                  <input
                    className="border-r border-neutral-200 bg-white px-3 py-1.5 text-sm outline-none transition focus:bg-neutral-50"
                    value={row.name}
                    style={{ color: accent }}
                    onChange={(event) =>
                      setDraftRows((prev) =>
                        prev.map((item) =>
                          item.id === row.id ? { ...item, name: event.target.value } : item,
                        ),
                      )
                    }
                  />
                  <input
                    className="border-r border-neutral-200 bg-white px-3 py-1.5 text-sm outline-none transition focus:bg-neutral-50"
                    value={row.email}
                    style={{ color: accent }}
                    onChange={(event) =>
                      setDraftRows((prev) =>
                        prev.map((item) =>
                          item.id === row.id ? { ...item, email: event.target.value } : item,
                        ),
                      )
                    }
                  />
                  <input
                    className="border-r border-neutral-200 bg-white px-3 py-1.5 text-sm outline-none transition focus:bg-neutral-50"
                    value={row.phone}
                    style={{ color: accent }}
                    onChange={(event) =>
                      setDraftRows((prev) =>
                        prev.map((item) =>
                          item.id === row.id ? { ...item, phone: event.target.value } : item,
                        ),
                      )
                    }
                  />
                  <input
                    className="bg-white px-3 py-1.5 text-sm outline-none transition focus:bg-neutral-50"
                    value={row.notes}
                    style={{ color: accent }}
                    onChange={(event) =>
                      setDraftRows((prev) =>
                        prev.map((item) =>
                          item.id === row.id ? { ...item, notes: event.target.value } : item,
                        ),
                      )
                    }
                  />
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="rounded-md bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-800"
                onClick={async () => {
                  await saveRows();
                  await downloadOfflineSheetBundle(db, sheet);
                  await db.sheets.update(sheet.id, {
                    offlineSheetDownloaded: true,
                    updatedAt: new Date().toISOString(),
                  });
                }}
              >
                Save entries + download offline
              </button>
              <p className="text-sm text-neutral-600">
                {isSyncing
                  ? "Syncing…"
                  : "Thank-you messages send automatically when you are back online."}
              </p>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
