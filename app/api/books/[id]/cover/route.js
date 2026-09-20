import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { bookDir, readMeta, updateBook } from "../../../../../lib/books.js";

export const dynamic = "force-dynamic";

const MIME = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export async function GET(_req, { params }) {
  const { id } = await params;
  const meta = await readMeta(id);
  if (!meta.cover) return new Response("no cover", { status: 404 });
  try {
    const file = path.join(bookDir(id), meta.cover);
    const buf = await fs.readFile(file);
    const ext = path.extname(meta.cover).toLowerCase();
    return new Response(buf, {
      headers: {
        "Content-Type": MIME[ext] || "application/octet-stream",
        "Cache-Control": "no-cache",
      },
    });
  } catch {
    return new Response("no cover", { status: 404 });
  }
}

export async function POST(req, { params }) {
  const { id } = await params;
  const form = await req.formData();
  const file = form.get("cover");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "cover file required" }, { status: 400 });
  }
  let ext = path.extname(file.name).toLowerCase();
  if (!MIME[ext]) ext = ".png";
  // Remove any previous cover with a different extension.
  const prev = (await readMeta(id)).cover;
  if (prev && prev !== `cover${ext}`) {
    try { await fs.unlink(path.join(bookDir(id), prev)); } catch {}
  }
  const name = `cover${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(bookDir(id), name), buf);
  const book = await updateBook(id, { cover: name });
  return NextResponse.json({ book });
}

export async function DELETE(_req, { params }) {
  const { id } = await params;
  const meta = await readMeta(id);
  if (meta.cover) {
    try { await fs.unlink(path.join(bookDir(id), meta.cover)); } catch {}
  }
  const book = await updateBook(id, { cover: null });
  return NextResponse.json({ book });
}
