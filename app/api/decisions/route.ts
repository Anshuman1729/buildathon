import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb, getSchemaReady } from "@/lib/db";
import { decisions, meetings, openQuestions } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await getSchemaReady();
    const db = getDb();

    // Join source label/type onto each decision for display.
    const rows = await db
      .select({
        id: decisions.id,
        text: decisions.text,
        owner: decisions.owner,
        deadline: decisions.deadline,
        status: decisions.status,
        createdAt: decisions.createdAt,
        sourceMeeting: decisions.sourceMeeting,
        sourceSnippet: decisions.sourceSnippet,
        sourceType: meetings.sourceType,
        sourceLabel: meetings.title,
      })
      .from(decisions)
      .leftJoin(meetings, eq(decisions.sourceMeeting, meetings.id))
      .orderBy(desc(decisions.createdAt));

    const questions = await db
      .select({
        id: openQuestions.id,
        text: openQuestions.text,
        owner: openQuestions.owner,
        createdAt: openQuestions.createdAt,
        sourceType: meetings.sourceType,
        sourceLabel: meetings.title,
      })
      .from(openQuestions)
      .leftJoin(meetings, eq(openQuestions.sourceMeeting, meetings.id))
      .orderBy(desc(openQuestions.createdAt));

    return NextResponse.json({ decisions: rows, openQuestions: questions });
  } catch (err) {
    console.error("failed to load decisions", err);
    const message =
      err instanceof Error ? err.message : "Failed to load decisions.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
