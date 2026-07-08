import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { decisions, meetings, openQuestions } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  // Join meeting title onto each decision for display.
  const rows = db
    .select({
      id: decisions.id,
      text: decisions.text,
      owner: decisions.owner,
      deadline: decisions.deadline,
      status: decisions.status,
      createdAt: decisions.createdAt,
      sourceMeeting: decisions.sourceMeeting,
      meetingTitle: meetings.title,
    })
    .from(decisions)
    .leftJoin(meetings, eq(decisions.sourceMeeting, meetings.id))
    .orderBy(desc(decisions.createdAt))
    .all();

  const questions = db
    .select({
      id: openQuestions.id,
      text: openQuestions.text,
      owner: openQuestions.owner,
      createdAt: openQuestions.createdAt,
      meetingTitle: meetings.title,
    })
    .from(openQuestions)
    .leftJoin(meetings, eq(openQuestions.sourceMeeting, meetings.id))
    .orderBy(desc(openQuestions.createdAt))
    .all();

  return NextResponse.json({ decisions: rows, openQuestions: questions });
}
