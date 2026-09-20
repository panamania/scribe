"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const THEMES = [
  ["paper", "Warm Paper", "#f7f1e3", "#9a5b34"],
  ["clean", "Clean Slate", "#ffffff", "#3b6ea5"],
  ["dark", "Muted Dark", "#1c1f26", "#86b8a1"],
  ["sepia", "Sepia Focus", "#ece3d0", "#8c6b4a"],
];

const MODELS = [
  ["claude-opus-4-8", "Opus 4.8 — best prose (default)"],
  ["claude-opus-5", "Opus 5"],
  ["claude-sonnet-5", "Sonnet 5 — faster / cheaper"],
  ["claude-haiku-4-5-20251001", "Haiku 4.5 — fastest"],
];

export default function SettingsPage() {
  const [theme, setTheme] = useState("paper");
  const [status, setStatus] = useState(null);
  const [model, setModel] = useState("claude-opus-4-8");
  const [workspace, setWorkspace] = useState("");
  const [keyInput, setKeyInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [layoutMsg, setLayoutMsg] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null); // { ok, message }

  useEffect(() => {
    try {
      const t = localStorage.getItem("scribe_theme");
      if (t) { setTheme(t); document.documentElement.setAttribute("data-theme", t); }
    } catch {}
    (async () => {
      const r = await fetch("/api/settings");
      const d = await r.json();
      setStatus(d);
      setModel(d.model || "claude-opus-4-8");
      setWorkspace(d.workspaceId || "");
    })();
  }, []);

  function chooseTheme(id) {
    setTheme(id);
    document.documentElement.setAttribute("data-theme", id);
    try { localStorage.setItem("scribe_theme", id); } catch {}
  }

  async function saveAI() {
    setSaving(true);
    setSavedMsg("");
    const r = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: keyInput || undefined, model, workspaceId: workspace }),
    });
    const d = await r.json();
    setStatus(d);
    setModel(d.model);
    setWorkspace(d.workspaceId || "");
    setKeyInput("");
    setSaving(false);
    setSavedMsg("Saved ✓");
    setTimeout(() => setSavedMsg(""), 2500);
  }

  async function testKey() {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await fetch("/api/settings/test", { method: "POST" });
      const d = await r.json();
      setTestResult({ ok: !!d.ok, message: d.message });
    } catch (e) {
      setTestResult({ ok: false, message: e.message });
    }
    setTesting(false);
  }

  async function clearKey() {
    const r = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clearKey: true }),
    });
    setStatus(await r.json());
    setSavedMsg("Key cleared");
    setTimeout(() => setSavedMsg(""), 2500);
  }

  function resetLayout() {
    try {
      ["scribe_panelw", "scribe_outmode", "scribe_sidebar", "scribe_cowriter"].forEach((k) =>
        localStorage.removeItem(k)
      );
    } catch {}
    setLayoutMsg("Layout reset — reopen a book to see defaults.");
    setTimeout(() => setLayoutMsg(""), 3000);
  }

  const keyLine = !status
    ? "…"
    : status.keySource === "settings"
    ? `Key saved in settings ✓  (${status.keyMasked})`
    : status.keySource === "env"
    ? `Using key from .env.local ✓  (${status.keyMasked})`
    : "No API key set — the co-writer won't run until you add one.";

  return (
    <div className="settings-page">
      <header className="lib-header">
        <Link href="/" className="btn ghost" title="Back to library">← Library</Link>
        <div>
          <div className="brand-kicker">The Scribe</div>
          <div className="brand-title" style={{ fontSize: 24 }}>Settings</div>
        </div>
      </header>

      <div className="settings-body">
        {/* Appearance */}
        <section className="set-card">
          <h2 className="set-h">Appearance</h2>
          <div className="mng-label">Theme</div>
          <div className="set-themes">
            {THEMES.map(([id, name, base, accent]) => (
              <button
                key={id}
                className={"set-theme" + (theme === id ? " active" : "")}
                onClick={() => chooseTheme(id)}
              >
                <span className="swatch" style={{ background: `linear-gradient(135deg, ${base} 0 50%, ${accent} 50% 100%)` }} />
                <span>{name}</span>
              </button>
            ))}
          </div>

          <div className="mng-label" style={{ marginTop: 18 }}>Layout</div>
          <p className="set-note">Panel width, output view, and collapsed panels are remembered per device.</p>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button className="btn ghost" onClick={resetLayout}>Reset layout to defaults</button>
            {layoutMsg && <span className="set-ok">{layoutMsg}</span>}
          </div>
        </section>

        {/* AI */}
        <section className="set-card">
          <h2 className="set-h">AI &amp; API</h2>

          <div className="mng-label">Anthropic API key</div>
          <div className={"set-status" + (status && status.hasKey ? " ok" : " warn")}>{keyLine}</div>
          <p className="set-note">
            Stored locally in <code>scribe/data/settings.json</code> (gitignored) and used only to call the
            Anthropic API. Get a key at{" "}
            <a href="https://console.anthropic.com" target="_blank" rel="noreferrer">console.anthropic.com</a>.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <input
              className="set-input"
              type="password"
              autoComplete="off"
              value={keyInput}
              placeholder={status && status.hasKey ? "Enter a new key to replace…" : "sk-ant-…"}
              onChange={(e) => setKeyInput(e.target.value)}
            />
            {status && status.keySource === "settings" && (
              <button className="btn ghost" style={{ color: "var(--danger)" }} onClick={clearKey}>Clear</button>
            )}
          </div>

          <div className="mng-label" style={{ marginTop: 18 }}>Workspace ID (optional)</div>
          <input
            className="set-input"
            value={workspace}
            placeholder="wrkspc_… (only if your key isn't workspace-scoped)"
            onChange={(e) => setWorkspace(e.target.value)}
          />
          <p className="set-note">
            Only needed if you get a “not scoped to a workspace” error. Find it in
            console.anthropic.com → your workspace → Settings, or just use a key created inside a workspace.
          </p>

          <div className="mng-label" style={{ marginTop: 18 }}>Model</div>
          <select className="set-input" value={MODELS.some(([id]) => id === model) ? model : "__custom"}
            onChange={(e) => { if (e.target.value !== "__custom") setModel(e.target.value); }}>
            {MODELS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            <option value="__custom">Custom…</option>
          </select>
          {!MODELS.some(([id]) => id === model) && (
            <input className="set-input" style={{ marginTop: 8 }} value={model}
              onChange={(e) => setModel(e.target.value)} placeholder="model id" />
          )}
          <p className="set-note">Opus gives the best prose; Sonnet/Haiku are faster and cheaper for utility edits.</p>

          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 6, flexWrap: "wrap" }}>
            <button className="btn primary" onClick={saveAI} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button className="btn ghost" onClick={testKey} disabled={testing || !(status && status.hasKey)}
              title={status && status.hasKey ? "Send a tiny request to verify the key & billing" : "Save a key first"}>
              {testing ? "Testing…" : "Test key"}
            </button>
            {savedMsg && <span className="set-ok">{savedMsg}</span>}
          </div>
          {testResult && (
            <div className={"set-status " + (testResult.ok ? "ok" : "warn")} style={{ marginTop: 12 }}>
              {(testResult.ok ? "✓ " : "⚠ ") + testResult.message}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
