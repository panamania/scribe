import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  TextRun,
  AlignmentType,
} from "docx";
import { listChapters, readChapter } from "../../../lib/store.js";
import { getBook } from "../../../lib/books.js";

export const dynamic = "force-dynamic";

function chapterNumber(id) {
  const m = String(id).match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

function safeFile(name) {
  return String(name).replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "") || "book";
}

function bodyToParagraphs(body) {
  const blocks = body
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((b) => b.replace(/\n/g, " ").trim())
    .filter(Boolean);
  return blocks.map(
    (text) =>
      new Paragraph({
        children: [new TextRun({ text, font: "Georgia", size: 24 })],
        spacing: { after: 200, line: 360 },
      })
  );
}

function chapterHeading(title, first) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.CENTER,
    pageBreakBefore: !first,
    spacing: { before: 240, after: 320 },
    children: [new TextRun({ text: title, font: "Georgia", bold: true, size: 32 })],
  });
}

export async function POST(req) {
  const { book, scope = "book", chapterId } = await req.json().catch(() => ({}));
  if (!book) return new Response("book required", { status: 400 });

  const meta = await getBook(book);
  let chaptersToExport = [];
  let filename;

  if (scope === "chapter" && chapterId) {
    const ch = await readChapter(book, chapterId);
    chaptersToExport = [ch];
    const num = chapterNumber(chapterId);
    filename = num != null ? `Chapter${num}` : chapterId;
  } else {
    const list = await listChapters(book);
    for (const c of list) chaptersToExport.push(await readChapter(book, c.id));
    filename = safeFile(meta.title);
  }

  const children = [];
  chaptersToExport.forEach((ch, i) => {
    children.push(chapterHeading(ch.title, i === 0));
    children.push(...bodyToParagraphs(ch.body));
  });

  const doc = new Document({
    creator: "Scribe",
    title: scope === "chapter" ? chaptersToExport[0]?.title : meta.title,
    styles: { default: { document: { run: { font: "Georgia", size: 24 } } } },
    sections: [
      {
        properties: {
          page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } },
        },
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}.docx"`,
    },
  });
}
