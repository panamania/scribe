import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { loadCanon } from "../../../../../lib/canon.js";
import {
  anthropicOptions,
  effectiveModel,
  cachedSystem,
  cacheUsageLine,
} from "../../../../../lib/settings.js";
import { describeApiError } from "../../../../../lib/apierror.js";
import { writeCanonLog } from "../../../../../lib/canonlog.js";
import { getCheck, saveCheck } from "../../../../../lib/canonchecks.js";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Retrieve the most recent saved findings for a chapter.
export async function GET(req, { params }) {
  const { id } = await params;
  const chapterId = new URL(req.url).searchParams.get("chapterId");
  if (!chapterId) return NextResponse.json({ findings: null, ranAt: null });
  const check = await getCheck(id, chapterId);
  return NextResponse.json({
    findings: check?.findings || null,
    ranAt: check?.ranAt || null,
  });
}

function parseFindings(text) {
  let t = String(text || "").trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const s = t.indexOf("{");
  const e = t.lastIndexOf("}");
  if (s >= 0 && e > s) t = t.slice(s, e + 1);
  try {
    const obj = JSON.parse(t);
    if (Array.isArray(obj.findings)) {
      return obj.findings
        .filter((f) => f && (f.issue || f.fix))
        .map((f) => ({
          severity: f.severity || "note",
          issue: String(f.issue || "").trim(),
          fix: String(f.fix || "").trim(),
          quote: String(f.quote || "").trim(),
        }));
    }
  } catch {}
  return [];
}

export async function POST(req, { params }) {
  const { id } = await params;
  const { chapterId = "", chapterTitle = "", body = "", selection = "" } = await req.json().catch(() => ({}));

  const { opts, hasKey } = await anthropicOptions();
  if (!hasKey) {
    return NextResponse.json(
      { error: "No Anthropic API key set. Open Settings and add your key." },
      { status: 400 }
    );
  }

  const canon = await loadCanon(id);
  const target = selection && selection.trim() ? selection : body;

  const system = `You are a meticulous continuity editor for a novel. Check the PASSAGE against the CANON BIBLE and report every problem as a fixable task.

===== CANON BIBLE =====
${canon.missing || !canon.text ? "(No canon files defined for this book yet.)" : canon.text}

Return ONLY valid JSON — no prose, no code fence — in exactly this shape:
{"findings":[{"severity":"contradiction","issue":"short description of what's wrong","fix":"the concrete change to make","quote":"a VERBATIM 5-14 word snippet copied exactly from the PASSAGE where the problem occurs"}]}
Severity is one of: "contradiction" (breaks canon), "term" (wrong name/spelling vs canon), "continuity" (internal inconsistency or risk).
Rules:
- "quote" MUST be copied character-for-character from the PASSAGE so the author can locate it. Never paraphrase or invent it.
- Every finding must be actionable: "fix" says exactly what to change.
- If the passage is fully consistent with canon, return {"findings":[]}.
- Order contradictions first, then term, then continuity.`;

  const user = `PASSAGE — "${chapterTitle}":\n\n${target || "(empty)"}`;

  const client = new Anthropic(opts);
  let findings = [];
  try {
    const msg = await client.messages.create({
      model: await effectiveModel(),
      max_tokens: 2200,
      // Cache the (static) editor prompt + canon bible for cheap re-use.
      system: cachedSystem(system),
      messages: [{ role: "user", content: user }],
    });
    console.log(cacheUsageLine("canoncheck", msg.usage));
    const text = (msg.content || []).map((b) => (b.type === "text" ? b.text : "")).join("");
    findings = parseFindings(text);
  } catch (err) {
    const d = describeApiError(err);
    return NextResponse.json({ error: d.message }, { status: 400 });
  }

  let wroteLog = false;
  try {
    wroteLog = await writeCanonLog(id, chapterTitle, findings);
  } catch {}

  let ranAt = Date.now();
  try {
    const saved = await saveCheck(id, chapterId, chapterTitle, findings);
    if (saved?.ranAt) ranAt = saved.ranAt;
  } catch {}

  return NextResponse.json({ findings, wroteLog, ranAt });
}
