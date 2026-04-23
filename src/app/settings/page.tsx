"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ensureDatabaseReady, getMostRecentSheetId } from "@/lib/db";
import { useDb } from "@/components/DbProvider";

export default function SettingsIndexRedirect() {
  const db = useDb();
  const router = useRouter();

  useEffect(() => {
    void (async () => {
      await ensureDatabaseReady(db);
      const id = await getMostRecentSheetId(db);
      if (id) router.replace(`/settings/${id}`);
      else router.replace("/");
    })();
  }, [router, db]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 text-neutral-600">
      Loading branding…
    </main>
  );
}
