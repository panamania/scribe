import Anthropic from "@anthropic-ai/sdk";
import { loadCanon } from "../../../lib/canon.js";
import { getBook } from "../../../lib/books.js";
import {
  effectiveApiKey,
  effectiveModel,
  anthropicOptions,
  cachedSystem,
  cacheUsageLine,
} from "../../../lib/settings.js";
import { describeApiError } from "../../../lib/apierror.js";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const WRITING_LAWS = `WRITING LAWS (obey exactly):
- The canon bible above is ABSOLUTE. Never contradict any established name, trait, secret, relationship, geography, or locked decision. If the draft conflicts with canon, follow canon and flag the conflict.
- Honour the distinct voice of each faction, culture, and character exactly as the canon establishes it; do not flatten them into one register.
- Treat special items, powers, or devices the way the canon prescribes; never let them resolve a moral or political conflict on their own.
- Show, don't tell. Concrete sensory detail, subtext-laden dialogue. Prefer scenes that end on tension or revelation, not tidy resolution.
- Match the voice, tense, and POV already present in the draft. Do not restate what the draft already says.`;

const ACTIONS = {
  continue: {
    max: 1600,
    instruct: (ctx) =>
      `Continue the prose seamlessly from where the draft ends. Write NEW prose only — do not repeat or summarize existing text. Stay in the same POV, tense, and voice. Aim for 250-500 words.\n\n--- DRAFT SO FAR ---\n${ctx.body}`,
  },
  tighten: {
    max: 1600,
    instruct: (ctx) =>
      `Rewrite the passage below to be tighter and sharper — cut filler, strengthen verbs, keep every plot beat and the author's voice. Return ONLY the revised prose, nothing else.\n\n--- PASSAGE ---\n${ctx.target}`,
  },
  critique: {
    max: 1400,
    instruct: (ctx) =>
      `Give a focused editorial critique of the passage below. Cover: pacing, tension, dialogue, clarity, and anything that drags. Be specific and quote short bits. Use short bullet points. Do NOT rewrite it.\n\n--- PASSAGE ---\n${ctx.target}`,
  },
  canon: {
    max: 1400,
    instruct: (ctx) =>
      `Check the passage below against the canon bible. List: (1) any CONTRADICTIONS with canon, (2) names/terms that should change to canon spellings, (3) continuity risks. If it is fully consistent, say so plainly. Do NOT rewrite the prose.\n\n--- PASSAGE ---\n${ctx.target}`,
  },
  brainstorm: {
    max: 1400,
    instruct: (ctx) =>
      `Brainstorm what could happen next, consistent with canon and the draft so far. Offer 4-6 distinct options, each 1-3 sentences, escalating tension differently. Do NOT write full prose.\n\n--- DRAFT SO FAR ---\n${ctx.body}`,
  },
};

export async function POST(req) {
  const { key: apiKey } = await effectiveApiKey();
  if (!apiKey) {
    return new Response(
      "No Anthropic API key set. Open Settings (gear icon) and paste your key from console.anthropic.com — no restart needed.",
      { status: 400 }
    );
  }

  const {
    book,
    action = "continue",
    chapterTitle = "",
    body = "",
    selection = "",
    prompt = "",
    tone = "",
    characters = [],
  } = await req.json().catch(() => ({}));

  if (!book) return new Response("book required", { status: 400 });
  const canon = await loadCanon(book);
  const target = selection && selection.trim() ? selection : body;

  const bookMeta = await getBook(book);
  const system = `You are a master novelist co-writing the novel "${bookMeta.title || "this book"}". You are the author's collaborator, not a chatbot.

===== CANON BIBLE (absolute truth — your entire world reference) =====
${canon.missing ? "(No canon files found. Proceed carefully and flag unknowns.)" : canon.text}

${WRITING_LAWS}`;

  const def = ACTIONS[action];
  let userText;
  if (def) {
    userText = def.instruct({ body, target });
  } else {
    // custom / free prompt
    userText = `${prompt}\n\n--- CURRENT CHAPTER: ${chapterTitle} ---\n${target}`;
  }
  if (tone) userText += `\n\nRequired tone: ${tone}.`;
  if (characters && characters.length) userText += `\nFocus characters: ${characters.join(", ")}.`;
  if (prompt && def) userText += `\n\nAdditional direction from the author: ${prompt}`;

  const maxTokens = def ? def.max : 1600;

  const { opts } = await anthropicOptions();
  const client = new Anthropic(opts);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const s = await client.messages.stream({
          model: await effectiveModel(),
          max_tokens: maxTokens,
          // Cache the (static) system prompt + canon bible for cheap re-use.
          system: cachedSystem(system),
          messages: [{ role: "user", content: userText }],
        });
        for await (const event of s) {
          if (event.type === "message_start" && event.message?.usage) {
            console.log(cacheUsageLine(`generate/${action}`, event.message.usage));
          }
          if (
            event.type === "content_block_delta" &&
            event.delta?.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        controller.close();
      } catch (err) {
        const { message } = describeApiError(err);
        controller.enqueue(encoder.encode(`\n\n[error] ${message}`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
