import { storage } from "./storage.js";
import { canonDir } from "./books.js";

// Author rulings that answer canon-check findings are appended to a real canon
// file (Clarifications.md), so they persist and are fed to Opus on every future
// check — meaning a resolved point won't be flagged again.
export async function appendClarification(bookId, { ruling, quote }) {
  const text = String(ruling || "").trim();
  if (!text) return false;
  const fileKey = `${canonDir(bookId)}/Clarifications.md`;

  let existing = (await storage.getText(fileKey)) || "";
  if (!existing.trim()) {
    existing =
      "# Clarifications & Rulings\n\nAuthor decisions that resolve canon-check questions. Treat these as canon.\n\n## Rulings\n";
  } else if (!existing.includes("## Rulings")) {
    existing = existing.replace(/\s*$/, "") + "\n\n## Rulings\n";
  }

  const date = new Date().toISOString().slice(0, 10);
  const entry = `- ${text}${quote ? `  _(re: “${quote.trim()}”)_` : ""}  — ${date}`;
  const next = existing.replace(/\s*$/, "") + "\n" + entry + "\n";
  await storage.putText(fileKey, next);
  return true;
}
