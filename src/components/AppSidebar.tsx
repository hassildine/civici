"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { DEFAULT_ACCENT_COLOR } from "@/lib/theme";

const CIVICI_LOGO = "/civici-logo.png";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/sheet", label: "Sheet" },
  { href: "/contacts", label: "Contacts" },
  { href: "/activity", label: "Messages" },
  { href: "/settings", label: "Branding" },
];

export function AppSidebar() {
  const pathname = usePathname();
  const recentSheet = useLiveQuery(
    async () => await db.sheets.orderBy("lastOpenedAt").reverse().first(),
    [],
  );

  const isActive = (href: string) => {
    if (href === "/sheet") return pathname === "/sheet" || pathname.startsWith("/sheet/");
    if (href === "/settings")
      return pathname === "/settings" || pathname.startsWith("/settings/");
    return pathname === href;
  };

  return (
    <aside className="w-72 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="mb-6 rounded-lg border border-neutral-200 bg-white px-3 py-2.5">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="shrink-0 rounded-md bg-white outline-none transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-neutral-300"
            aria-label="Civici home"
          >
            <Image
              src={CIVICI_LOGO}
              alt="Civici"
              width={190}
              height={46}
              className="h-[1.625rem] w-auto max-w-[8.75rem] object-contain object-left"
              priority
              unoptimized
            />
          </Link>
          {recentSheet?.logoUrl ? (
            <>
              <span className="shrink-0 text-neutral-300">|</span>
              <Image
                src={recentSheet.logoUrl}
                alt="Brand logo"
                width={160}
                height={40}
                className="h-8 max-h-8 w-auto max-w-[9.5rem] shrink object-contain"
                unoptimized
              />
            </>
          ) : null}
        </div>
        <p className="mt-1 truncate text-xs text-neutral-600">{recentSheet?.officeName ?? "Your Brokerage"}</p>
      </div>

      <nav className="space-y-1">
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-lg px-4 py-3 text-sm transition ${
                active
                  ? "font-semibold underline decoration-2 underline-offset-[10px]"
                  : "font-medium text-neutral-900 hover:bg-neutral-100"
              }`}
              style={active ? { color: DEFAULT_ACCENT_COLOR } : undefined}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
