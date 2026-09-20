"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";

export default function Library() {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [manageId, setManageId] = useState(null);
  const [canonFiles, setCanonFiles] = useState({}); // bookId -> [{name, chars}]
  const [renameVal, setRenameVal] = useState("");
  const [confirmDel, setConfirmDel] = useState(null);

  const coverInput = useRef(null);
  const canonInput = useRef(null);

  const refresh = useCallback(async () => {
    const r = await fetch("/api/books");
    const d = await r.json();
    setBooks(d.books || []);
    setLoading(false);
    return d.books || [];
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  async function createBook() {
    if (!newTitle.trim() || creating) return;
    setCreating(true);
    await fetch("/api/books", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle.trim() }),
    });
    setNewTitle("");
    setCreating(false);
    refresh();
  }

  async function openManage(id, title) {
    if (manageId === id) { setManageId(null); return; }
    setManageId(id);
    setRenameVal(title);
    setConfirmDel(null);
    const r = await fetch(`/api/books/${id}/canon`);
    const d = await r.json();
    setCanonFiles((m) => ({ ...m, [id]: d.files || [] }));
  }

  async function rename(id) {
    await fetch(`/api/books/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: renameVal }),
    });
    refresh();
  }

  async function uploadCover(id, file) {
    if (!file) return;
    const fd = new FormData();
    fd.append("cover", file);
    await fetch(`/api/books/${id}/cover`, { method: "POST", body: fd });
    refresh();
  }
  async function removeCover(id) {
    await fetch(`/api/books/${id}/cover`, { method: "DELETE" });
    refresh();
  }

  async function uploadCanon(id, files) {
    if (!files || !files.length) return;
    const fd = new FormData();
    for (const f of files) fd.append("files", f);
    await fetch(`/api/books/${id}/canon`, { method: "POST", body: fd });
    const r = await fetch(`/api/books/${id}/canon`);
    const d = await r.json();
    setCanonFiles((m) => ({ ...m, [id]: d.files || [] }));
    refresh();
  }
  async function removeCanon(id, name) {
    await fetch(`/api/books/${id}/canon?file=${encodeURIComponent(name)}`, { method: "DELETE" });
    const r = await fetch(`/api/books/${id}/canon`);
    const d = await r.json();
    setCanonFiles((m) => ({ ...m, [id]: d.files || [] }));
    refresh();
  }

  async function deleteBook(id) {
    setConfirmDel(null);
    setManageId(null);
    await fetch(`/api/books/${id}`, { method: "DELETE" });
    refresh();
  }

  return (
    <div className="library">
      <header className="lib-header">
        <div>
          <div className="brand-kicker">The Scribe</div>
          <div className="brand-title" style={{ fontSize: 26 }}>Your Library</div>
        </div>
        <div className="spacer" />
        <Link href="/settings" className="btn ghost" title="Settings">⚙ Settings</Link>
      </header>

      <div className="lib-new">
        <input
          className="lib-new-input"
          value={newTitle}
          placeholder="Start a new book — enter a title…"
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") createBook(); }}
        />
        <button className="btn primary" onClick={createBook} disabled={!newTitle.trim() || creating}>
          {creating ? "Creating…" : "+ New book"}
        </button>
      </div>

      {loading ? (
        <div className="lib-empty">Loading…</div>
      ) : books.length === 0 ? (
        <div className="lib-empty">No books yet. Give one a title above to begin.</div>
      ) : (
        <div className="lib-grid">
          {books.map((b) => (
            <div key={b.id} className="book-card">
              <Link href={`/book/${b.id}`} className="book-cover" title={`Open ${b.title}`}>
                {b.cover ? (
                  <img src={`/api/books/${b.id}/cover?t=${b.updated || 0}`} alt="" />
                ) : (
                  <span className="book-cover-initial">{(b.title || "?").slice(0, 1).toUpperCase()}</span>
                )}
              </Link>
              <div className="book-body">
                <Link href={`/book/${b.id}`} className="book-title">{b.title}</Link>
                <div className="book-meta">
                  {b.chapters} chapter{b.chapters === 1 ? "" : "s"} · {b.words.toLocaleString()} words
                  {b.canonCount ? ` · ${b.canonCount} canon` : ""}
                </div>
                <div className="book-actions">
                  <Link href={`/book/${b.id}`} className="btn primary" style={{ padding: "6px 14px" }}>Open</Link>
                  <button className="btn ghost" style={{ padding: "6px 12px" }} onClick={() => openManage(b.id, b.title)}>
                    {manageId === b.id ? "Close" : "Manage"}
                  </button>
                </div>

                {manageId === b.id && (
                  <div className="book-manage">
                    {/* Rename */}
                    <label className="mng-label">Title</label>
                    <div style={{ display: "flex", gap: 6 }}>
                      <input className="mng-input" value={renameVal} onChange={(e) => setRenameVal(e.target.value)} />
                      <button className="btn" style={{ padding: "4px 10px" }} onClick={() => rename(b.id)}>Save</button>
                    </div>

                    {/* Cover */}
                    <label className="mng-label">Cover image (optional)</label>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button className="btn ghost" style={{ padding: "4px 10px" }}
                        onClick={() => coverInput.current?.click()}>Upload cover</button>
                      {b.cover && (
                        <button className="btn ghost" style={{ padding: "4px 10px", color: "var(--danger)" }}
                          onClick={() => removeCover(b.id)}>Remove</button>
                      )}
                      <input ref={coverInput} type="file" accept="image/*" hidden
                        onChange={(e) => { uploadCover(b.id, e.target.files?.[0]); e.target.value = ""; }} />
                    </div>

                    {/* Canon */}
                    <label className="mng-label">Canon files (optional, .md)</label>
                    <div className="mng-canon">
                      {(canonFiles[b.id] || []).length === 0 && (
                        <div className="mng-hint">No canon yet — Opus writes from the draft alone.</div>
                      )}
                      {(canonFiles[b.id] || []).map((f) => (
                        <div key={f.name} className="mng-canon-row">
                          <span>{f.name}</span>
                          <button className="mng-x" onClick={() => removeCanon(b.id, f.name)} title="Remove">✕</button>
                        </div>
                      ))}
                    </div>
                    <button className="btn ghost" style={{ padding: "4px 10px" }}
                      onClick={() => canonInput.current?.click()}>+ Upload canon (.md)</button>
                    <input ref={canonInput} type="file" accept=".md,text/markdown" multiple hidden
                      onChange={(e) => { uploadCanon(b.id, Array.from(e.target.files || [])); e.target.value = ""; }} />

                    {/* Delete */}
                    <div style={{ marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                      {confirmDel === b.id ? (
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <span style={{ fontSize: 11, color: "var(--danger)" }}>Delete this whole book?</span>
                          <button className="btn danger" style={{ padding: "4px 10px" }} onClick={() => deleteBook(b.id)}>Delete</button>
                          <button className="btn ghost" style={{ padding: "4px 10px" }} onClick={() => setConfirmDel(null)}>Cancel</button>
                        </div>
                      ) : (
                        <button className="btn ghost" style={{ padding: "4px 10px", color: "var(--danger)" }}
                          onClick={() => setConfirmDel(b.id)}>Delete book</button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
