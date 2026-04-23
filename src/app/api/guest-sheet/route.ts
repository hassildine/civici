import { NextResponse } from "next/server";
import { verifyGuestToken } from "@/lib/guest-link";

/** Public: return sheet UI config for guest sign-in (no PII). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("t") ?? "";
  const payload = verifyGuestToken(token);
  if (!payload) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 400 });
  }

  return NextResponse.json({
    eventName: payload.eventName,
    columnHeaders: payload.columnHeaders,
    logoUrl: payload.logoUrl,
    accentColor: payload.accentColor,
  });
}
