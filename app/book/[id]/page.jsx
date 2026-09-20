"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

const ACTIONS = [
  { id: "continue", label: "Continue", scope: "whole", desc: "Write the next passage from where the draft ends." },
  { id: "tighten", label: "Tighten", scope: "sel", desc: "Rewrite tighter, same voice and beats." },
  { id: "critique", label: "Critique", scope: "sel", desc: "Editorial feedback — no rewrite." },
  { id: "canon", label: "Canon check", scope: "sel", desc: "Lists fixable tasks with a Go-to link, and writes them to CanonLog.md." },
  { id: "brainstorm", label: "Brainstorm", scope: "whole", desc: "Options for what happens next." },
];
const TONES = ["Gritty", "Tense", "Lyrical", "Cynical", "Ceremonial", "Melancholic"];

function timeAgo(ts) {
  if (!ts) return "";
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function StudioPage() {
  const book = useParams().id;

  const [bookMeta, setBookMeta] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [canon, setCanon] = useState(null);

  const [action, setAction] = useState("continue");
  const [tone, setTone] = useState("");
  const [chars, setChars] = useState([]);
  const [prompt, setPrompt] = useState("");
  const [output, setOutput] = useState("");
  const [running, setRunning] = useState(false);
  const [hasSel, setHasSel] = useState(false);
  const [check, setCheck] = useState(null); // { ranAt, findings } | null
  const [freshRun, setFreshRun] = useState(false);
  const [locateMsg, setLocateMsg] = useState("");
  const [replyIdx, setReplyIdx] = useState(null);
  const [replyText, setReplyText] = useState("");

  const [outMode, setOutMode] = useState("panel");
  const [panelW, setPanelW] = useState(440);
  const [dragging, setDragging] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [cowriterOpen, setCowriterOpen] = useState(true);
  const [confirmDel, setConfirmDel] = useState(null);
  const [trash, setTrash] = useState([]);
  const [trashOpen, setTrashOpen] = useState(false);
  const [confirmPurge, setConfirmPurge] = useState(null);

  const proseRef = useRef(null);
  const selRef = useRef({ start: 0, end: 0 });
  const loadedRef = useRef({ id: null, title: "", body: "" });
  const saveTimer = useRef(null);
  const outRef = useRef(null);

  const refreshChapters = useCallback(async () => {
    const r = await fetch(`/api/chapters?book=${book}`);
    const d = await r.json();
    setChapters(d.chapters || []);
    return d.chapters || [];
  }, [book]);

  const refreshTrash = useCallback(async () => {
    const r = await fetch(`/api/trash?book=${book}`);
    const d = await r.json();
    setTrash(d.trash || []);
    return d.trash || [];
  }, [book]);

  const openChapter = useCallback(async (id) => {
    const r = await fetch(`/api/chapters/${id}?book=${book}`);
    if (!r.ok) return;
    const { chapter } = await r.json();
    loadedRef.current = { id, title: chapter.title, body: chapter.body };
    setActiveId(id);
    setTitle(chapter.title);
    setBody(chapter.body);
    setDirty(false);
    setSavedAt(null);
    setOutput("");
    setLocateMsg("");
    setReplyIdx(null);
    setReplyText("");
    setFreshRun(false);
    setCheck(null);
    try {
      const cr = await fetch(`/api/books/${book}/canoncheck?chapterId=${id}`).then((r) => r.json());
      if (cr.findings) setCheck({ ranAt: cr.ranAt, findings: cr.findings });
    } catch {}
  }, [book]);

  useEffect(() => {
    (async () => {
      const [cr, bm] = await Promise.all([
        fetch(`/api/canon?book=${book}`).then((r) => r.json()),
        fetch(`/api/books/${book}`).then((r) => r.json()),
        refreshChapters(),
        refreshTrash(),
      ]);
      setCanon(cr);
      setBookMeta(bm.book || null);
    })();
  }, [book, refreshChapters, refreshTrash]);

  useEffect(() => {
    if (!activeId && chapters.length) openChapter(chapters[0].id);
  }, [chapters, activeId, openChapter]);

  const save = useCallback(async () => {
    if (!activeId) return;
    await fetch(`/api/chapters/${activeId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ book, title, body }),
    });
    loadedRef.current = { id: activeId, title, body };
    setDirty(false);
    setSavedAt(new Date());
    refreshChapters();
  }, [book, activeId, title, body, refreshChapters]);

  useEffect(() => {
    if (!activeId) return;
    const l = loadedRef.current;
    if (l.id === activeId && l.title === title && l.body === body) {
      setDirty(false);
      return;
    }
    setDirty(true);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(save, 1200);
    return () => clearTimeout(saveTimer.current);
  }, [title, body, activeId, save]);

  useEffect(() => {
    if (outRef.current) outRef.current.scrollTop = outRef.current.scrollHeight;
  }, [output, outMode]);

  useEffect(() => {
    try {
      const w = parseInt(localStorage.getItem("scribe_panelw"), 10);
      if (w) setPanelW(w);
      const m = localStorage.getItem("scribe_outmode");
      if (m) setOutMode(m);
      const sb = localStorage.getItem("scribe_sidebar");
      if (sb !== null) setSidebarOpen(sb === "1");
      const cw = localStorage.getItem("scribe_cowriter");
      if (cw !== null) setCowriterOpen(cw === "1");
    } catch {}
  }, []);
  useEffect(() => {
    document.title = bookMeta?.title ? `${bookMeta.title} · The Scribe` : "The Scribe";
    return () => { document.title = "The Scribe"; };
  }, [bookMeta]);
  useEffect(() => { try { localStorage.setItem("scribe_sidebar", sidebarOpen ? "1" : "0"); } catch {} }, [sidebarOpen]);
  useEffect(() => { try { localStorage.setItem("scribe_cowriter", cowriterOpen ? "1" : "0"); } catch {} }, [cowriterOpen]);
  useEffect(() => { try { localStorage.setItem("scribe_panelw", String(panelW)); } catch {} }, [panelW]);
  useEffect(() => { try { localStorage.setItem("scribe_outmode", outMode); } catch {} }, [outMode]);

  function startResize(e) {
    e.preventDefault();
    setDragging(true);
    const startX = e.clientX;
    const startW = panelW;
    function move(ev) {
      const w = Math.min(760, Math.max(320, startW + (startX - ev.clientX)));
      setPanelW(w);
    }
    function up() {
      setDragging(false);
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
    }
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  }

  async function switchTo(id) {
    if (id === activeId) return;
    if (dirty) { clearTimeout(saveTimer.current); await save(); }
    openChapter(id);
  }
  async function newChapter() {
    if (dirty) { clearTimeout(saveTimer.current); await save(); }
    const r = await fetch("/api/chapters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ book }),
    });
    const { chapter } = await r.json();
    await refreshChapters();
    openChapter(chapter.id);
  }
  async function doDelete(id) {
    setConfirmDel(null);
    await fetch(`/api/chapters/${id}?book=${book}`, { method: "DELETE" });
    const list = await refreshChapters();
    await refreshTrash();
    if (id === activeId) {
      if (list.length) openChapter(list[0].id);
      else {
        setActiveId(null); setTitle(""); setBody("");
        loadedRef.current = { id: null, title: "", body: "" };
      }
    }
  }
  async function restore(trashId) {
    const r = await fetch("/api/trash/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ book, trashId }),
    });
    const { chapter } = await r.json();
    await refreshChapters();
    await refreshTrash();
    if (chapter?.id) openChapter(chapter.id);
  }
  async function purge(trashId) {
    setConfirmPurge(null);
    await fetch(`/api/trash?book=${book}&id=${encodeURIComponent(trashId)}`, { method: "DELETE" });
    await refreshTrash();
  }

  function trackSel() {
    const el = proseRef.current;
    if (!el) return;
    selRef.current = { start: el.selectionStart, end: el.selectionEnd };
    setHasSel(el.selectionEnd > el.selectionStart);
  }

  async function runCanonCheck() {
    setRunning(true);
    setOutput("");
    setLocateMsg("");
    setReplyIdx(null);
    setReplyText("");
    const { start, end } = selRef.current;
    const selection = hasSel ? body.slice(start, end) : "";
    try {
      const res = await fetch(`/api/books/${book}/canoncheck`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapterId: activeId, chapterTitle: title, body, selection }),
      });
      if (!res.ok) { setOutput(await res.text()); setRunning(false); return; }
      const d = await res.json();
      setCheck({ ranAt: d.ranAt || Date.now(), findings: d.findings || [] });
      setFreshRun(true);
    } catch (e) {
      setOutput(`[error] ${e.message}`);
    }
    setRunning(false);
  }

  async function resolveFinding(index, act, ruling) {
    const f = check?.findings?.[index];
    if (!f) return;
    try {
      const res = await fetch(`/api/books/${book}/finding`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapterId: activeId, index, action: act, ruling: ruling || "", quote: f.quote || "" }),
      });
      const d = await res.json();
      setCheck((c) => (c ? { ...c, findings: c.findings.map((ff, i) => (i === index ? (d.finding || ff) : ff)) } : c));
    } catch {}
    setReplyIdx(null);
    setReplyText("");
  }

  function goToQuote(quote) {
    if (outMode === "full") setOutMode("panel"); // reveal the editor behind the overlay
    const el = proseRef.current;
    if (!el || !quote) return;
    const needle = quote.trim();
    let idx = body.indexOf(needle);
    if (idx < 0) idx = body.toLowerCase().indexOf(needle.toLowerCase());
    if (idx < 0) {
      const frag = needle.slice(0, 40);
      idx = body.toLowerCase().indexOf(frag.toLowerCase());
    }
    if (idx < 0) { setLocateMsg("Couldn't find that snippet — the text may have changed."); return; }
    setLocateMsg("");
    const end = idx + needle.length;
    el.focus();
    el.setSelectionRange(idx, end);
    selRef.current = { start: idx, end };
    setHasSel(end > idx);
    // Scroll the textarea so the match is roughly centered.
    const prev = el.value;
    el.value = prev.substring(0, idx);
    const pos = el.scrollHeight;
    el.value = prev;
    el.scrollTop = Math.max(0, pos - el.clientHeight / 2);
    el.setSelectionRange(idx, end);
  }

  async function run() {
    if (running || !activeId) return;
    if (action === "canon") return runCanonCheck();
    const def = ACTIONS.find((a) => a.id === action);
    const { start, end } = selRef.current;
    const selection = hasSel ? body.slice(start, end) : "";
    setRunning(true);
    setOutput("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          book, action, chapterTitle: title, body,
          selection: def?.scope === "sel" ? selection : "",
          prompt, tone, characters: chars,
        }),
      });
      if (!res.ok) { setOutput(await res.text()); setRunning(false); return; }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setOutput(acc);
      }
    } catch (e) {
      setOutput(`[error] ${e.message}`);
    }
    setRunning(false);
  }

  function insertAtCursor() {
    const el = proseRef.current;
    const { start, end } = selRef.current;
    const s = Math.min(start, body.length), e = Math.min(end, body.length);
    const next = body.slice(0, s) + output + body.slice(e);
    setBody(next);
    requestAnimationFrame(() => {
      el?.focus();
      const caret = s + output.length;
      el?.setSelectionRange(caret, caret);
      selRef.current = { start: caret, end: caret };
      setHasSel(false);
    });
  }
  function appendToChapter() {
    setBody((b) => b.replace(/\s+$/, "") + "\n\n" + output + "\n");
  }

  async function exportDocx(scope) {
    if (dirty) { clearTimeout(saveTimer.current); await save(); }
    const res = await fetch("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ book, scope, chapterId: activeId }),
    });
    const blob = await res.blob();
    const cd = res.headers.get("Content-Disposition") || "";
    const m = cd.match(/filename="(.+?)"/);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = m ? m[1] : "book.docx";
    a.click();
    URL.revokeObjectURL(url);
  }

  const words = body.trim() ? body.trim().split(/\s+/).length : 0;
  const totalWords = chapters.reduce((s, c) => s + (c.words || 0), 0);
  const activeDef = ACTIONS.find((a) => a.id === action);

  function applyInsert() { insertAtCursor(); if (outMode !== "panel") setOutMode("panel"); }
  function applyAppend() { appendToChapter(); if (outMode !== "panel") setOutMode("panel"); }

  const isCanon = action === "canon";
  const shownFindings = isCanon && check ? check.findings : null;

  const surface = (
    <>
      <div className="out-head">
        <span className="section-label" style={{ margin: 0 }}>
          {running ? (isCanon ? "Checking canon…" : "Output · writing…") : isCanon ? "Canon check" : "Output"}
        </span>
        <div className="seg" style={{ marginLeft: "auto" }}>
          {[["panel", "Panel"], ["drawer", "Drawer"], ["full", "Full"]].map(([m, l]) => (
            <button key={m} className={"seg-btn" + (outMode === m ? " active" : "")} onClick={() => setOutMode(m)}>{l}</button>
          ))}
        </div>
      </div>

      {isCanon && !running ? (
        shownFindings === null ? (
          <div className="cw-output empty" ref={outRef}>
            No canon check yet for this chapter. Click “Run Canon check” to list fixable tasks.
          </div>
        ) : (
          <div className="cw-output" ref={outRef} style={{ fontFamily: "var(--sans)", fontSize: 13 }}>
            {shownFindings.length === 0 ? (
              <div style={{ color: "var(--teal)" }}>
                ✓ No canon issues found{freshRun ? ". CanonLog.md updated." : ` (previous run · ${timeAgo(check.ranAt)})`}
              </div>
            ) : (
              <div className="findings">
                <div className="find-note">
                  {freshRun
                    ? `${shownFindings.length} item${shownFindings.length === 1 ? "" : "s"} · saved to CanonLog.md`
                    : `From previous run · ${timeAgo(check.ranAt)} · run again to refresh`}
                </div>
                {shownFindings.map((f, i) => (
                  <div key={i} className={"finding" + (f.resolved ? " resolved" : "")}>
                    <div className="finding-top">
                      <span className={"find-sev sev-" + (f.severity || "note")}>{f.severity || "note"}</span>
                      <span className="find-issue">{f.issue}</span>
                      {f.resolved && <span className="find-done">resolved ✓</span>}
                    </div>
                    {f.fix && !f.resolved && <div className="find-fix"><b>Fix:</b> {f.fix}</div>}
                    {f.ruling && <div className="find-ruling"><b>Your ruling:</b> {f.ruling}</div>}
                    {!f.resolved && (
                      <div className="find-loc">
                        {f.quote && <span className="find-quote">“{f.quote}”</span>}
                        {f.quote && <button className="btn ghost find-go" onClick={() => goToQuote(f.quote)}>↧ Go to text</button>}
                        <button className="btn ghost find-go" onClick={() => { setReplyIdx(replyIdx === i ? null : i); setReplyText(""); }}>↩ Reply</button>
                      </div>
                    )}
                    {f.resolved && (
                      <button className="btn ghost find-go" onClick={() => resolveFinding(i, "undo")}>Undo</button>
                    )}
                    {replyIdx === i && !f.resolved && (
                      <div className="find-reply">
                        <textarea className="cw-prompt" style={{ minHeight: 52 }} value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="e.g. Solpan and the Salt Pans are the same place — not an error." />
                        <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                          <button className="btn" onClick={() => resolveFinding(i, "canon", replyText)} disabled={!replyText.trim()}>Add to canon &amp; resolve</button>
                          <button className="btn ghost" onClick={() => resolveFinding(i, "dismiss", replyText)}>Dismiss only</button>
                          <button className="btn ghost" onClick={() => { setReplyIdx(null); setReplyText(""); }}>Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {locateMsg && <div className="find-warn">{locateMsg}</div>}
              </div>
            )}
          </div>
        )
      ) : (
        <>
          <div className={"cw-output" + (output ? "" : " empty")} ref={outRef}>
            {output || (running ? "" : "Output appears here. Then insert it into your chapter or copy it.")}
            {running && <span className="blink"> ▌</span>}
          </div>
          {output && !running && (
            <div className="cw-output-actions">
              <button className="btn" onClick={applyInsert}>Insert at cursor</button>
              <button className="btn ghost" onClick={applyAppend}>Append to end</button>
              <button className="btn ghost" onClick={() => navigator.clipboard.writeText(output)}>Copy</button>
              {outMode !== "panel" && (
                <button className="btn ghost" style={{ marginLeft: "auto" }} onClick={() => setOutMode("panel")}>Close</button>
              )}
            </div>
          )}
        </>
      )}
    </>
  );

  return (
    <div className="app">
      <header className="header">
        <Link href="/" className="btn ghost" title="Back to library">← Library</Link>
        <div>
          <div className="brand-kicker">{bookMeta?.title || " "}</div>
          <div className="brand-title">The Scribe</div>
        </div>
        <div className="spacer" />
        <Link href="/settings" className="btn ghost" title="Settings">⚙</Link>
        {canon && (
          <span className={"canon-pill" + (canon.missing ? " missing" : "")} title={canon.dir}>
            {canon.missing || canon.files.length === 0
              ? "◈ No canon yet"
              : `◈ Canon: ${canon.files.length} files (${(canon.totalChars / 1000).toFixed(0)}k)`}
          </span>
        )}
        <button className="btn ghost" onClick={() => exportDocx("chapter")} disabled={!activeId}>
          ↓ {activeId ? `Chapter${parseInt((activeId.match(/\d+/) || ["0"])[0], 10)}` : "Chapter"}.docx
        </button>
        <button className="btn" onClick={() => exportDocx("book")} disabled={!chapters.length}>↓ Full book .docx</button>
      </header>

      <div className="cols">
        {!sidebarOpen && (
          <div className="rail rail-left" onClick={() => setSidebarOpen(true)} title="Show chapters">
            <button className="collapse-btn" onClick={(e) => { e.stopPropagation(); setSidebarOpen(true); }}>›</button>
            <span className="rail-label">Chapters</span>
          </div>
        )}
        <aside className="sidebar" style={{ display: sidebarOpen ? undefined : "none" }}>
          <div className="panel-head">
            <span className="section-label" style={{ margin: 0, flex: 1 }}>Chapters · {totalWords.toLocaleString()} words</span>
            <button className="collapse-btn" title="Collapse" onClick={() => setSidebarOpen(false)}>‹</button>
          </div>
          {chapters.map((c) => (
            <div
              key={c.id}
              className={"chapter-item" + (c.id === activeId ? " active" : "")}
              onClick={() => switchTo(c.id)}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div className="ci-title" style={{ flex: 1 }}>{c.title}</div>
                {confirmDel === c.id ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }} onClick={(e) => e.stopPropagation()}>
                    <span style={{ fontSize: 10, color: "var(--danger)" }}>Delete?</span>
                    <button className="btn danger" style={{ padding: "1px 8px", fontSize: 11 }}
                      onClick={(e) => { e.stopPropagation(); doDelete(c.id); }} title="Confirm delete">✓</button>
                    <button className="btn ghost" style={{ padding: "1px 8px", fontSize: 11 }}
                      onClick={(e) => { e.stopPropagation(); setConfirmDel(null); }} title="Cancel">✕</button>
                  </span>
                ) : (
                  <button className="btn ghost" style={{ padding: "1px 7px", fontSize: 13 }}
                    onClick={(e) => { e.stopPropagation(); setConfirmDel(c.id); }} title="Delete chapter">🗑</button>
                )}
              </div>
              <div className="ci-meta">{c.words.toLocaleString()} words</div>
            </div>
          ))}
          <button className="btn ghost" style={{ width: "100%", marginTop: 8 }} onClick={newChapter}>+ New chapter</button>

          {trash.length > 0 && (
            <div className="trash-section">
              <button className="trash-toggle" onClick={() => setTrashOpen((o) => !o)}>
                {trashOpen ? "▾" : "▸"} Deleted ({trash.length})
              </button>
              {trashOpen && trash.map((t) => (
                <div key={t.trashId} className="trash-item">
                  <div className="ci-title" style={{ fontSize: 13 }}>{t.title}</div>
                  <div className="ci-meta">{t.words.toLocaleString()} words · deleted {timeAgo(t.deletedAt)}</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                    <button className="btn ghost" style={{ padding: "2px 9px", fontSize: 11 }} onClick={() => restore(t.trashId)}>↩ Restore</button>
                    {confirmPurge === t.trashId ? (
                      <>
                        <button className="btn danger" style={{ padding: "2px 9px", fontSize: 11 }} onClick={() => purge(t.trashId)}>Delete forever?</button>
                        <button className="btn ghost" style={{ padding: "2px 9px", fontSize: 11 }} onClick={() => setConfirmPurge(null)}>✕</button>
                      </>
                    ) : (
                      <button className="btn ghost" style={{ padding: "2px 9px", fontSize: 11, color: "var(--danger)" }} onClick={() => setConfirmPurge(t.trashId)}>Delete forever</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>

        <main className="editor">
          <div className="editor-head">
            <input className="title-input" value={title} placeholder="Chapter title"
              onChange={(e) => setTitle(e.target.value)} disabled={!activeId} />
            <span className={"save-state" + (dirty ? " dirty" : "")}>
              {!activeId ? "" : dirty ? "unsaved…" : savedAt ? "saved" : "loaded"}
            </span>
          </div>
          <textarea
            ref={proseRef}
            className="prose"
            value={body}
            placeholder={activeId ? "Write here. Select text, then use the co-writer on the right." : "Create a chapter to begin."}
            onChange={(e) => setBody(e.target.value)}
            onSelect={trackSel}
            onKeyUp={trackSel}
            onMouseUp={trackSel}
            disabled={!activeId}
            spellCheck
          />
          <div className="editor-foot">
            <span>{words.toLocaleString()} words</span>
            {hasSel && <span style={{ color: "var(--gold)" }}>● selection active</span>}
          </div>
        </main>

        {cowriterOpen && (
          <div className={"resizer" + (dragging ? " dragging" : "")} onMouseDown={startResize} title="Drag to resize" />
        )}

        {!cowriterOpen && (
          <div className="rail rail-right" onClick={() => setCowriterOpen(true)} title="Show co-writer">
            <button className="collapse-btn" onClick={(e) => { e.stopPropagation(); setCowriterOpen(true); }}>‹</button>
            <span className="rail-label">Co-writer</span>
          </div>
        )}
        <aside className="cowriter" style={{ width: panelW, display: cowriterOpen ? undefined : "none" }}>
          <div className="cw-section">
            <div className="panel-head" style={{ marginBottom: 8 }}>
              <span className="section-label" style={{ margin: 0, flex: 1 }}>Co-writer · Opus</span>
              <button className="collapse-btn" title="Collapse" onClick={() => setCowriterOpen(false)}>›</button>
            </div>
            <div className="chip-row">
              {ACTIONS.map((a) => (
                <button key={a.id} className={"chip" + (action === a.id ? " active" : "")}
                  onClick={() => setAction(a.id)}>{a.label}</button>
              ))}
            </div>
            <div className="cw-hint">
              {activeDef?.desc}
              {activeDef?.scope === "sel" &&
                (hasSel ? " Using your selected text." : " No selection — uses the whole chapter.")}
            </div>
          </div>

          <div className="cw-section">
            <div className="section-label" style={{ margin: "0 0 8px" }}>Tone</div>
            <div className="chip-row">
              {TONES.map((t) => (
                <button key={t} className={"chip purple" + (tone === t ? " active" : "")}
                  onClick={() => setTone(tone === t ? "" : t)}>{t}</button>
              ))}
            </div>
          </div>

          <div className="cw-section">
            <textarea className="cw-prompt" value={prompt} placeholder="Optional direction, e.g. 'end on a hard cut to the next morning'"
              onChange={(e) => setPrompt(e.target.value)} />
            <button className="btn primary" style={{ width: "100%", marginTop: 10 }}
              onClick={run} disabled={running || !activeId}>
              {running ? "Writing…" : `✍ Run ${activeDef?.label || ""}`}
            </button>
          </div>

          <div className="cw-output-wrap">
            {outMode === "panel" ? surface : (
              <div className="out-stub">
                Output is open in <b>{outMode === "drawer" ? "Drawer" : "Full"}</b> view.
                <div style={{ marginTop: 10 }}>
                  <button className="btn ghost" onClick={() => setOutMode("panel")}>Show in panel</button>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      {outMode === "drawer" && <div className="out-drawer">{surface}</div>}
      {outMode === "full" && (
        <div className="out-full" onClick={(e) => { if (e.target === e.currentTarget) setOutMode("panel"); }}>
          <div className="out-full-box">{surface}</div>
        </div>
      )}
    </div>
  );
}
