"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useParams, useRouter } from "next/navigation";
import { ensureDatabaseReady } from "@/lib/db";
import { AppSidebar } from "@/components/AppSidebar";
import { useDb } from "@/components/DbProvider";
import { ProfileMenu } from "@/components/ProfileMenu";
import {
  CIVICI_APP_SHELL_CLASS,
  CIVICI_MAIN_COLUMN_CLASS,
  resolveSheetAccentColor,
} from "@/lib/theme";

const THANK_YOU_HINT =
  "Use {firstName}, {fullName}, and {eventName}. Example: Thanks {firstName} for visiting {eventName}!";

export default function SheetSettingsPage() {
  const db = useDb();
  const params = useParams();
  const router = useRouter();
  const sheetId = typeof params.sheetId === "string" ? params.sheetId : "";
  const [guestLinkBusy, setGuestLinkBusy] = useState(false);
  const [guestLinkMessage, setGuestLinkMessage] = useState<string | null>(null);

  const sheet = useLiveQuery(
    async () => (sheetId ? await db.sheets.get(sheetId) : undefined),
    [sheetId, db],
  );

  useEffect(() => {
    void ensureDatabaseReady(db);
  }, [db]);

  useEffect(() => {
    if (!sheetId) return;
    void ensureDatabaseReady(db).then(async () => {
      const exists = await db.sheets.get(sheetId);
      if (!exists) router.replace("/settings");
    });
  }, [sheetId, router, db]);

  async function updateSheet(partial: Record<string, unknown>) {
    if (!sheet) return;
    await db.sheets.update(sheet.id, {
      ...partial,
      updatedAt: new Date().toISOString(),
    });
  }

  async function copyGuestSignInLink() {
    if (!sheet) return;
    setGuestLinkMessage(null);
    setGuestLinkBusy(true);
    try {
      const res = await fetch("/api/guest-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sheetId: sheet.id,
          eventName: sheet.eventName,
          thankYouTemplate: sheet.thankYouTemplate,
          sendFromPhone: sheet.sendFromPhone?.trim() || undefined,
          columnHeaders: sheet.columnHeaders,
          logoUrl: sheet.logoUrl || undefined,
          accentColor: sheet.accentColor || undefined,
        }),
      });
      const data = (await res.json()) as { token?: string; error?: string };
      if (!res.ok || !data.token) {
        throw new Error(data.error ?? "Could not create link");
      }
      const url = `${window.location.origin}/o?t=${encodeURIComponent(data.token)}`;
      await navigator.clipboard.writeText(url);
      setGuestLinkMessage("Guest sign-in link copied. Open it on a tablet or phone at the door.");
    } catch (e) {
      setGuestLinkMessage(e instanceof Error ? e.message : "Could not copy link");
    } finally {
      setGuestLinkBusy(false);
    }
  }

  if (!sheetId || !sheet) {
    return <main className="p-8">Loading…</main>;
  }

  return (
    <main className={CIVICI_APP_SHELL_CLASS}>
      <div className="mx-auto flex min-h-screen max-w-[1440px] gap-4">
        <AppSidebar />
        <section className={CIVICI_MAIN_COLUMN_CLASS}>
          <div className="mb-4 flex justify-end">
            <ProfileMenu />
          </div>
          <div className="mx-auto max-w-3xl space-y-6 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-neutral-950">Sheet customization</h1>
            </div>
            <p className="text-sm text-neutral-600">
              Sheet title and column labels are edited on the sheet itself. Use this page for logo,
              colors, follow-up texts, and the guest sign-in link.
            </p>

            <label className="block text-sm text-slate-700">
              Brokerage name
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 p-2"
                value={sheet.officeName}
                onChange={(event) => void updateSheet({ officeName: event.target.value })}
              />
            </label>

            <label className="block text-sm text-slate-700">
              Logo URL
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 p-2"
                value={sheet.logoUrl}
                onChange={(event) => void updateSheet({ logoUrl: event.target.value })}
              />
            </label>

            <label className="block text-sm text-slate-700">
              Accent color
              <input
                type="color"
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 p-1"
                value={resolveSheetAccentColor(sheet.accentColor)}
                onChange={(event) => void updateSheet({ accentColor: event.target.value })}
              />
            </label>

            <div className="border-t border-slate-200 pt-6">
              <h2 className="text-lg font-semibold text-slate-900">Follow-up text (SMS)</h2>
              <p className="mt-1 text-sm text-slate-600">
                After each sign-in syncs, Civici sends this message by SMS.{" "}
                <span className="text-slate-500">{THANK_YOU_HINT}</span>
              </p>
              <textarea
                className="mt-2 min-h-[100px] w-full rounded-lg border border-slate-300 p-2.5 text-sm"
                value={sheet.thankYouTemplate}
                onChange={(event) => void updateSheet({ thankYouTemplate: event.target.value })}
              />
            </div>

            <div className="border-t border-slate-200 pt-6">
              <h2 className="text-lg font-semibold text-slate-900">
                Your phone number (guests see this as the sender)
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Put <strong>your</strong> cell or business line here—the number you want buyers to
                recognize when they get the thank-you text. Use E.164 format (for example{" "}
                <span className="font-mono text-slate-800">+15551234567</span>). Civici sends SMS
                through Twilio, so this number has to be allowed on <strong>your</strong> Twilio
                project (usually a Twilio number you buy, or a number Twilio lets you verify as a
                sender). If it is not set up yet, texts fall back to your team default{" "}
                <code className="rounded bg-slate-100 px-1">TWILIO_FROM_NUMBER</code> on the server
                until Twilio accepts yours.
              </p>
              <label className="mt-3 block text-sm font-medium text-slate-800">
                Agent sender number (E.164)
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-sm font-normal"
                  placeholder="+15551234567"
                  value={sheet.sendFromPhone ?? ""}
                  onChange={(event) => void updateSheet({ sendFromPhone: event.target.value })}
                  autoComplete="tel"
                />
              </label>
              <p className="mt-2 text-xs text-slate-500">
                Tip: each open-house sheet can use a different number if you run multiple brands or
                teammates share one Civici account.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <a
                  className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50"
                  href="https://www.twilio.com/try-twilio"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Create Twilio account
                </a>
                <a
                  className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50"
                  href="https://www.twilio.com/docs/messaging/quickstart"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  SMS setup (quickstart)
                </a>
                <a
                  className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50"
                  href="https://www.twilio.com/docs/phone-numbers"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Phone numbers for messaging
                </a>
                <a
                  className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50"
                  href="https://console.twilio.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open Twilio Console
                </a>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-6">
              <h2 className="text-lg font-semibold text-slate-900">Guest sign-in link</h2>
              <p className="mt-1 text-sm text-slate-600">
                Visitors open this link on a spare phone or tablet—no Civici login. If the device
                goes offline, sign-ins queue locally and send when the connection returns, then the
                thank-you text goes out.
              </p>
              <button
                type="button"
                disabled={guestLinkBusy || !sheet.thankYouTemplate?.trim()}
                onClick={() => void copyGuestSignInLink()}
                className="mt-3 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow disabled:opacity-50"
              >
                {guestLinkBusy ? "Creating link…" : "Copy guest sign-in link"}
              </button>
              {guestLinkMessage ? (
                <p className="mt-2 text-sm text-slate-700">{guestLinkMessage}</p>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
