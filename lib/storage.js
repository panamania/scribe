// Storage abstraction: the whole app talks to `storage` with string "keys"
// (POSIX-style, e.g. "cinderwake/manuscript/ch01.md") instead of touching the
// filesystem directly. Two interchangeable backends:
//
//   • fs  — keys resolve to files under BOOKS_DIR (identical to the original
//           local app; used for `npm run dev`).
//   • s3  — keys become S3 object keys in S3_BUCKET (used in the cloud, where
//           the filesystem is ephemeral).
//
// Pick the backend with the STORAGE env var ("s3" turns on S3); anything else
// stays on the local filesystem. Because every lib module uses these keys, the
// business logic is byte-for-byte the same on both backends.

import fs from "node:fs/promises";
import path from "node:path";
import { BOOKS_DIR, STORAGE_BACKEND, S3_BUCKET, AWS_REGION } from "./config.js";

const isS3 = STORAGE_BACKEND === "s3";

/* --------------------------------------------------------------------------
 * Local filesystem backend
 * ----------------------------------------------------------------------- */
const fsBackend = {
  _abs(key) {
    return path.join(BOOKS_DIR, ...String(key).split("/").filter(Boolean));
  },
  async getText(key) {
    try {
      return await fs.readFile(this._abs(key), "utf-8");
    } catch {
      return null;
    }
  },
  async putText(key, text) {
    const p = this._abs(key);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, text, "utf-8");
  },
  async getBytes(key) {
    try {
      return await fs.readFile(this._abs(key));
    } catch {
      return null;
    }
  },
  async putBytes(key, buf) {
    const p = this._abs(key);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, buf);
  },
  async del(key) {
    try {
      await fs.unlink(this._abs(key));
    } catch {}
  },
  async exists(key) {
    try {
      await fs.access(this._abs(key));
      return true;
    } catch {
      return false;
    }
  },
  async move(src, dst) {
    const d = this._abs(dst);
    await fs.mkdir(path.dirname(d), { recursive: true });
    try {
      await fs.rename(this._abs(src), d);
    } catch {
      // Cross-device fallback (rare): copy then delete.
      const b = await fs.readFile(this._abs(src));
      await fs.writeFile(d, b);
      await fs.unlink(this._abs(src));
    }
  },
  // Immediate children of a "directory" key: { files:[name], dirs:[name] }.
  async listChildren(prefix) {
    const dir = this._abs(prefix);
    let ents = [];
    try {
      ents = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return { files: [], dirs: [] };
    }
    const files = [];
    const dirs = [];
    for (const e of ents) {
      if (e.isDirectory()) dirs.push(e.name);
      else files.push(e.name);
    }
    return { files, dirs };
  },
  // Every file key at or below a prefix (recursive), as full keys.
  async listAll(prefix) {
    const base = String(prefix).replace(/\/+$/, "");
    const out = [];
    const walk = async (rel) => {
      const { files, dirs } = await this.listChildren(rel);
      for (const f of files) out.push(rel ? `${rel}/${f}` : f);
      for (const d of dirs) await walk(rel ? `${rel}/${d}` : d);
    };
    await walk(base);
    return out;
  },
  // Remove a directory subtree (used after a prefix move/delete leaves empty
  // folders behind — otherwise an emptied book folder lingers as a ghost).
  async removeTree(prefix) {
    try {
      await fs.rm(this._abs(prefix), { recursive: true, force: true });
    } catch {}
  },
};

/* --------------------------------------------------------------------------
 * S3 backend (loaded lazily so the fs backend needs no AWS SDK)
 * ----------------------------------------------------------------------- */
let _s3 = null;
let _cmd = null;
async function s3() {
  if (_s3) return;
  const m = await import("@aws-sdk/client-s3");
  _cmd = m;
  _s3 = new m.S3Client({ region: AWS_REGION });
}

async function streamToBuffer(body) {
  // Works for Node streams and web streams returned by the AWS SDK.
  if (body && typeof body.transformToByteArray === "function") {
    return Buffer.from(await body.transformToByteArray());
  }
  const chunks = [];
  for await (const c of body) chunks.push(typeof c === "string" ? Buffer.from(c) : c);
  return Buffer.concat(chunks);
}

function is404(e) {
  return (
    e?.name === "NoSuchKey" ||
    e?.name === "NotFound" ||
    e?.$metadata?.httpStatusCode === 404
  );
}

