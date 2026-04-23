import { createHmac, timingSafeEqual } from "node:crypto";

export type GuestPayload = {
  exp: number;
  sheetId: string;
  eventName: string;
  thankYouTemplate: string;
  sendFromPhone: string;
  columnHeaders: {
    name: string;
    email: string;
    phone: string;
    notes: string;
  };
  logoUrl: string;
  accentColor: string;
};

function getSecret() {
  const s = process.env.GUEST_LINK_SECRET;
  if (!s || s.length < 16) {
    return null;
  }
  return s;
}

export function signGuestPayload(payload: GuestPayload): string | null {
  const secret = getSecret();
  if (!secret) return null;
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyGuestToken(token: string): GuestPayload | null {
  const secret = getSecret();
  if (!secret) return null;
  const dot = token.indexOf(".");
  if (dot < 1) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  try {
    if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return null;
    }
  } catch {
    return null;
  }
  try {
    const raw = Buffer.from(body, "base64url").toString("utf8");
    const parsed = JSON.parse(raw) as GuestPayload;
    if (typeof parsed.exp !== "number" || parsed.exp < Date.now() / 1000) return null;
    if (!parsed.sheetId || !parsed.eventName || !parsed.thankYouTemplate) return null;
    return parsed;
  } catch {
    return null;
  }
}
