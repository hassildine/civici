"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ensureDatabaseReady, getMostRecentSheetId } from "@/lib/db";

export default function SheetIndexRedirect() {
  const router = useRouter();

  useEffect(() => {
    void (async () => {
      await ensureDatabaseReady();
      const id = await getMostRecentSheetId();
      if (id) {
        router.replace(`/sheet/${id}`);
      } else {
        router.replace("/");
      }
    })();
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 text-neutral-600">
      Opening your sheet…
    </main>
  );
}
