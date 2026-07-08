import { NextResponse } from "next/server";
import { and, desc, eq, lt } from "drizzle-orm";
import { getDb, getSchemaReady } from "@/lib/db";
import { decisions } from "@/lib/db/schema";
import { findContradictions } from "@/lib/conflicts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STALE_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
const MAX_FOR_CONTRADICTIONS = 40; // bound the LLM input

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
    .select()
    .from(decisions)
    .where(eq(decisions.status, "stale"))
    .orderBy(desc(decisions.createdAt));

  // 2. Contradictions: ask the model over a bounded set of recent decisions.
  const recent = await db
    .select()
    .from(decisions)
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
