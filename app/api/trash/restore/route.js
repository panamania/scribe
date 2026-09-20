import { NextResponse } from "next/server";
import { restoreChapter } from "../../../../lib/store.js";

export const dynamic = "force-dynamic";

export async function POST(req) {
  const { book, trashId } = await req.json().catch(() => ({}));
  if (!book || !trashId) {
    return NextResponse.json({ error: "book and trashId required" }, { status: 400 });
  }
  const chapter = await restoreChapter(book, trashId);
  return NextResponse.json({ chapter });
}
