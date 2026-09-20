import { NextResponse } from "next/server";
import { listTrash, purgeTrash } from "../../../lib/store.js";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const book = new URL(req.url).searchParams.get("book");
  if (!book) return NextResponse.json({ error: "book required" }, { status: 400 });
  const trash = await listTrash(book);
  return NextResponse.json({ trash });
}

// Permanently remove one trashed chapter (?id=...) or empty the whole trash.
export async function DELETE(req) {
  const { searchParams } = new URL(req.url);
  const book = searchParams.get("book");
  const id = searchParams.get("id");
  if (!book) return NextResponse.json({ error: "book required" }, { status: 400 });
  await purgeTrash(book, id || undefined);
  return NextResponse.json({ ok: true });
}
