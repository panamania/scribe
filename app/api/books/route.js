import { NextResponse } from "next/server";
import { listBooks, createBook } from "../../../lib/books.js";

export const dynamic = "force-dynamic";

export async function GET() {
  const books = await listBooks();
  return NextResponse.json({ books });
}

export async function POST(req) {
  const { title } = await req.json().catch(() => ({}));
  const book = await createBook(title);
  return NextResponse.json({ book });
}
