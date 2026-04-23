import { z } from "zod";
import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { compileMessage } from "@/lib/message";

const payloadSchema = z
  .object({
    id: z.string(),
    fullName: z.string().min(1),
    phone: z.string().min(7),
    email: z.email().optional().or(z.literal("")),
    notes: z.string().optional(),
    eventName: z.string().min(1),
    createdAt: z.string(),
    thankYouTemplate: z.string().min(1),
    sheetId: z.string().optional(),
    /** E.164 Twilio From; must be verified on account. Falls back to TWILIO_FROM_NUMBER. */
    twilioFrom: z.string().optional(),
  })
  .passthrough();

async function sendTwilioSms(to: string, message: string, fromOverride?: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = fromOverride?.trim() || process.env.TWILIO_FROM_NUMBER;

  if (!sid || !token || !from) {
    return { simulated: true };
  }

  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const body = new URLSearchParams({
    To: to,
    From: from,
    Body: message,
  });

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Twilio send failed: ${text}`);
  }
}

export async function POST(request: Request) {
  try {
    const parsed = payloadSchema.parse(await request.json());
    const message = compileMessage(parsed.thankYouTemplate, parsed);
    const supabase = getSupabaseServerClient();

    if (supabase) {
      const { error } = await supabase.from("open_house_leads").insert({
        id: parsed.id,
        full_name: parsed.fullName,
        phone: parsed.phone,
        email: parsed.email || null,
        notes: parsed.notes || null,
        event_name: parsed.eventName,
        created_at: parsed.createdAt,
        thank_you_message: message,
      });

      if (error) {
        throw new Error(error.message);
      }
    }

    await sendTwilioSms(parsed.phone, message, parsed.twilioFrom);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to sync lead";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
