import fs from "node:fs/promises";
import path from "node:path";
import { BOOKS_DIR } from "./config.js";

export function safeId(id) {
  return String(id).replace(/[^a-z0-9_-]/gi, "");
}
export function bookDir(id) {
  return path.join(BOOKS_DIR, safeId(id));
}
export function manuscriptDir(id) {
  return path.join(bookDir(id), "manuscript");
}
export function canonDir(id) {
  return path.join(bookDir(id), "canon");
}
function metaPath(id) {
  return path.join(bookDir(id), "book.json");
}

async function ensureBooks() {
  await fs.mkdir(BOOKS_DIR, { recursive: true });
}

function slugify(title) {
  const base = String(title || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || "book";
}

function wordCount(body) {
  const t = (body || "").replace(/^#.*$/m, "").trim();
  return t ? t.split(/\s+/).length : 0;
}

export async function readMeta(id) {
  try {
    return JSON.parse(await fs.readFile(metaPath(id), "utf-8"));
  } catch {
    return { id, title: id, cover: null };
  }
}

async function writeMeta(id, meta) {
  await fs.writeFile(metaPath(id), JSON.stringify(meta, null, 2), "utf-8");
}

async function stats(id) {
  let chapters = 0, words = 0, canonCount = 0;
  try {
    const files = (await fs.readdir(manuscriptDir(id))).filter((f) => f.endsWith(".md"));
    chapters = files.length;
    for (const f of files) {
      const raw = await fs.readFile(path.join(manuscriptDir(id), f), "utf-8");
      words += wordCount(raw);
    }
  } catch {}
  try {
    canonCount = (await fs.readdir(canonDir(id))).filter((f) => f.endsWith(".md")).length;
  } catch {}
  return { chapters, words, canonCount };
}

export async function listBooks() {
  await ensureBooks();
  let entries = [];
  try {
    entries = await fs.readdir(BOOKS_DIR, { withFileTypes: true });
  } catch {
    return [];
  }
  const books = [];
  for (const e of entries) {
    if (!e.isDirectory() || e.name.startsWith(".")) continue;
    const id = e.name;
    const meta = await readMeta(id);
    const s = await stats(id);
    books.push({
      id,
      title: meta.title || id,
      cover: meta.cover || null,
      created: meta.created || null,
      updated: meta.updated || null,
      ...s,
    });
  }
  books.sort((a, b) => (b.updated || 0) - (a.updated || 0) || a.title.localeCompare(b.title));
  return books;
}

export async function getBook(id) {
  const meta = await readMeta(id);
  const s = await stats(id);
  return { ...meta, id, ...s };
}

export async function createBook(title) {
  await ensureBooks();
  const slug = slugify(title);
  const existing = new Set(await fs.readdir(BOOKS_DIR).catch(() => []));
  let id = slug, n = 2;
  while (existing.has(id)) id = `${slug}-${n++}`;
  await fs.mkdir(manuscriptDir(id), { recursive: true });
  await fs.mkdir(canonDir(id), { recursive: true });
  const meta = {
    id,
    title: (title && title.trim()) || "Untitled Book",
    cover: null,
    created: Date.now(),
    updated: Date.now(),
  };
  await writeMeta(id, meta);
  return meta;
}

export async function updateBook(id, patch) {
  const meta = await readMeta(id);
  const next = { ...meta, ...patch, id, updated: Date.now() };
  await writeMeta(id, next);
  return next;
}

export async function deleteBook(id) {
  await ensureBooks();
  const trash = path.join(BOOKS_DIR, ".trash");
  await fs.mkdir(trash, { recursive: true });
  await fs.rename(bookDir(id), path.join(trash, `${Date.now()}__${safeId(id)}`));
  return { ok: true };
}
