# Handoff — Second Brain Standup

Quick-orientation doc for picking this project up in a new session. For the full feature list,
stack overview, deploy steps, and env var table, see `README.md` — this file only covers status
and gotchas that aren't obvious from the code alone.

## What this is

Next.js (App Router) + TypeScript + Tailwind app on Vercel, using Drizzle ORM against Postgres
(Neon) and Groq (free-tier, `llama-3.3-70b-versatile`) for extraction/contradiction-detection/chat.
Ingests meeting transcripts, Slack exports, and email threads; extracts decisions with
owner/deadline/status; flags contradictions and staleness; has a Gantt view and a chat box over
stored memory.

- **Branch:** `claude/second-brain-standup-qldfeu` — also the repo's default branch (repo was
  empty when this branch was created, so there's no `main` to PR against).
- **Live deploy:** https://buildathon-psi.vercel.app/
- **DB:** Neon Postgres, connected via Vercel's Postgres integration.

## Feature status

All implemented and live-verified end-to-end on Vercel with real test data (multi-source import,
Gantt, conflicts/stale, chat, mark-done) — **except** deadline extraction + Gantt rendering against
non-trivial deadlines specifically, which were fixed at the very end of this session but not yet
re-verified live afterward. That's the natural first thing to check in a new session.

## Non-obvious gotchas (read before touching these areas)

- **`lib/db/index.ts` — advisory lock must stay transaction-scoped.** Neon's connection string uses
  the pooled (`-pooler`) endpoint, i.e. PgBouncer in transaction-pooling mode. Session-level
  advisory locks (`pg_advisory_lock`/`unlock`) are unsafe there — the pooler can hand the physical
  connection to a different logical session mid-flight, which hung every DB-touching request
  indefinitely in production (confirmed via Vercel logs: 300s timeouts on every route). Fixed by
  switching to `pg_advisory_xact_lock` inside an explicit `BEGIN`/`COMMIT`. **Don't revert this.**
  This only manifests against a pooled connection — local Postgres has no pooler, so this class of
  bug won't show up in local testing.
- **`lib/groq.ts` — client has `timeout: 25_000, maxRetries: 0`, and `AddSourceForm.tsx`'s fetch
  aborts at 45s.** Both intentional. Without them, a hung/slow Groq call sits there until Vercel's
  own platform timeout with zero diagnostic signal — this is exactly what happened before these
  were added. Keep the client-side abort comfortably above the server-side timeout so the server's
  real error message wins the race.
- **`lib/extract.ts` — deadline extraction needs an anchor date.** Every extraction call injects
  `Today's date: YYYY-MM-DD` into the user message, and the prompt has a deadline-specific rule
  (resolve to ISO when confident, else preserve the phrase as written, `null` only when no timeframe
  is stated at all). Without the anchor date, the model defaulted to `null` for almost every
  relative timeframe ("Friday", "end of month") — confirmed via live testing before this fix.
- **`STALE_DAYS` env var (`app/api/conflicts/route.ts`)** — optional, defaults to 14. Exists so
  staleness can be tested without waiting 14 real days (`created_at` is import time, not any date
  implied by the pasted text). If it's ever set low on Vercel for a demo, **make sure it's set back
  to 14 (or unset)** afterward — check current value before assuming production behavior is default.
- **This dev/planning sandbox cannot reach `api.groq.com` or `*.vercel.app`** (network egress
  policy). Anything Groq- or Vercel-runtime-dependent can only be verified by deploying and testing
  live — local Postgres testing and `npm run build` are the only things directly checkable from a
  sandboxed session.

## Suggested next steps (no strong priority order)

- Re-verify deadline extraction + Gantt bar rendering live, now that the extraction prompt fix has
  shipped — re-run the Slack/email/meeting test data from this session and confirm deadlines
  populate and bars render correctly grouped by owner.
- Consider a "mark done" action from the Conflicts panel's stale list too (currently only in
  Timeline and Gantt) — deliberately left out of the last pass to keep it scoped.
- No automated tests exist anywhere in the repo — everything so far has been verified via manual
  local Postgres testing plus live Vercel testing with the user.
- Real Slack/Gmail OAuth import was explicitly out of scope for all passes so far (paste-based
  only) — ask before adding.
