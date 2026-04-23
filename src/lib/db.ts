"use client";

import Dexie, { type EntityTable } from "dexie";
import { DEFAULT_ACCENT_COLOR, resolveSheetAccentColor } from "@/lib/theme";

export type FontStyle = "sans" | "serif" | "mono";

/** Per-document sign-in sheet (branding + columns saved per sheet). */
export interface Sheet {
  id: string;
  officeName: string;
  eventName: string;
  logoUrl: string;
  headerText: string;
  thankYouTemplate: string;
  /** Agent's E.164 sender; must be allowed on Twilio. Falls back to TWILIO_FROM_NUMBER. */
  sendFromPhone: string;
  accentColor: string;
  fontStyle: FontStyle;
  fieldOrder: string[];
  columnHeaders: {
    name: string;
    email: string;
    phone: string;
    notes: string;
  };
  offlineSheetDownloaded: boolean;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string;
}

export interface FormConfig {
  id: "default";
  officeName: string;
  eventName: string;
  logoUrl: string;
  headerText: string;
  thankYouTemplate: string;
  accentColor: string;
  fontStyle: FontStyle;
  fieldOrder: string[];
  columnHeaders: {
    name: string;
    email: string;
    phone: string;
    notes: string;
  };
  offlineSheetDownloaded: boolean;
  updatedAt: string;
}

export interface Lead {
  id: string;
  sheetId: string;
  fullName: string;
  phone: string;
  email: string;
  notes?: string;
  eventName: string;
  createdAt: string;
  syncedAt?: string;
}

export interface OutboundQueueItem {
  id: string;
  leadId: string;
  sheetId: string;
  status: "pending" | "sent" | "failed";
  error?: string;
  createdAt: string;
  updatedAt: string;
}

/** Local preferred name when Clerk has no name yet (or offline). Synced to Clerk when signed in. */
export interface LocalProfile {
  id: "default";
  displayName: string;
  updatedAt: string;
}

const defaultConfig: FormConfig = {
  id: "default",
  officeName: "Your Brokerage",
  eventName: "123 Main St Open House",
  logoUrl: "",
  headerText: "Welcome! Please sign in.",
  thankYouTemplate:
    "Thanks {firstName} for attending the {eventName} open house. Reply to this number if you have questions.",
  accentColor: DEFAULT_ACCENT_COLOR,
  fontStyle: "sans",
  fieldOrder: ["fullName", "phone", "email", "notes"],
  columnHeaders: {
    name: "Name",
    email: "Email",
    phone: "Phone Number",
    notes: "Notes",
  },
  offlineSheetDownloaded: false,
  updatedAt: new Date().toISOString(),
};

function formConfigToSheet(id: string, fc: FormConfig, now: string): Sheet {
  return {
    id,
    officeName: fc.officeName,
    eventName: fc.eventName,
    logoUrl: fc.logoUrl,
    headerText: fc.headerText,
    thankYouTemplate: fc.thankYouTemplate,
    sendFromPhone: "",
    accentColor: fc.accentColor,
    fontStyle: fc.fontStyle,
    fieldOrder: [...fc.fieldOrder],
    columnHeaders: { ...fc.columnHeaders },
    offlineSheetDownloaded: fc.offlineSheetDownloaded,
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: now,
  };
}

class OpenHouseDB extends Dexie {
  leads!: EntityTable<Lead, "id">;
  queue!: EntityTable<OutboundQueueItem, "id">;
  formConfig!: EntityTable<FormConfig, "id">;
  sheets!: EntityTable<Sheet, "id">;
  localProfile!: EntityTable<LocalProfile, "id">;

