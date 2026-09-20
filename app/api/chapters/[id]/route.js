import { NextResponse } from "next/server";
import { readChapter, saveChapter, deleteChapter } from "../../../../lib/store.js";
import { updateBook } from "../../../../lib/books.js";

export const dynamic = "force-dynamic";

export async function GET(req, { params }) {
  const { id } = await params;
  const book = new URL(req.url).searchParams.get("book");
  if (!book) return NextResponse.json({ error: "book required" }, { status: 400 });
  try {
    const chapter = await readChapter(book, id);
    return NextResponse.json({ chapter });
  } catch {
    return NextResponse.json({ error: "Chapter not found" }, { status: 404 });
  }
}

export async function PUT(req, { params }) {
  const { id } = await params;
  const { book, title, body } = await req.json();
  if (!book) return NextResponse.json({ error: "book required" }, { status: 400 });
  const chapter = await saveChapter(book, id, { title, body });
  updateBook(book, {}).catch(() => {});
  return NextResponse.json({ chapter });
}

export async function DELETE(req, { params }) {
  const { id } = await params;
  const book = new URL(req.url).searchParams.get("book");
  if (!book) return NextResponse.json({ error: "book required" }, { status: 400 });
  await deleteChapter(book, id);
  return NextResponse.json({ ok: true });
}
