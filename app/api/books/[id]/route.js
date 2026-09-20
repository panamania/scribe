import { NextResponse } from "next/server";
import { getBook, updateBook, deleteBook } from "../../../../lib/books.js";

export const dynamic = "force-dynamic";

export async function GET(_req, { params }) {
  const { id } = await params;
  const book = await getBook(id);
  return NextResponse.json({ book });
}

export async function PATCH(req, { params }) {
  const { id } = await params;
  const patch = await req.json().catch(() => ({}));
  // Only allow known fields.
  const allowed = {};
  if (typeof patch.title === "string") allowed.title = patch.title;
  const book = await updateBook(id, allowed);
  return NextResponse.json({ book });
}

export async function DELETE(_req, { params }) {
  const { id } = await params;
  await deleteBook(id);
  return NextResponse.json({ ok: true });
}
