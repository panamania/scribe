import { storage } from "./storage.js";
import { manuscriptDir } from "./books.js";

// A chapter is one markdown file: "chNN.md" whose first "# " line is the title.
// All functions are scoped to a book id, resolving under <id>/manuscript.

function keyFor(book, id) {
  const safe = String(id).replace(/[^a-z0-9_-]/gi, "");
  return `${manuscriptDir(book)}/${safe}.md`;
}

function trashDir(book) {
  return `${manuscriptDir(book)}/.trash`;
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
  const { files } = await storage.listChildren(manuscriptDir(book));
  const mds = files.filter((f) => f.endsWith(".md"));
  const items = [];
  for (const f of mds) {
    const id = f.replace(/\.md$/, "");
    const raw = (await storage.getText(`${manuscriptDir(book)}/${f}`)) || "";
    const { title, body } = parse(raw);
    items.push({ id, title, order: orderOf(id), words: wordCount(body) });
  }
  items.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  return items;
}

export async function readChapter(book, id) {
  const raw = (await storage.getText(keyFor(book, id))) || "";
  const { title, body } = parse(raw);
  return { id, title, body, words: wordCount(body) };
}

export async function saveChapter(book, id, { title, body }) {
  await storage.putText(keyFor(book, id), serialize(title, body));
  return { id, title, body, words: wordCount(body) };
}

export async function createChapter(book, title) {
  const existing = await listChapters(book);
  const nextNum = existing.reduce((m, c) => Math.max(m, orderOf(c.id)), 0) + 1;
  const id = `ch${String(nextNum).padStart(2, "0")}`;
  const t = title && title.trim() ? title.trim() : `Chapter ${nextNum}`;
  await storage.putText(keyFor(book, id), serialize(t, ""));
  return { id, title: t, order: nextNum, words: 0 };
}

// Soft delete: move the file into .trash/ (recoverable) instead of removing it.
export async function deleteChapter(book, id) {
  const safe = String(id).replace(/[^a-z0-9_-]/gi, "");
  const trashName = `${Date.now()}__${safe}.md`;
  await storage.move(keyFor(book, id), `${trashDir(book)}/${trashName}`);
  return { ok: true, trashId: trashName };
}

export async function listTrash(book) {
  const { files } = await storage.listChildren(trashDir(book));
  const mds = files.filter((f) => f.endsWith(".md"));
  const items = [];
  for (const f of mds) {
    const raw = (await storage.getText(`${trashDir(book)}/${f}`)) || "";
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
  const safeTrash = String(trashId).replace(/[^a-z0-9_.-]/gi, "");
  const src = `${trashDir(book)}/${safeTrash}`;
  const raw = (await storage.getText(src)) || "";
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

  await storage.putText(keyFor(book, targetId), serialize(title, body));
  await storage.del(src);
  return { id: targetId, title, words: wordCount(body) };
}

export async function purgeTrash(book, trashId) {
  if (trashId) {
    const safeTrash = String(trashId).replace(/[^a-z0-9_.-]/gi, "");
    await storage.del(`${trashDir(book)}/${safeTrash}`);
  } else {
    await storage.delPrefix(trashDir(book));
  }
  return { ok: true };
}
