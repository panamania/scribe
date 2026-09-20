import { storage } from "./storage.js";

// Book/key helpers. These return POSIX-style storage keys (not filesystem
// paths) so the same code works on the fs and s3 backends.

export function safeId(id) {
  return String(id).replace(/[^a-z0-9_-]/gi, "");
}
export function bookDir(id) {
  return safeId(id);
}
export function manuscriptDir(id) {
  return `${bookDir(id)}/manuscript`;
}
export function canonDir(id) {
  return `${bookDir(id)}/canon`;
}
function metaKey(id) {
  return `${bookDir(id)}/book.json`;
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
  const m = await storage.getJSON(metaKey(id));
  return m || { id, title: id, cover: null };
}

async function writeMeta(id, meta) {
  await storage.putJSON(metaKey(id), meta);
}

async function stats(id) {
  let chapters = 0,
    words = 0,
    canonCount = 0;
  const { files: mFiles } = await storage.listChildren(manuscriptDir(id));
  const mds = mFiles.filter((f) => f.endsWith(".md"));
  chapters = mds.length;
  for (const f of mds) {
    const raw = (await storage.getText(`${manuscriptDir(id)}/${f}`)) || "";
    words += wordCount(raw);
  }
  const { files: cFiles } = await storage.listChildren(canonDir(id));
  canonCount = cFiles.filter((f) => f.endsWith(".md")).length;
  return { chapters, words, canonCount };
}

export async function listBooks() {
  const { dirs } = await storage.listChildren("");
  const books = [];
  for (const id of dirs) {
    if (id.startsWith(".")) continue;
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
  books.sort(
    (a, b) => (b.updated || 0) - (a.updated || 0) || a.title.localeCompare(b.title)
  );
  return books;
}

export async function getBook(id) {
  const meta = await readMeta(id);
  const s = await stats(id);
  return { ...meta, id, ...s };
}

export async function createBook(title) {
  const slug = slugify(title);
  const { dirs } = await storage.listChildren("");
  const existing = new Set(dirs);
  let id = slug,
    n = 2;
  while (existing.has(id)) id = `${slug}-${n++}`;
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
  // Soft delete: move the whole book prefix into .trash/ (recoverable).
  await storage.movePrefix(bookDir(id), `.trash/${Date.now()}__${safeId(id)}`);
  return { ok: true };
}
