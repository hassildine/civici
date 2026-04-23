"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser, UserButton } from "@clerk/nextjs";
import { useLiveQuery } from "dexie-react-hooks";
import { db, ensureDatabaseReady } from "@/lib/db";
import { DEFAULT_ACCENT_COLOR } from "@/lib/theme";

type UserLike = {
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  primaryEmailAddress?: { emailAddress: string } | null;
} | null | undefined;

function clerkDisplayName(user: UserLike): string {
  if (!user) return "";
  const full = user.fullName?.trim();
  if (full) return full;
  const f = user.firstName?.trim() ?? "";
  const l = user.lastName?.trim() ?? "";
  const joined = `${f} ${l}`.trim();
  return joined;
}

function initialsFromUser(user: UserLike): string {
  if (!user) return "?";
  const first = user.firstName?.trim();
  const last = user.lastName?.trim();
  if (first && last) return `${first[0]}${last[0]}`.toUpperCase();
  const full = user.fullName?.trim();
  if (full) {
    const parts = full.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
    if (full.length >= 2) return full.slice(0, 2).toUpperCase();
    if (full.length === 1) return `${full[0]}${full[0]}`.toUpperCase();
  }
  const email = user.primaryEmailAddress?.emailAddress;
  if (email) {
    const letters = email.replace(/[^a-zA-Z]/g, "");
    if (letters.length >= 2) return letters.slice(0, 2).toUpperCase();
    if (letters.length === 1) return `${letters[0]}${letters[0]}`.toUpperCase();
  }
  return "?";
}

function initialsFromLocalDisplayName(localDisplayName: string): string {
  const loc = localDisplayName.trim();
  if (!loc) return "?";
  const parts = loc.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
  }
  if (loc.length >= 2) return loc.slice(0, 2).toUpperCase();
  return `${loc[0]}${loc[0]}`.toUpperCase();
}

function displayInitials(user: UserLike, localDisplayName: string): string {
  const fromClerk = initialsFromUser(user);
  if (fromClerk !== "?") return fromClerk;
  return initialsFromLocalDisplayName(localDisplayName);
}

function effectiveDisplayName(user: UserLike, localDisplayName: string): string {
  const fromClerk = clerkDisplayName(user);
  if (fromClerk) return fromClerk;
  const local = localDisplayName.trim();
  if (local) return local;
  if (user?.primaryEmailAddress?.emailAddress) return user.primaryEmailAddress.emailAddress;
  return "Your name";
}

export function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const { user, isLoaded } = useUser();
  const pathname = usePathname();
  const localProfile = useLiveQuery(async () => await db.localProfile.get("default"), []);
  const recentSheet = useLiveQuery(
    async () => await db.sheets.orderBy("lastOpenedAt").reverse().first(),
    [],
  );

  const localDisplayName = localProfile?.displayName ?? "";
  const initials = displayInitials(user, localDisplayName);
  const headlineName = effectiveDisplayName(user, localDisplayName);
  const needsNameHint = initials === "?";

  const sheetMatch = pathname.match(/^\/sheet\/([^/]+)/);
  const sheetIdFromPath = sheetMatch?.[1];
  const brandingSheetId = sheetIdFromPath ?? recentSheet?.id ?? "";

  useEffect(() => {
    void ensureDatabaseReady();
  }, []);

  function openProfileMenu() {
    setError(null);
    setSaved(false);
    const clerk = clerkDisplayName(user);
    const local = localProfile?.displayName?.trim() ?? "";
    setNameInput(clerk || local || "");
    setOpen(true);
  }

  function toggleProfileMenu() {
    if (open) {
      setOpen(false);
      return;
    }
    openProfileMenu();
  }

  async function handleSaveName() {
    setError(null);
    setSaved(false);
    const trimmed = nameInput.trim();
    if (!trimmed) {
      setError("Enter your name.");
      return;
    }
    setSaving(true);
    try {
      await ensureDatabaseReady();
      await db.localProfile.put({
        id: "default",
        displayName: trimmed,
        updatedAt: new Date().toISOString(),
      });
      if (user) {
        const parts = trimmed.split(/\s+/).filter(Boolean);
        const firstName = parts[0] ?? "";
        const lastName = parts.length > 1 ? parts.slice(1).join(" ") : firstName;
        await user.update({ firstName, lastName });
        await user.reload();
      }
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save name.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Profile menu"
        onClick={toggleProfileMenu}
        className="flex h-10 w-10 items-center justify-center rounded-full text-xs font-semibold text-white shadow-sm ring-1 ring-black/5 transition hover:brightness-110"
        style={{ backgroundColor: DEFAULT_ACCENT_COLOR }}
      >
        {!isLoaded ? "…" : initials}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-72 rounded-lg border border-neutral-200 bg-white p-4 shadow-lg">
          <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Profile</p>
          <p className="mt-2 text-sm font-semibold text-neutral-950">{headlineName}</p>
          <p className="mt-1 text-sm text-neutral-600">
            {recentSheet?.officeName ?? "Your brokerage"}
          </p>

          {needsNameHint ? (
            <p className="mt-2 rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-950">
              Add how you&apos;d like to be addressed—saved here and on your account when you&apos;re
              signed in.
            </p>
          ) : null}

          <label className="mt-3 block text-xs font-medium text-neutral-700">
            Your name
            <input
              type="text"
              className="mt-1 w-full rounded-md border border-neutral-300 px-2.5 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="e.g. Jordan Lee"
              maxLength={120}
              autoComplete="name"
            />
          </label>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSaveName()}
            className="mt-2 w-full rounded-md bg-neutral-950 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save name"}
          </button>
          {saved ? <p className="mt-2 text-xs text-green-700">Saved.</p> : null}
          {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}

          <div className="mt-3 flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2">
            <span className="text-xs text-neutral-500">Account</span>
            <UserButton />
          </div>
          {brandingSheetId ? (
            <Link
              href={`/settings/${brandingSheetId}`}
              onClick={() => setOpen(false)}
              className="mt-3 block rounded-md border border-neutral-200 px-3 py-2 text-center text-sm font-medium text-neutral-800 hover:bg-neutral-50"
            >
              Branding for this sheet
            </Link>
          ) : (
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="mt-3 block rounded-md border border-neutral-200 px-3 py-2 text-center text-sm font-medium text-neutral-800 hover:bg-neutral-50"
            >
              Branding settings
            </Link>
          )}
        </div>
      ) : null}
    </div>
  );
}
