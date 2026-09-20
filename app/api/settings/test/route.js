import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { anthropicOptions } from "../../../../lib/settings.js";
import { describeApiError } from "../../../../lib/apierror.js";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Pings the API with a tiny, cheap request to confirm the key + billing.
export async function POST() {
  const { opts, hasKey } = await anthropicOptions();
  if (!hasKey) {
    return NextResponse.json({ ok: false, code: "nokey", message: "No API key is set. Add one above and Save first." });
  }
  const client = new Anthropic(opts);
  try {
    await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1,
      messages: [{ role: "user", content: "ping" }],
    });
    return NextResponse.json({ ok: true, code: "ok", message: "Key works — you're good to go." });
  } catch (err) {
    const d = describeApiError(err);
    if (d.code === "billing") {
      d.message = "Key is valid, but the account is out of credits. Add credits at console.anthropic.com → Billing.";
    }
    return NextResponse.json({ ok: false, ...d });
  }
}
