import { NextResponse } from "next/server";
import {
  readSettings,
  writeSettings,
  effectiveApiKey,
  maskKey,
} from "../../../lib/settings.js";

export const dynamic = "force-dynamic";

// GET returns status only — never the raw API key.
function statusPayload(s, key, source) {
  return {
    model: s.model || "claude-opus-4-8",
    workspaceId: s.workspaceId || "",
    hasKey: !!key,
    keyMasked: maskKey(key),
    keySource: source, // "settings" | "env" | "none"
    envKeyPresent: !!process.env.ANTHROPIC_API_KEY,
  };
}

export async function GET() {
  const s = await readSettings();
  const { key, source } = await effectiveApiKey();
  return NextResponse.json(statusPayload(s, key, source));
}

export async function POST(req) {
  const { apiKey, model, clearKey, workspaceId } = await req.json().catch(() => ({}));
  const patch = {};
  if (clearKey) patch.anthropicApiKey = "";
  else if (typeof apiKey === "string" && apiKey.trim()) patch.anthropicApiKey = apiKey.trim();
  if (typeof model === "string" && model.trim()) patch.model = model.trim();
  if (typeof workspaceId === "string") patch.workspaceId = workspaceId.trim();
  await writeSettings(patch);

  const { key, source } = await effectiveApiKey();
  const s = await readSettings();
  return NextResponse.json({ ok: true, ...statusPayload(s, key, source) });
}
