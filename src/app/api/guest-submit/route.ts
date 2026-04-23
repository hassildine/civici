import { z } from "zod";
import { NextResponse } from "next/server";
import { verifyGuestToken } from "@/lib/guest-link";
import { getSupabaseServerClient } from "@/lib/supabase";
import { compileMessage } from "@/lib/message";

const bodySchema = z.object({
  token: z.string().min(10),
  fullName: z.string().min(1),
  phone: z.string().min(7),
  email: z.email().optional().or(z.literal("")),
  notes: z.string().optional(),
});

async function sendTwilioSms(to: string, from: string, message: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;

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

/** Public: guest submits one row; stores lead + sends thank-you SMS when possible. */
export async function POST(request: Request) {
  try {
    const parsed = bodySchema.parse(await request.json());
    const sheet = verifyGuestToken(parsed.token);
    if (!sheet) {
      return NextResponse.json({ error: "Invalid or expired link" }, { status: 400 });
    }

    const createdAt = new Date().toISOString();
    const leadId = crypto.randomUUID();
    const eventName = sheet.eventName;
    const message = compileMessage(sheet.thankYouTemplate, {
      fullName: parsed.fullName,
      eventName,
    });

    const fromNumber =
      sheet.sendFromPhone?.trim() || process.env.TWILIO_FROM_NUMBER || "";

    const supabase = getSupabaseServerClient();
    if (supabase) {
      const { error } = await supabase.from("open_house_leads").insert({
        id: leadId,
        full_name: parsed.fullName,
        phone: parsed.phone,
        email: parsed.email || null,
        notes: parsed.notes || null,
        event_name: eventName,
        created_at: createdAt,
        thank_you_message: message,
      });
      if (error) {
        throw new Error(error.message);
      }
    }

    await sendTwilioSms(parsed.phone, fromNumber, message);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save sign-in";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
