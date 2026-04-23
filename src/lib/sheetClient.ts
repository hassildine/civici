"use client";

import { db, type Sheet } from "@/lib/db";

export async function syncPendingLeads() {
  const pending = await db.queue.where("status").equals("pending").toArray();
  let sentCount = 0;

  for (const item of pending) {
    const lead = await db.leads.get(item.leadId);
    if (!lead) {
      await db.queue.delete(item.id);
      continue;
    }

    const sheet = await db.sheets.get(lead.sheetId);
    const thankYouTemplate =
      sheet?.thankYouTemplate ??
      "Thanks {firstName} for attending the {eventName} open house.";
    const twilioFrom = sheet?.sendFromPhone?.trim() || undefined;

    try {
      const response = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...lead,
          thankYouTemplate,
          twilioFrom,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Sync failed");
      }

      const now = new Date().toISOString();
      await db.leads.update(lead.id, { syncedAt: now });
      await db.queue.update(item.id, {
        status: "sent",
        updatedAt: now,
        error: undefined,
      });
      sentCount += 1;
    } catch (error) {
      await db.queue.update(item.id, {
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
        updatedAt: new Date().toISOString(),
      });
    }
  }

  return sentCount;
}

function phoneKey(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length >= 10) return digits.slice(-10);
  return digits || phone.trim().toLowerCase();
}

export async function exportLeadsToCsv(filename = "open-house-leads.csv", sheetId?: string) {
  const allForTrends = await db.leads.orderBy("createdAt").toArray();
  const leads = sheetId
    ? await db.leads.where("sheetId").equals(sheetId).sortBy("createdAt")
    : allForTrends;
  const now = Date.now();
  const windowStart = now - 30 * 24 * 60 * 60 * 1000;

  const header = [
    "name",
    "email",
    "phone",
    "phoneKey",
    "notes",
    "eventName",
    "sheetId",
    "createdAt",
    "signInsLast30d",
    "distinctEventsLast30d",
    "signInsAllTime",
  ];
  const rows = leads.map((lead) => {
    const key = phoneKey(lead.phone);
    const samePhone = allForTrends.filter((l) => phoneKey(l.phone) === key);
    const in30 = samePhone.filter((l) => new Date(l.createdAt).getTime() >= windowStart);
    const distinctEvents30 = new Set(in30.map((l) => l.eventName)).size;
    return [
      lead.fullName,
      lead.email ?? "",
      lead.phone,
      key,
      lead.notes ?? "",
      lead.eventName,
      lead.sheetId,
      lead.createdAt,
      String(in30.length),
      String(distinctEvents30),
      String(samePhone.length),
    ];
  });
  const csv = [header, ...rows]
    .map((row) =>
      row
        .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
        .join(","),
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function downloadOfflineSheetBundle(sheet: Sheet) {
  const leads = await db.leads.where("sheetId").equals(sheet.id).sortBy("createdAt");
  const pending = await db.queue.where("status").equals("pending").toArray();
  const pendingQueue = [];
  for (const item of pending) {
    const lead = await db.leads.get(item.leadId);
    if (lead?.sheetId === sheet.id) pendingQueue.push(item);
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    sheet,
    leads,
    pendingQueue,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `offline-sheet-${sheet.id.slice(0, 8)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
