import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { decisions, meetings, openQuestions } from "@/lib/db/schema";
import { extractFromTranscript } from "@/lib/extract";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { title?: string; transcript?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const transcript = (body.transcript ?? "").trim();
  if (!transcript) {
    return NextResponse.json(
      { error: "A transcript is required." },
      { status: 400 }
    );
  }

  const title =
    (body.title ?? "").trim() ||
    `Meeting — ${new Date().toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    })}`;

  // 1. Extract structured memory via the LLM.
  let extraction;
  try {
    extraction = await extractFromTranscript(transcript);
  } catch (err) {
    console.error("extraction failed", err);
    const message =
      err instanceof Error ? err.message : "Failed to extract from transcript.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // 2. Persist the meeting + extracted rows.
  try {
    const [meeting] = db
      .insert(meetings)
      .values({ title, transcript })
      .returning()
      .all();

    const insertedDecisions =
      extraction.decisions.length > 0
        ? db
            .insert(decisions)
            .values(
              extraction.decisions.map((d) => ({
                text: d.text,
                owner: d.owner,
                deadline: d.deadline,
                sourceMeeting: meeting.id,
              }))
            )
            .returning()
            .all()
        : [];

    const insertedQuestions =
      extraction.open_questions.length > 0
        ? db
            .insert(openQuestions)
            .values(
              extraction.open_questions.map((q) => ({
                text: q.text,
                owner: q.owner,
                sourceMeeting: meeting.id,
              }))
            )
            .returning()
            .all()
        : [];

    return NextResponse.json({
      meeting,
      decisions: insertedDecisions,
      openQuestions: insertedQuestions,
    });
  } catch (err) {
    console.error("db insert failed", err);
    return NextResponse.json(
      { error: "Failed to save meeting." },
      { status: 500 }
    );
  }
}
