"use client";

import Link from "next/link";
import { useState } from "react";

export function WaffleMenu() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="fixed right-4 top-4 z-50">
      <button
        type="button"
        aria-label="Open menu"
        onClick={() => setIsOpen((prev) => !prev)}
        className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:shadow"
      >
        <span className="grid grid-cols-3 gap-1">
          {Array.from({ length: 9 }).map((_, index) => (
            <span key={index} className="h-1.5 w-1.5 rounded-full bg-slate-700" />
          ))}
        </span>
      </button>

      {isOpen ? (
        <div className="mt-2 min-w-48 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
          <Link
            href="/"
            className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
            onClick={() => setIsOpen(false)}
          >
            Dashboard
          </Link>
          <Link
            href="/sheet"
            className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
            onClick={() => setIsOpen(false)}
          >
            Sheet
          </Link>
          <Link
            href="/contacts"
            className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
            onClick={() => setIsOpen(false)}
          >
            Contacts
          </Link>
          <Link
            href="/activity"
            className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
            onClick={() => setIsOpen(false)}
          >
            Messages
          </Link>
          <Link
            href="/settings"
            className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
            onClick={() => setIsOpen(false)}
          >
            Branding
          </Link>
        </div>
      ) : null}
    </div>
  );
}