const s3Backend = {
  async getText(key) {
    const b = await this.getBytes(key);
    return b == null ? null : b.toString("utf-8");
  },
  async putText(key, text) {
    await s3();
    await _s3.send(
      new _cmd.PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        Body: text,
        ContentType: "text/plain; charset=utf-8",
      })
    );
  },
  async getBytes(key) {
    await s3();
    try {
      const r = await _s3.send(
        new _cmd.GetObjectCommand({ Bucket: S3_BUCKET, Key: key })
      );
      return await streamToBuffer(r.Body);
    } catch (e) {
      if (is404(e)) return null;
      throw e;
    }
  },
  async putBytes(key, buf, contentType) {
    await s3();
    await _s3.send(
      new _cmd.PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        Body: buf,
        ContentType: contentType || "application/octet-stream",
      })
    );
  },
  async del(key) {
    await s3();
    await _s3.send(new _cmd.DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
  },
  async exists(key) {
    await s3();
    try {
      await _s3.send(new _cmd.HeadObjectCommand({ Bucket: S3_BUCKET, Key: key }));
      return true;
    } catch (e) {
      if (is404(e)) return false;
      throw e;
    }
  },
  async move(src, dst) {
    await s3();
    // Keys here are URL-safe (alnum, -, _, ., /), so no extra encoding needed.
    await _s3.send(
      new _cmd.CopyObjectCommand({
        Bucket: S3_BUCKET,
        CopySource: `${S3_BUCKET}/${src}`,
        Key: dst,
      })
    );
    await this.del(src);
  },
  async listChildren(prefix) {
    await s3();
    const Prefix = String(prefix).replace(/\/+$/, "") + "/";
    const norm = Prefix === "/" ? "" : Prefix;
    const files = [];
    const dirs = [];
    let token;
    do {
      const r = await _s3.send(
        new _cmd.ListObjectsV2Command({
          Bucket: S3_BUCKET,
          Prefix: norm,
          Delimiter: "/",
          ContinuationToken: token,
        })
      );
      for (const c of r.Contents || []) {
        const name = c.Key.slice(norm.length);
        if (name) files.push(name);
      }
      for (const p of r.CommonPrefixes || []) {
        const name = p.Prefix.slice(norm.length).replace(/\/$/, "");
        if (name) dirs.push(name);
      }
      token = r.IsTruncated ? r.NextContinuationToken : undefined;
    } while (token);
    return { files, dirs };
  },
  async listAll(prefix) {
    await s3();
    const Prefix = String(prefix).replace(/\/+$/, "") + "/";
    const norm = Prefix === "/" ? "" : Prefix;
    const out = [];
    let token;
    do {
      const r = await _s3.send(
        new _cmd.ListObjectsV2Command({
          Bucket: S3_BUCKET,
          Prefix: norm,
          ContinuationToken: token,
        })
      );
      for (const c of r.Contents || []) out.push(c.Key);
      token = r.IsTruncated ? r.NextContinuationToken : undefined;
    } while (token);
    return out;
  },
  // S3 has no real directories, so there is nothing to prune.
  async removeTree() {},
};

/* --------------------------------------------------------------------------
 * Public API — backend + shared helpers
 * ----------------------------------------------------------------------- */
const backend = isS3 ? s3Backend : fsBackend;

export const STORAGE_KIND = isS3 ? "s3" : "fs";

export const storage = {
  getText: (k) => backend.getText(k),
  putText: (k, t) => backend.putText(k, t),
  getBytes: (k) => backend.getBytes(k),
  putBytes: (k, b, ct) => backend.putBytes(k, b, ct),
  del: (k) => backend.del(k),
  exists: (k) => backend.exists(k),
  move: (s, d) => backend.move(s, d),
  listChildren: (p) => backend.listChildren(p),
  listAll: (p) => backend.listAll(p),

  async getJSON(key) {
    const t = await backend.getText(key);
    if (t == null) return null;
    try {
      return JSON.parse(t);
    } catch {
      return null;
    }
  },
  async putJSON(key, obj) {
    await backend.putText(key, JSON.stringify(obj, null, 2));
  },
  // Move every object under a prefix (used for "delete book" -> trash).
  async movePrefix(src, dst) {
    const srcBase = String(src).replace(/\/+$/, "");
    const dstBase = String(dst).replace(/\/+$/, "");
    const keys = await backend.listAll(srcBase);
    for (const key of keys) {
      const rest = key.slice(srcBase.length); // begins with "/"
      await backend.move(key, dstBase + rest);
    }
    await backend.removeTree(srcBase); // clear any emptied folders (fs backend)
  },
  async delPrefix(prefix) {
    const keys = await backend.listAll(prefix);
    for (const key of keys) await backend.del(key);
    await backend.removeTree(prefix); // clear any emptied folders (fs backend)
  },
};
