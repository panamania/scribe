import { storage } from "./storage.js";
import { bookDir } from "./books.js";

// Persists the most recent canon-check findings per chapter, so they can be
// retrieved later without re-running. Kept outside canon/ so it's never fed to Opus.
function key(bookId) {
  return `${bookDir(bookId)}/canonchecks.json`;
}

export async function readAll(bookId) {
  return (await storage.getJSON(key(bookId))) || {};
}

export async function getCheck(bookId, chapterId) {
  const all = await readAll(bookId);
  return all[chapterId] || null;
}

export async function saveCheck(bookId, chapterId, chapterTitle, findings) {
  if (!chapterId) return null;
  const all = await readAll(bookId);
  all[chapterId] = { ranAt: Date.now(), chapterTitle, findings };
  await storage.putJSON(key(bookId), all);
  return all[chapterId];
}

// Merge a patch into one finding (by index) of a chapter's saved set.
export async function patchFinding(bookId, chapterId, index, patch) {
  const all = await readAll(bookId);
  const entry = all[chapterId];
  if (!entry || !Array.isArray(entry.findings) || !entry.findings[index]) return null;
  entry.findings[index] = { ...entry.findings[index], ...patch };
  await storage.putJSON(key(bookId), all);
  return entry.findings[index];
}
