// Turns a raw Anthropic SDK error into a short, human message + a code.
export function describeApiError(err) {
  const status = err?.status;
  const raw = err?.error?.error?.message || err?.message || "";
  const lower = String(raw).toLowerCase();

  if (lower.includes("credit balance") || lower.includes("too low") || lower.includes("billing")) {
    return {
      code: "billing",
      message:
        "Your Anthropic API account is out of credits. Add credits at console.anthropic.com → Billing. (The API is billed separately from any Claude subscription.)",
    };
  }
  if (lower.includes("workspace")) {
    return {
      code: "workspace",
      message:
        "This API key isn't tied to a workspace. Either paste your Workspace ID in Settings (field below the key), or create a workspace-scoped key at console.anthropic.com → API Keys.",
    };
  }
  if (status === 401 || lower.includes("authentication") || lower.includes("x-api-key") || lower.includes("invalid api key")) {
    return {
      code: "invalid",
      message: "Your API key was rejected (invalid or revoked). Open Settings and paste a valid key from console.anthropic.com.",
    };
  }
  if (status === 429 || lower.includes("rate limit")) {
    return { code: "rate", message: "Rate limited by the Anthropic API. Wait a few seconds and try again." };
  }
  if (status === 529 || lower.includes("overloaded")) {
    return { code: "overloaded", message: "The Anthropic API is temporarily overloaded. Try again in a moment." };
  }
  return { code: "error", message: raw || "The request failed. Please try again." };
}
