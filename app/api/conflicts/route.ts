import { NextResponse } from "next/server";
import { and, desc, eq, lt } from "drizzle-orm";
import { getDb, getSchemaReady } from "@/lib/db";
import { decisions, meetings } from "@/lib/db/schema";
import { findContradictions } from "@/lib/conflicts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Configurable so staleness can be demoed/tested without waiting 14 real
// days (e.g. STALE_DAYS=0.001 on Vercel for a quick demo pass). Falls back
// to the 14-day default on anything not a positive number.
const parsedStaleDays = Number(process.env.STALE_DAYS);
const STALE_DAYS =
  Number.isFinite(parsedStaleDays) && parsedStaleDays > 0 ? parsedStaleDays : 14;
const STALE_MS = STALE_DAYS * 24 * 60 * 60 * 1000;
const MAX_FOR_CONTRADICTIONS = 40; // bound the LLM input

// Selected columns for decisions joined with their source's label/type,
// shared by both the stale list and the contradiction-check input below.
// Includes every field of the plain `Decision` row shape (so it can still be
// passed to `findContradictions`, which is untouched) plus the join extras.
const decisionWithSource = {
  id: decisions.id,
  text: decisions.text,
  owner: decisions.owner,
  deadline: decisions.deadline,
  sourceMeeting: decisions.sourceMeeting,
  status: decisions.status,
  sourceSnippet: decisions.sourceSnippet,
  createdAt: decisions.createdAt,
  sourceType: meetings.sourceType,
  sourceLabel: meetings.title,
} as const;

export async function GET() {
  let db;
  try {
    await getSchemaReady();
    db = getDb();
  } catch (err) {
    console.error("db unavailable", err);
    const message = err instanceof Error ? err.message : "Database unavailable.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const cutoff = new Date(Date.now() - STALE_MS);

  // 1. Stale: 'open' decisions with no update in 14+ days -> mark + collect.
  await db
    .update(decisions)
    .set({ status: "stale" })
    .where(and(eq(decisions.status, "open"), lt(decisions.createdAt, cutoff)));

  const stale = await db
    .select(decisionWithSource)
    .from(decisions)
    .leftJoin(meetings, eq(decisions.sourceMeeting, meetings.id))
    .where(eq(decisions.status, "stale"))
    .orderBy(desc(decisions.createdAt));

  // 2. Contradictions: ask the model over a bounded set of recent decisions.
  // (findContradictions itself is untouched — it only reads the plain
  // Decision fields; sourceType/sourceLabel are extras for the response.)
  const recent = await db
    .select(decisionWithSource)
    .from(decisions)
    .leftJoin(meetings, eq(decisions.sourceMeeting, meetings.id))
    .orderBy(desc(decisions.createdAt))
    .limit(MAX_FOR_CONTRADICTIONS);

  type ContradictionOut = {
    reason: string;
    a: (typeof recent)[number] | null;
    b: (typeof recent)[number] | null;
  };
  let contradictions: ContradictionOut[] = [];
  let contradictionError: string | null = null;
  try {
    const found = await findContradictions(recent);
    const byId = new Map(recent.map((d) => [d.id, d]));
    contradictions = found.map((c) => ({
      reason: c.reason,
      a: byId.get(c.decisionAId) ?? null,
      b: byId.get(c.decisionBId) ?? null,
    }));
  } catch (err) {
    console.error("contradiction check failed", err);
    contradictionError =
      err instanceof Error ? err.message : "Contradiction check failed.";
  }

  return NextResponse.json({ stale, contradictions, contradictionError });
}
