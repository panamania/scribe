import { storage } from "./storage.js";
import { canonDir } from "./books.js";

// The canon-check report is written into CanonLog.md between these markers.
// Re-running the check replaces ONLY this block, so the author's own sections
// (locked decisions, proposals, etc.) are preserved. The block is also stripped
// from the canon that gets sent to Opus, so findings never pollute generation.
export const MARK_START =
  "<!-- CANON-CHECK:START (auto-generated — re-running the canon check overwrites this section) -->";
export const MARK_END = "<!-- CANON-CHECK:END -->";

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const BLOCK_RE = new RegExp(escapeRe(MARK_START) + "[\\s\\S]*?" + escapeRe(MARK_END), "g");

export function stripCanonCheck(text) {
  return String(text || "").replace(BLOCK_RE, "").replace(/\n{3,}/g, "\n\n").trim();
}

function buildBlock(chapterTitle, findings) {
  const now = new Date().toISOString().slice(0, 16).replace("T", " ");
  const lines = [MARK_START, `## Canon Check — ${chapterTitle || "chapter"} (${now})`, ""];
  if (!findings.length) {
    lines.push("_No canon issues found in this pass._");
  } else {
    findings.forEach((f, i) => {
      lines.push(`${i + 1}. **[${f.severity || "note"}] ${f.issue}**`);
      if (f.fix) lines.push(`   - Fix: ${f.fix}`);
      if (f.quote) lines.push(`   - At: “${f.quote}”`);
    });
  }
  lines.push("", MARK_END);
  return lines.join("\n");
}

// Repopulates the managed section of CanonLog.md, preserving everything else.
export async function writeCanonLog(bookId, chapterTitle, findings) {
  const fileKey = `${canonDir(bookId)}/CanonLog.md`;
  const existing = (await storage.getText(fileKey)) || "";

  const block = buildBlock(chapterTitle, findings);
  let next;
  if (BLOCK_RE.test(existing)) {
    next = existing.replace(BLOCK_RE, block);
  } else if (existing.trim()) {
    next = existing.replace(/\s*$/, "") + "\n\n" + block + "\n";
  } else {
    next = "# Canon Log\n\n" + block + "\n";
  }
  await storage.putText(fileKey, next);
  return true;
}
