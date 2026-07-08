# 🧠 Second Brain Standup

Ingest meeting transcripts and build a queryable memory of **decisions, owners, deadlines, and open
threads** across meetings. The app proactively flags stale decisions and contradictions between
meetings, and lets you ask questions over the stored memory.

## Stack

- **Next.js (App Router) + TypeScript + Tailwind CSS v4** — deploys to Vercel.
- **Postgres via Drizzle ORM** (`pg` driver). Works with Vercel Postgres, Neon, Supabase, or a local
  Postgres instance — same connection-string interface everywhere.
- **Groq** (free tier) running an open-source model — default `llama-3.3-70b-versatile` — for
  extraction, contradiction detection, and Q&A. OpenAI-compatible API; no Anthropic key needed.

## Features

1. **Dashboard / timeline** — all extracted decisions grouped by day, each with text, owner,
   deadline, source meeting, created-at, and status (`open` / `done` / `stale`).
2. **Add Meeting** — paste a raw transcript; the model extracts decisions, owners, deadlines, and
   open questions as structured JSON, saved to the DB.
3. **Conflicts & Stale panel** — on load, marks any `open` decision with no update in 14+ days as
   `stale`, and asks the model to flag contradictions between recent decisions.
4. **Chat** — ask a question; relevant stored decisions + open questions are passed to the model and
   the answer **streams** back token-by-token.

## Deploying on Vercel

1. Import this repo into Vercel (Next.js is auto-detected).
2. In your Vercel project, go to **Storage → Create Database → Postgres** and attach it. Vercel
   injects `POSTGRES_URL` automatically — no manual config needed.
3. Add the `GROQ_API_KEY` environment variable (free key at https://console.groq.com/keys).
4. Deploy. The schema self-initializes on first request — no separate migration step.

## Local development

```bash
npm install

cp .env.example .env.local
# edit .env.local:
#   GROQ_API_KEY=...            (https://console.groq.com/keys)
#   DATABASE_URL=postgres://user:password@localhost:5432/second_brain

npm run dev
# open http://localhost:3000
```

Any reachable Postgres works for `DATABASE_URL` (local install, Docker, Neon, Supabase, etc.). The
schema self-initializes on first request. (`npm run db:generate` / `db:push` are available if you
prefer explicit Drizzle migrations instead.)

## Environment variables

| Variable       | Required                              | Default                   | Notes                                                                 |
| -------------- | -------------------------------------- | -------------------------- | ---------------------------------------------------------------------- |
| `GROQ_API_KEY` | yes                                     | —                           | Free key from console.groq.com                                        |
| `GROQ_MODEL`   | no                                      | `llama-3.3-70b-versatile`  | Swap the open-source model                                             |
| `POSTGRES_URL` | one of `POSTGRES_URL` / `DATABASE_URL` | —                           | Auto-set by Vercel when Postgres storage is attached                  |
| `DATABASE_URL` | one of `POSTGRES_URL` / `DATABASE_URL` | —                           | Standard `postgres://` connection string for local dev / other hosts  |

## Project layout

```
app/
  page.tsx                 Dashboard (timeline + conflicts + chat)
  api/meetings/route.ts    POST: transcript -> extract -> save
  api/decisions/route.ts   GET: decisions + open questions for the timeline
  api/conflicts/route.ts   GET: stale check + contradiction detection
  api/chat/route.ts        POST: streamed Q&A over stored memory
lib/
  db/{schema,index}.ts     Drizzle schema (pg-core) + self-initializing Postgres client
  groq.ts                  Groq client + robust JSON extraction helper
  extract.ts               Transcript -> structured decisions/questions
  conflicts.ts             Contradiction detection
components/                AddMeetingForm, DecisionTimeline, ConflictsPanel, ChatBox
```

## Notes

- Single-user demo — no auth / multi-user (by design).
- Open models don't guarantee JSON schema, so extraction uses Groq JSON mode plus defensive
  parsing (strip fences, slice outermost braces, fall back to an empty typed result) so a malformed
  response never crashes a request.
