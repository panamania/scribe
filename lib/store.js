import fs from "node:fs/promises";
import path from "node:path";
import { manuscriptDir } from "./books.js";

// A chapter is one markdown file: "chNN.md" whose first "# " line is the title.
// All functions are scoped to a book id, resolving under books/<id>/manuscript.

async function ensureDir(book) {
  await fs.mkdir(manuscriptDir(book), { recursive: true });
}

function fileFor(book, id) {
  const safe = String(id).replace(/[^a-z0-9_-]/gi, "");
  return path.join(manuscriptDir(book), `${safe}.md`);
}

function trashDir(book) {
  return path.join(manuscriptDir(book), ".trash");
}

function orderOf(id) {
  const m = String(id).match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 9999;
}

function parse(markdown) {
  const text = markdown.replace(/\r\n/g, "\n");
  const lines = text.split("\n");
  let title = "Untitled";
  let bodyStart = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === "") continue;
    const m = lines[i].match(/^#\s+(.*)$/);
    if (m) {
      title = m[1].trim();
      bodyStart = i + 1;
    }
    break;
  }
  const body = lines.slice(bodyStart).join("\n").replace(/^\n+/, "");
  return { title, body };
}

function serialize(title, body) {
  const t = (title || "Untitled").trim();
  const b = (body || "").replace(/\r\n/g, "\n").replace(/^\n+/, "");
  return `# ${t}\n\n${b}\n`;
}

function wordCount(body) {
  const t = (body || "").trim();
  return t ? t.split(/\s+/).length : 0;
}

export async function listChapters(book) {
  await ensureDir(book);
  const files = (await fs.readdir(manuscriptDir(book))).filter((f) => f.endsWith(".md"));
  const items = [];
  for (const f of files) {
    const id = f.replace(/\.md$/, "");
    const raw = await fs.readFile(path.join(manuscriptDir(book), f), "utf-8");
    const { title, body } = parse(raw);
    items.push({ id, title, order: orderOf(id), words: wordCount(body) });
  }
  items.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  return items;
}

export async function readChapter(book, id) {
  const raw = await fs.readFile(fileFor(book, id), "utf-8");
  const { title, body } = parse(raw);
  return { id, title, body, words: wordCount(body) };
}

export async function saveChapter(book, id, { title, body }) {
  await ensureDir(book);
  await fs.writeFile(fileFor(book, id), serialize(title, body), "utf-8");
  return { id, title, body, words: wordCount(body) };
}

export async function createChapter(book, title) {
  await ensureDir(book);
  const existing = await listChapters(book);
  const nextNum = existing.reduce((m, c) => Math.max(m, orderOf(c.id)), 0) + 1;
  const id = `ch${String(nextNum).padStart(2, "0")}`;
  const t = title && title.trim() ? title.trim() : `Chapter ${nextNum}`;
  await fs.writeFile(fileFor(book, id), serialize(t, ""), "utf-8");
  return { id, title: t, order: nextNum, words: 0 };
}

// Soft delete: move the file into .trash/ (recoverable) instead of removing it.
export async function deleteChapter(book, id) {
  await ensureDir(book);
  const td = trashDir(book);
  await fs.mkdir(td, { recursive: true });
  const safe = String(id).replace(/[^a-z0-9_-]/gi, "");
  const trashName = `${Date.now()}__${safe}.md`;
  await fs.rename(fileFor(book, id), path.join(td, trashName));
  return { ok: true, trashId: trashName };
}

export async function listTrash(book) {
  const td = trashDir(book);
  let files = [];
  try {
    files = (await fs.readdir(td)).filter((f) => f.endsWith(".md"));
  } catch {
    return [];
  }
  const items = [];
  for (const f of files) {
    const raw = await fs.readFile(path.join(td, f), "utf-8");
    const { title, body } = parse(raw);
    const base = f.replace(/\.md$/, "");
    const [tsStr, ...rest] = base.split("__");
    const ts = parseInt(tsStr, 10);
    items.push({
      trashId: f,
      origId: rest.join("__") || null,
      title,
      words: wordCount(body),
      deletedAt: Number.isNaN(ts) ? null : ts,
    });
  }
  items.sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0));
  return items;
}

export async function restoreChapter(book, trashId) {
  const td = trashDir(book);
  const safeTrash = String(trashId).replace(/[^a-z0-9_.-]/gi, "");
  const src = path.join(td, safeTrash);
  const raw = await fs.readFile(src, "utf-8");
  const { title, body } = parse(raw);

  const base = safeTrash.replace(/\.md$/, "");
  const [, ...rest] = base.split("__");
  let targetId = rest.join("__") || null;

  const existing = await listChapters(book);
  const taken = new Set(existing.map((c) => c.id));
  if (!targetId || taken.has(targetId)) {
    const nextNum = existing.reduce((m, c) => Math.max(m, orderOf(c.id)), 0) + 1;
    targetId = `ch${String(nextNum).padStart(2, "0")}`;
  }

  await fs.writeFile(fileFor(book, targetId), serialize(title, body), "utf-8");
  await fs.unlink(src);
  return { id: targetId, title, words: wordCount(body) };
}

export async function purgeTrash(book, trashId) {
  const td = trashDir(book);
  if (trashId) {
    const safeTrash = String(trashId).replace(/[^a-z0-9_.-]/gi, "");
    await fs.unlink(path.join(td, safeTrash));
  } else {
    try {
      const files = await fs.readdir(td);
      for (const f of files) await fs.unlink(path.join(td, f));
    } catch {}
  }
  return { ok: true };
}
