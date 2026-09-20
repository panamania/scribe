# Cinderwake Scribe

A local, canon-aware writing studio for **Book 1**. Your manuscript stays as plain
Markdown files you own; the co-writer (Claude Opus) reads your full canon on every
request so it never contradicts your own bible.

## Run it

```bash
cd scribe
npm run dev
```

Then open http://localhost:4321

## Turn on the co-writer

Open **Settings** (⚙ in the header), paste your key from
https://console.anthropic.com, and Save — no restart needed. The key is stored
locally in `scribe/data/settings.json` (gitignored) and used only to call the
Anthropic API. You can also pick the model there (Opus / Sonnet / Haiku).

Alternatively, set `ANTHROPIC_API_KEY` in `.env.local` (copy from
`.env.local.example`) and restart — the Settings value takes precedence when both exist.

Writing, chapters, and `.docx` export all work **without** a key. Only the
co-writer panel (Continue / Tighten / Critique / Canon check / Brainstorm) needs it.

## Library & multiple books

The landing page (`/`) is your **Library** — a shelf of books. Each book is a
self-contained folder; create as many as you like. Per book you can (optionally)
upload a **canon** bible and set a **cover image** from the book's *Manage* panel.

## Where your files live (all in the Book folder, not inside the app)

Everything lives under `../books/<book-id>/`:

| What | Location |
|------|----------|
| A book's chapters | `../books/<id>/manuscript/chNN.md` |
| A book's canon bible (optional) | `../books/<id>/canon/*.md` |
| A book's cover (optional) | `../books/<id>/cover.<ext>` |
| Book metadata (title, cover) | `../books/<id>/book.json` |
| Exported Word docs | download to your browser's Downloads |

Your original Cinderwake work was migrated into `../books/cinderwake/`.
Change the base folder with `BOOKS_DIR` in `.env.local`.

## How it works

- **Chapters** — each is a real `.md` file. Edit here or in any editor; autosaves ~1s after you stop typing.
- **Delete & recover** — deleting a chapter (🗑 → inline "Delete?") moves its file to `manuscript/.trash/` rather than erasing it. A **Deleted** section in the sidebar lets you **Restore** it (renumbered if its slot was reused) or **Delete forever**.
- **Canon consistency** — every canon `.md` file is loaded *in full* into Opus's context (no lossy vector search — your canon is small enough to send whole).
- **Canon check** — returns each issue as a fixable task (problem + concrete fix + a verbatim quote), and a **Go to text** button that selects that spot in the editor. Every run also **rewrites a managed section of `CanonLog.md`** (between `<!-- CANON-CHECK -->` markers) with the latest findings — your own sections in that file are preserved, and the auto-generated block is stripped from the canon sent to Opus so it never pollutes generation.
- **Previous findings are retained per chapter** in `books/<id>/canonchecks.json`. Reopen a chapter and pick *Canon check* and the last run's tasks come back (with a "from previous run" note) without spending another API call; *Run Canon check* refreshes them.
- **Reply to a finding** (↩ Reply) when it's a false positive or should become canon. *Add to canon & resolve* writes your ruling to `canon/Clarifications.md` (real canon, fed to Opus, so it won't be re-flagged) and marks the finding resolved; *Dismiss only* resolves it without writing canon; *Undo* reopens it. Example: "Solpan and the Salt Pans are the same place" or "Hanneg isn't counted among the six scouts."
- **.docx export** — real Word files via the `docx` library:
  - `↓ Chapter<N>.docx` — just the open chapter (e.g. `Chapter1.docx`).
  - `↓ Cinderwake.docx` — the **merged full book**: every chapter, in order, with chapter headings and page breaks. This is regenerated from all your chapter files each time, so it's always up to date — no manual stitching. (Rename the book via `SCRIBE_BOOK_NAME` in `.env.local`.)

## Seeded from

`Book.docx` → `books/cinderwake/manuscript/ch01.md` (Chapter 1, the Red Sinew Pass standoff).
