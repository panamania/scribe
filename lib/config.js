import path from "node:path";

// Each book is a self-contained "folder" of keys under the storage root:
//   <id>/manuscript/chNN.md   (chapters)
//   <id>/canon/*.md           (canon bible, optional)
//   <id>/cover.<ext>          (cover image, optional)
//   <id>/book.json            (metadata)
//   <id>/canonchecks.json     (saved canon-check findings)
export const MODEL = process.env.SCRIBE_MODEL || "claude-opus-4-8";

// Storage backend: "s3" uses S3_BUCKET; anything else uses the local filesystem
// rooted at BOOKS_DIR. See lib/storage.js.
export const STORAGE_BACKEND = (process.env.STORAGE || "fs").toLowerCase();
export const S3_BUCKET = process.env.S3_BUCKET || "";
export const AWS_REGION = process.env.AWS_REGION || "us-east-1";

// Local filesystem root (only used by the fs backend).
export const BOOKS_DIR = path.resolve(
  process.cwd(),
  process.env.BOOKS_DIR || "../books"
);