  constructor() {
    super("open-house-db");
    this.version(1).stores({
      leads: "id, createdAt, syncedAt, eventName",
      queue: "id, leadId, status, createdAt, updatedAt",
      formConfig: "id, updatedAt",
    });
    this.version(2)
      .stores({
        leads: "id, createdAt, syncedAt, eventName",
        queue: "id, leadId, status, createdAt, updatedAt",
        formConfig: "id, updatedAt",
      })
      .upgrade(async (transaction) => {
        const configs = transaction.table("formConfig");
        const existing = await configs.get("default");
        if (!existing) return;
        await configs.put({
          ...existing,
          columnHeaders: existing.columnHeaders ?? defaultConfig.columnHeaders,
          offlineSheetDownloaded:
            typeof existing.offlineSheetDownloaded === "boolean"
              ? existing.offlineSheetDownloaded
              : false,
          updatedAt: new Date().toISOString(),
        });
      });
    this.version(3)
      .stores({
        leads: "id, sheetId, createdAt, syncedAt, eventName",
        queue: "id, leadId, sheetId, status, createdAt, updatedAt",
        formConfig: "id, updatedAt",
        sheets: "id, lastOpenedAt, updatedAt, createdAt",
      })
      .upgrade(async (transaction) => {
        const sheetsTable = transaction.table("sheets");
        const sheetCount = await sheetsTable.count();
        if (sheetCount > 0) return;

        const fcTable = transaction.table("formConfig");
        let fc = (await fcTable.get("default")) as FormConfig | undefined;
        if (!fc) {
          fc = defaultConfig;
          await fcTable.put(fc);
        }

        const now = new Date().toISOString();
        const sheetId = crypto.randomUUID();
        await sheetsTable.add(formConfigToSheet(sheetId, fc, now));

        const leadsTable = transaction.table("leads");
        await leadsTable.toCollection().modify((lead: Lead & { sheetId?: string }) => {
          if (!lead.sheetId) lead.sheetId = sheetId;
        });

        const queueTable = transaction.table("queue");
        const leadsMap = new Map<string, string>();
        await leadsTable.each((l: Lead) => leadsMap.set(l.id, l.sheetId));
        await queueTable.toCollection().modify((item: OutboundQueueItem & { sheetId?: string }) => {
          if (!item.sheetId) {
            item.sheetId = leadsMap.get(item.leadId) ?? sheetId;
          }
        });
      });
    this.version(4)
      .stores({
        leads: "id, sheetId, createdAt, syncedAt, eventName",
        queue: "id, leadId, sheetId, status, createdAt, updatedAt",
        formConfig: "id, updatedAt",
        sheets: "id, lastOpenedAt, updatedAt, createdAt",
      })
      .upgrade(async (transaction) => {
        const sheetsTable = transaction.table("sheets");
        await sheetsTable.toCollection().modify((s: Sheet & { sendFromPhone?: string }) => {
          if (s.sendFromPhone === undefined) s.sendFromPhone = "";
        });
      });
    this.version(5)
      .stores({
        leads: "id, sheetId, createdAt, syncedAt, eventName",
        queue: "id, leadId, sheetId, status, createdAt, updatedAt",
        formConfig: "id, updatedAt",
        sheets: "id, lastOpenedAt, updatedAt, createdAt",
      })
      .upgrade(async (transaction) => {
        const legacyDefault = "#2563eb";
        const sheetsTable = transaction.table("sheets");
        await sheetsTable.toCollection().modify((s: Sheet) => {
          if (s.accentColor?.toLowerCase() === legacyDefault) {
            s.accentColor = DEFAULT_ACCENT_COLOR;
          }
        });
        const fcTable = transaction.table("formConfig");
        await fcTable.toCollection().modify((fc: FormConfig) => {
          if (fc.accentColor?.toLowerCase() === legacyDefault) {
            fc.accentColor = DEFAULT_ACCENT_COLOR;
          }
        });
      });
    this.version(6).stores({
      leads: "id, sheetId, createdAt, syncedAt, eventName",
      queue: "id, leadId, sheetId, status, createdAt, updatedAt",
      formConfig: "id, updatedAt",
      sheets: "id, lastOpenedAt, updatedAt, createdAt",
      localProfile: "id, updatedAt",
    });
  }
}

export const db = new OpenHouseDB();

export async function ensureDefaultConfig() {
  const exists = await db.formConfig.get("default");
  if (!exists) {
    await db.formConfig.put(defaultConfig);
  }
}

const LEGACY_ACCENT_HEX = "#2563eb";

/** Writes new default accent over the old built-in blue (Dexie upgrade can miss edge cases). */
async function patchLegacyDefaultAccentColors() {
  const now = new Date().toISOString();
  const sheets = await db.sheets.toArray();
  for (const s of sheets) {
    if (s.accentColor?.trim().toLowerCase() === LEGACY_ACCENT_HEX) {
      await db.sheets.update(s.id, { accentColor: DEFAULT_ACCENT_COLOR, updatedAt: now });
    }
  }
  const fc = await db.formConfig.get("default");
  if (fc && fc.accentColor?.trim().toLowerCase() === LEGACY_ACCENT_HEX) {
    await db.formConfig.put({ ...fc, accentColor: DEFAULT_ACCENT_COLOR, updatedAt: now });
  }
}

const defaultLocalProfile: LocalProfile = {
  id: "default",
  displayName: "",
  updatedAt: new Date().toISOString(),
};

async function ensureLocalProfile() {
  const row = await db.localProfile.get("default");
  if (!row) {
    await db.localProfile.put({ ...defaultLocalProfile, updatedAt: new Date().toISOString() });
  }
}

/** Ensures legacy config + at least one sheet (migration v3). */
export async function ensureDatabaseReady() {
  await ensureDefaultConfig();
  await patchLegacyDefaultAccentColors();
  await ensureLocalProfile();
  const count = await db.sheets.count();
  if (count === 0) {
    const fc = (await db.formConfig.get("default")) ?? defaultConfig;
    const now = new Date().toISOString();
    const sheetId = crypto.randomUUID();
    await db.sheets.add(formConfigToSheet(sheetId, fc, now));
    await db.leads.toCollection().modify((lead: Lead & { sheetId?: string }) => {
      if (!lead.sheetId) lead.sheetId = sheetId;
    });
    const leadsMap = new Map<string, string>();
    await db.leads.each((l) => leadsMap.set(l.id, l.sheetId));
    await db.queue.toCollection().modify((item: OutboundQueueItem & { sheetId?: string }) => {
      if (!item.sheetId) item.sheetId = leadsMap.get(item.leadId) ?? sheetId;
    });
  }
}

export async function touchSheetLastOpened(sheetId: string) {
  const now = new Date().toISOString();
  await db.sheets.update(sheetId, { lastOpenedAt: now, updatedAt: now });
}

export async function createBlankSheet(): Promise<string> {
  await ensureDatabaseReady();
  const template = await db.sheets.orderBy("lastOpenedAt").reverse().first();
  if (!template) {
    const fc = (await db.formConfig.get("default")) ?? defaultConfig;
    const now = new Date().toISOString();
    const fallbackId = crypto.randomUUID();
    await db.sheets.add(formConfigToSheet(fallbackId, fc, now));
    return fallbackId;
  }
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const next: Sheet = {
    ...template,
    id,
    eventName: "Untitled open house",
    accentColor: resolveSheetAccentColor(template.accentColor),
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: now,
    offlineSheetDownloaded: false,
  };
  await db.sheets.add(next);
  return id;
}

/** Most recently opened sheet (for sidebar accent, redirects). */
export async function getMostRecentSheetId(): Promise<string | undefined> {
  await ensureDatabaseReady();
  const s = await db.sheets.orderBy("lastOpenedAt").reverse().first();
  return s?.id;
}
