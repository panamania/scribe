import fs from "node:fs/promises";
import path from "node:path";
import { canonDir } from "./books.js";
import { stripCanonCheck } from "./canonlog.js";

// Loads the FULL text of every canon .md file for a book on each request, so
// Opus reads the whole bible every time — always current. Canon is optional;
// a book with no canon files simply gets an empty bible.

export async function loadCanon(book) {
  const dir = canonDir(book);
  let files = [];
  try {
    files = (await fs.readdir(dir)).filter((f) => f.endsWith(".md"));
  } catch {
    return { text: "", files: [], missing: true, dir };
  }
  files.sort();
  const parts = [];
  const loaded = [];
  for (const f of files) {
    const raw = await fs.readFile(path.join(dir, f), "utf-8");
    const clean = stripCanonCheck(raw); // don't feed auto-generated check results back to Opus
    parts.push(`===== FILE: ${f} =====\n${clean}`);
    loaded.push({ name: f, chars: raw.length });
  }
  return { text: parts.join("\n\n"), files: loaded, missing: false, dir };
}
