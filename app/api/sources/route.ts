import { NextResponse } from "next/server";
import { getDb, getSchemaReady } from "@/lib/db";
import { decisions, meetings, openQuestions } from "@/lib/db/schema";
import { SOURCE_TYPES, type SourceType, extractFromSource } from "@/lib/extract";

export const runtime = "nodejs";

const DEFAULT_TITLE: Record<SourceType, string> = {
  meeting: "Meeting",
  slack: "Slack",
  email: "Email",
};

export async function POST(req: Request) {
  let body: { sourceType?: string; title?: string; text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const sourceType = body.sourceType as SourceType | undefined;
  if (!sourceType || !SOURCE_TYPES.includes(sourceType)) {
    return NextResponse.json(
      { error: `sourceType must be one of: ${SOURCE_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  const text = (body.text ?? "").trim();
  if (!text) {
    return NextResponse.json({ error: "Source text is required." }, { status: 400 });
  }

  const title =
    (body.title ?? "").trim() ||
    `${DEFAULT_TITLE[sourceType]} — ${new Date().toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    })}`;

  // 1. Extract structured memory via the LLM.
  let extraction;
  try {
    extraction = await extractFromSource(sourceType, text);
  } catch (err) {
    console.error("extraction failed", err);
    const message =
      err instanceof Error ? err.message : "Failed to extract from source.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // 2. Persist the source + extracted rows.
  try {
    await getSchemaReady();
    const db = getDb();

    const [meeting] = await db
      .insert(meetings)
      .values({ title, transcript: text, sourceType })
      .returning();

    const insertedDecisions =
      extraction.decisions.length > 0
        ? await db
            .insert(decisions)
            .values(
              extraction.decisions.map((d) => ({
                text: d.text,
                owner: d.owner,
                deadline: d.deadline,
                sourceSnippet: d.sourceSnippet,
                category: d.category,
                sourceMeeting: meeting.id,
              }))
            )
            .returning()
        : [];

    const insertedQuestions =
      extraction.open_questions.length > 0
        ? await db
            .insert(openQuestions)
            .values(
              extraction.open_questions.map((q) => ({
                text: q.text,
                owner: q.owner,
                sourceMeeting: meeting.id,
              }))
            )
            .returning()
        : [];

    return NextResponse.json({
      meeting,
      decisions: insertedDecisions,
      openQuestions: insertedQuestions,
    });
  } catch (err) {
    console.error("db insert failed", err);
    return NextResponse.json(
      { error: "Failed to save source." },
      { status: 500 }
    );
  }
}
