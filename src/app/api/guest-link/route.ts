import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { signGuestPayload } from "@/lib/guest-link";
import { resolveSheetAccentColor } from "@/lib/theme";

const bodySchema = z.object({
  sheetId: z.string().min(1),
  eventName: z.string().min(1),
  thankYouTemplate: z.string().min(1),
  sendFromPhone: z.string().optional(),
  columnHeaders: z.object({
    name: z.string(),
    email: z.string(),
    phone: z.string(),
    notes: z.string(),
  }),
  logoUrl: z.string().optional(),
  accentColor: z.string().optional(),
});

/** Agent-only: mint a signed link guests can open to sign in (no login). */
export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = bodySchema.parse(await request.json());
    const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 90; // 90 days

    const token = signGuestPayload({
      exp,
      sheetId: parsed.sheetId,
      eventName: parsed.eventName,
      thankYouTemplate: parsed.thankYouTemplate,
      sendFromPhone: parsed.sendFromPhone?.trim() ?? "",
      columnHeaders: parsed.columnHeaders,
      logoUrl: parsed.logoUrl ?? "",
      accentColor: resolveSheetAccentColor(parsed.accentColor),
    });

    if (!token) {
      return NextResponse.json(
        {
          error:
            "Server missing GUEST_LINK_SECRET (set a long random string in env to enable guest links).",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ token });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bad request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
