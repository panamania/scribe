import { NextResponse } from "next/server";
import { loadCanon } from "../../../lib/canon.js";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const book = new URL(req.url).searchParams.get("book");
  if (!book) return NextResponse.json({ error: "book required" }, { status: 400 });
  const canon = await loadCanon(book);
  return NextResponse.json({
    files: canon.files,
    missing: canon.missing,
    dir: canon.dir,
    totalChars: canon.text.length,
  });
}
