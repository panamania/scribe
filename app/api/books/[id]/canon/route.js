import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { canonDir } from "../../../../../lib/books.js";

export const dynamic = "force-dynamic";

function safeName(name) {
  const base = path.basename(String(name)).replace(/[^a-z0-9._ -]/gi, "").trim();
  return base.endsWith(".md") ? base : `${base || "canon"}.md`;
}

export async function GET(_req, { params }) {
  const { id } = await params;
  const dir = canonDir(id);
  let files = [];
  try {
    const names = (await fs.readdir(dir)).filter((f) => f.endsWith(".md"));
    for (const n of names) {
      const st = await fs.stat(path.join(dir, n));
      files.push({ name: n, chars: st.size });
    }
  } catch {}
  files.sort((a, b) => a.name.localeCompare(b.name));
  return NextResponse.json({ files });
}

// Upload one or more .md files (multipart form field "files").
export async function POST(req, { params }) {
  const { id } = await params;
  const dir = canonDir(id);
  await fs.mkdir(dir, { recursive: true });
  const form = await req.formData();
  const uploads = form.getAll("files");
  const saved = [];
  for (const f of uploads) {
    if (typeof f === "string") continue;
    const name = safeName(f.name);
    const text = await f.text();
    await fs.writeFile(path.join(dir, name), text, "utf-8");
    saved.push(name);
  }
  return NextResponse.json({ saved });
}

export async function DELETE(req, { params }) {
  const { id } = await params;
  const file = new URL(req.url).searchParams.get("file");
  if (!file) return NextResponse.json({ error: "file required" }, { status: 400 });
  try {
    await fs.unlink(path.join(canonDir(id), safeName(file)));
  } catch {}
  return NextResponse.json({ ok: true });
}
