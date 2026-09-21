// One-time (or repeatable) uploader: pushes your local book folders into the
// S3 bucket the cloud app reads. Each book folder becomes keys "<id>/...".
//
// Usage (from the app folder, with AWS creds + region in your environment):
//
//   S3_BUCKET=my-scribe-bucket AWS_REGION=ap-southeast-2 \
//   BOOKS_DIR=../books npm run seed:s3
//
// Flags:
//   --dry     list what would upload without uploading
//   --prune   also DELETE objects in the bucket that no longer exist locally
//
// It skips the local ".trash" folders and dotfiles by default.

import fs from "node:fs/promises";
import path from "node:path";
import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

const BUCKET = process.env.S3_BUCKET;
const REGION = process.env.AWS_REGION || "ap-southeast-2";
const BOOKS_DIR = path.resolve(process.cwd(), process.env.BOOKS_DIR || "../books");
const DRY = process.argv.includes("--dry");
const PRUNE = process.argv.includes("--prune");

if (!BUCKET) {
  console.error("ERROR: set S3_BUCKET (and AWS credentials) in the environment.");
  process.exit(1);
}

const MIME = {
  ".md": "text/markdown; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".txt": "text/plain; charset=utf-8",
};

const s3 = new S3Client({ region: REGION });

async function walk(dir, rel = "") {
  let ents = [];
  try {
    ents = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const e of ents) {
    if (e.name.startsWith(".")) continue; // skip .trash, dotfiles
    const abs = path.join(dir, e.name);
    const key = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...(await walk(abs, key)));
    else out.push({ abs, key });
  }
  return out;
}

async function listBucketKeys() {
  const keys = new Set();
  let token;
  do {
    const r = await s3.send(
      new ListObjectsV2Command({ Bucket: BUCKET, ContinuationToken: token })
    );
    for (const c of r.Contents || []) keys.add(c.Key);
    token = r.IsTruncated ? r.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

async function main() {
  console.log(`Source : ${BOOKS_DIR}`);
  console.log(`Bucket : s3://${BUCKET} (${REGION})`);
  console.log(DRY ? "Mode   : DRY RUN\n" : "Mode   : upload\n");

  const files = await walk(BOOKS_DIR);
  if (!files.length) {
    console.log("Nothing to upload (no book folders found).");
    return;
  }

  const localKeys = new Set();
  for (const { abs, key } of files) {
    localKeys.add(key);
    const ext = path.extname(key).toLowerCase();
    const body = await fs.readFile(abs);
    console.log(`${DRY ? "would put" : "put"}  ${key}  (${body.length} bytes)`);
    if (!DRY) {
      await s3.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: key,
          Body: body,
          ContentType: MIME[ext] || "application/octet-stream",
        })
      );
    }
  }

  if (PRUNE) {
    const remote = await listBucketKeys();
    for (const key of remote) {
      // Never touch app settings written by the running app.
      if (key.startsWith("_scribe/")) continue;
      if (!localKeys.has(key)) {
        console.log(`${DRY ? "would delete" : "delete"}  ${key}`);
        if (!DRY) await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
      }
    }
  }

  console.log(`\nDone. ${files.length} file(s) processed.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
