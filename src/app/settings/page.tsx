"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ensureDatabaseReady, getMostRecentSheetId } from "@/lib/db";

export default function SettingsIndexRedirect() {
  const router = useRouter();

  useEffect(() => {
    void (async () => {
      await ensureDatabaseReady();
      const id = await getMostRecentSheetId();
      if (id) router.replace(`/settings/${id}`);
      else router.replace("/");
    })();
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 text-neutral-600">
      Loading branding…
    </main>
  );
}
