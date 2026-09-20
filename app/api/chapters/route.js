import { NextResponse } from "next/server";
import { listChapters, createChapter } from "../../../lib/store.js";
import { updateBook } from "../../../lib/books.js";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const book = new URL(req.url).searchParams.get("book");
  if (!book) return NextResponse.json({ error: "book required" }, { status: 400 });
  const chapters = await listChapters(book);
  return NextResponse.json({ chapters });
}

export async function POST(req) {
  const { book, title } = await req.json().catch(() => ({}));
  if (!book) return NextResponse.json({ error: "book required" }, { status: 400 });
  const chapter = await createChapter(book, title);
  updateBook(book, {}).catch(() => {});
  return NextResponse.json({ chapter });
}
