import fs from "node:fs/promises";
import path from "node:path";
import { bookDir } from "./books.js";

// Persists the most recent canon-check findings per chapter, so they can be
// retrieved later without re-running. Kept outside canon/ so it's never fed to Opus.
function file(bookId) {
  return path.join(bookDir(bookId), "canonchecks.json");
}

export async function readAll(bookId) {
  try {
    return JSON.parse(await fs.readFile(file(bookId), "utf-8"));
  } catch {
    return {};
  }
}

export async function getCheck(bookId, chapterId) {
  const all = await readAll(bookId);
  return all[chapterId] || null;
}

export async function saveCheck(bookId, chapterId, chapterTitle, findings) {
  if (!chapterId) return null;
  const all = await readAll(bookId);
  all[chapterId] = { ranAt: Date.now(), chapterTitle, findings };
  await fs.mkdir(bookDir(bookId), { recursive: true });
  await fs.writeFile(file(bookId), JSON.stringify(all, null, 2), "utf-8");
  return all[chapterId];
}

// Merge a patch into one finding (by index) of a chapter's saved set.
export async function patchFinding(bookId, chapterId, index, patch) {
  const all = await readAll(bookId);
  const entry = all[chapterId];
  if (!entry || !Array.isArray(entry.findings) || !entry.findings[index]) return null;
  entry.findings[index] = { ...entry.findings[index], ...patch };
  await fs.mkdir(bookDir(bookId), { recursive: true });
  await fs.writeFile(file(bookId), JSON.stringify(all, null, 2), "utf-8");
  return entry.findings[index];
}
