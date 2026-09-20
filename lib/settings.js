import { storage } from "./storage.js";

// Server-side settings (model, workspace) persist in storage so they survive
// without editing env or restarting.
//
// SECURITY / CLOUD NOTE: the Anthropic API key is NOT persisted in the cloud.
// When ANTHROPIC_API_KEY is set in the environment (as it is on Amplify), that
// env value always wins and the key is never written to S3. Only in pure local
// dev — no env key — can a key be saved via the Settings UI (into local files).
const SETTINGS_KEY = "_scribe/settings.json";

const DEFAULTS = { anthropicApiKey: "", model: "claude-opus-4-8", workspaceId: "" };

export function keyIsManagedByEnv() {
  return !!process.env.ANTHROPIC_API_KEY;
}

export async function readSettings() {
  const stored = (await storage.getJSON(SETTINGS_KEY)) || {};
  return { ...DEFAULTS, ...stored };
}

export async function writeSettings(patch) {
  const cur = await readSettings();
  const next = { ...cur, ...patch };
  // Never persist an API key when the environment already provides one.
  if (keyIsManagedByEnv()) next.anthropicApiKey = "";
  await storage.putJSON(SETTINGS_KEY, next);
  return next;
}

export async function effectiveApiKey() {
  const env = process.env.ANTHROPIC_API_KEY || "";
  if (env) return { key: env, source: "env" };
  const s = await readSettings();
  return {
    key: s.anthropicApiKey || "",
    source: s.anthropicApiKey ? "settings" : "none",
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

// Wrap a system prompt as a cache-controlled content block. The large, stable
// prefix (mostly the canon bible, resent on every call) is then cached by
// Anthropic: subsequent calls within the cache window read it at ~10% of the
// input-token price instead of paying full price every time. The canon changes
// only when the author edits canon files, which correctly invalidates the cache.
// This exact shape also works on Amazon Bedrock via @anthropic-ai/bedrock-sdk,
// so it survives a later move to Bedrock unchanged.
export function cachedSystem(text) {
  return [{ type: "text", text: String(text || ""), cache_control: { type: "ephemeral" } }];
}

// Compact one-line summary of cache usage for server logs.
export function cacheUsageLine(label, usage) {
  const u = usage || {};
  return `[cache] ${label} read=${u.cache_read_input_tokens || 0} write=${u.cache_creation_input_tokens || 0} input=${u.input_tokens || 0} output=${u.output_tokens || 0}`;
}

// Never expose the raw key to the browser — only a masked tail.
export function maskKey(key) {
  if (!key) return "";
  if (key.length <= 8) return "••••";
  return `${key.slice(0, 6)}…${key.slice(-4)}`;
}
