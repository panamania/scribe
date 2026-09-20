import path from "node:path";

// Each book is a self-contained folder under BOOKS_DIR:
//   books/<id>/manuscript/chNN.md   (chapters)
//   books/<id>/canon/*.md           (canon bible, optional)
//   books/<id>/cover.<ext>          (cover image, optional)
//   books/<id>/book.json            (metadata)
export const MODEL = process.env.SCRIBE_MODEL || "claude-opus-4-8";

export const BOOKS_DIR = path.resolve(
  process.cwd(),
  process.env.BOOKS_DIR || "../books"
);
