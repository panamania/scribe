import fs from "node:fs/promises";
import path from "node:path";

// Server-side settings (API key, model) live in a gitignored file so they
// persist without editing .env or restarting. The settings file wins over
// environment variables when set.
const FILE = path.join(process.cwd(), "data", "settings.json");

const DEFAULTS = { anthropicApiKey: "", model: "claude-opus-4-8", workspaceId: "" };

export async function readSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(await fs.readFile(FILE, "utf-8")) };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function writeSettings(patch) {
  const cur = await readSettings();
  const next = { ...cur, ...patch };
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(next, null, 2), "utf-8");
  return next;
}

export async function effectiveApiKey() {
  const s = await readSettings();
  return {
    key: s.anthropicApiKey || process.env.ANTHROPIC_API_KEY || "",
    source: s.anthropicApiKey ? "settings" : process.env.ANTHROPIC_API_KEY ? "env" : "none",
  };
}

export async function effectiveModel() {
  const s = await readSettings();
  return s.model || process.env.SCRIBE_MODEL || "claude-opus-4-8";
}

export async function effectiveWorkspaceId() {
  const s = await readSettings();
  return s.workspaceId || process.env.ANTHROPIC_WORKSPACE_ID || "";
}

// Builds Anthropic client options with the workspace header when configured.
export async function anthropicOptions() {
  const { key } = await effectiveApiKey();
  const ws = await effectiveWorkspaceId();
  const opts = { apiKey: key };
  if (ws) opts.defaultHeaders = { "anthropic-workspace-id": ws };
  return { opts, hasKey: !!key };
}

// Never expose the raw key to the browser — only a masked tail.
export function maskKey(key) {
  if (!key) return "";
  if (key.length <= 8) return "••••";
  return `${key.slice(0, 6)}…${key.slice(-4)}`;
}
