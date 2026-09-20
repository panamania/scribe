import { NextResponse } from "next/server";
import { patchFinding } from "../../../../../lib/canonchecks.js";
import { appendClarification } from "../../../../../lib/clarify.js";

export const dynamic = "force-dynamic";

// Reply to a single canon-check finding.
// action: "canon"  -> write the ruling to canon (Clarifications.md) + resolve
//         "dismiss"-> resolve without writing to canon
//         "undo"   -> un-resolve
export async function POST(req, { params }) {
  const { id } = await params;
  const { chapterId, index, action, ruling = "", quote = "" } = await req.json().catch(() => ({}));
  if (!chapterId || typeof index !== "number" || !action) {
    return NextResponse.json({ error: "chapterId, index, action required" }, { status: 400 });
  }

  let wroteCanon = false;
  let patch;
  if (action === "canon") {
    wroteCanon = await appendClarification(id, { ruling, quote });
    patch = { resolved: true, ruling: ruling.trim() };
  } else if (action === "dismiss") {
    patch = { resolved: true, ruling: ruling.trim() || undefined };
  } else if (action === "undo") {
    patch = { resolved: false, ruling: undefined };
  } else {
    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }

  const finding = await patchFinding(id, chapterId, index, patch);
  return NextResponse.json({ ok: true, finding, wroteCanon });
}
