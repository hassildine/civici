"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { hexToRgba, resolveSheetAccentColor } from "@/lib/theme";

const QUEUE_KEY = "civici-guest-submit-queue-v1";

type GuestMeta = {
  eventName: string;
  columnHeaders: { name: string; email: string; phone: string; notes: string };
  logoUrl: string;
  accentColor: string;
};

type QueuedSubmit = {
  token: string;
  fullName: string;
  phone: string;
  email: string;
  notes: string;
};

function loadQueue(): QueuedSubmit[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as QueuedSubmit[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveQueue(items: QueuedSubmit[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

function GuestSignInInner() {
  const searchParams = useSearchParams();
  const token = (searchParams.get("t") ?? "").trim();

  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [meta, setMeta] = useState<GuestMeta | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitOk, setSubmitOk] = useState<string | null>(null);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [queuedCount, setQueuedCount] = useState(() =>
    typeof window === "undefined" ? 0 : loadQueue().length,
  );

  const accent = resolveSheetAccentColor(meta?.accentColor);
  const labels = meta?.columnHeaders;

  const syncQueuedCount = useCallback(() => {
    setQueuedCount(loadQueue().length);
  }, []);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/guest-sheet?t=${encodeURIComponent(token)}`);
        const data = (await res.json()) as GuestMeta & { error?: string };
        if (!res.ok) throw new Error(data.error ?? "Invalid link");
        if (!cancelled) {
          setMeta(data);
          setMetaError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setMetaError(e instanceof Error ? e.message : "Could not load form");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const submitOnce = useCallback(async (body: QueuedSubmit) => {
    const res = await fetch("/api/guest-submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      throw new Error(data.error ?? "Submit failed");
    }
  }, []);

  const flushQueue = useCallback(async () => {
    if (!navigator.onLine) return;
    const pending = loadQueue();
    const remaining: QueuedSubmit[] = [];
    for (const item of pending) {
      try {
        await submitOnce(item);
      } catch {
        remaining.push(item);
      }
    }
    if (remaining.length !== pending.length) {
      saveQueue(remaining);
    }
  }, [submitOnce]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void (async () => {
      await flushQueue();
      if (!cancelled) syncQueuedCount();
    })();
    return () => {
      cancelled = true;
    };
  }, [online, token, flushQueue, syncQueuedCount]);

  useEffect(() => {
    if (!online || !token) return;
    const id = window.setInterval(() => {
      void (async () => {
        await flushQueue();
        syncQueuedCount();
      })();
    }, 8000);
    return () => window.clearInterval(id);
  }, [online, token, flushQueue, syncQueuedCount]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitErr(null);
    setSubmitOk(null);
    if (!token || !fullName.trim() || !phone.trim()) {
      setSubmitErr("Name and phone are required.");
      return;
    }
    const body: QueuedSubmit = {
      token,
      fullName: fullName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      notes: notes.trim(),
    };
    setSubmitting(true);
    try {
      if (!navigator.onLine) {
        const q = loadQueue();
        q.push(body);
        saveQueue(q);
        syncQueuedCount();
        setSubmitOk("Saved on this device. It will send when you are back online.");
        setFullName("");
        setPhone("");
        setEmail("");
        setNotes("");
        return;
      }
      await submitOnce(body);
      setSubmitOk("You are signed in. Thank you!");
      setFullName("");
      setPhone("");
      setEmail("");
      setNotes("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Submit failed";
      const q = loadQueue();
      q.push(body);
      saveQueue(q);
      syncQueuedCount();
      setSubmitErr(
        `${msg} — your sign-in was saved on this device and will retry automatically.`,
      );
    } finally {
      setSubmitting(false);
    }
  }

  const title = useMemo(() => meta?.eventName ?? "Open house sign-in", [meta]);

  if (!token) {
    return (
      <main className="min-h-screen bg-slate-50 p-6 text-slate-800">
        <p className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
          Missing sign-in link. Ask your agent for the QR or link.
        </p>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen p-4 md:p-8"
      style={{ backgroundColor: hexToRgba(accent, 0.12) }}
    >
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200/80 bg-white/95 p-6 shadow-lg md:p-8">
        {!online && (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            You are offline. Sign-ins save on this phone or tablet and send when Wi‑Fi or data
            returns.
          </p>
        )}
        {queuedCount > 0 && online && (
          <p className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            Sending {queuedCount} saved sign-in{queuedCount === 1 ? "" : "s"}…
          </p>
        )}
        {metaError && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {metaError}
          </p>
        )}
        {!meta && !metaError && (
          <p className="text-center text-sm text-slate-600">Loading sign-in form…</p>
        )}
        {meta && (
          <>
            <div className="mb-6 flex flex-col items-center gap-3 text-center">
              {meta.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={meta.logoUrl}
                  alt=""
                  className="h-12 w-auto max-w-[200px] object-contain"
                />
              ) : null}
              <h1 className="text-xl font-semibold text-slate-900 md:text-2xl">{title}</h1>
              <p className="text-sm text-slate-600">Please sign in below.</p>
            </div>
            <form className="space-y-4" onSubmit={(e) => void handleSubmit(e)}>
              <label className="block text-sm text-slate-700">
                {labels?.name ?? "Name"}
                <input
                  required
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                />
              </label>
              <label className="block text-sm text-slate-700">
                {labels?.phone ?? "Phone"}
                <input
                  required
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                  inputMode="tel"
                />
              </label>
              <label className="block text-sm text-slate-700">
                {labels?.email ?? "Email"}{" "}
                <span className="text-slate-400">(optional)</span>
                <input
                  type="email"
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </label>
              <label className="block text-sm text-slate-700">
                {labels?.notes ?? "Notes"}{" "}
                <span className="text-slate-400">(optional)</span>
                <textarea
                  className="mt-1 min-h-[72px] w-full rounded-lg border border-slate-300 p-2.5"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>
              {submitOk && (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                  {submitOk}
                </p>
              )}
              {submitErr && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  {submitErr}
                </p>
              )}
              <button
                type="submit"
                disabled={submitting || !meta}
                className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-md disabled:opacity-60"
                style={{ backgroundColor: accent }}
              >
                {submitting ? "Sending…" : "Sign in"}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}

export default function GuestSignInPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-50 p-6 text-slate-600">Loading…</main>
      }
    >
      <GuestSignInInner />
    </Suspense>
  );
}
