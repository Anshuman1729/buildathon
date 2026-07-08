import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, getSchemaReady } from "@/lib/db";
import { decisions } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid decision id." }, { status: 400 });
  }

  let body: { status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const status = body.status ?? "done";
  if (status !== "done") {
    return NextResponse.json(
      { error: "Only status: 'done' is supported by this endpoint." },
      { status: 400 }
    );
  }

  try {
    await getSchemaReady();
    const db = getDb();

    const [updated] = await db
      .update(decisions)
      .set({ status: "done" })
      .where(eq(decisions.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Decision not found." }, { status: 404 });
    }

    return NextResponse.json({ decision: updated });
  } catch (err) {
    console.error("failed to update decision status", err);
    const message =
      err instanceof Error ? err.message : "Failed to update decision.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid decision id." }, { status: 400 });
  }

  try {
    await getSchemaReady();
    const db = getDb();

    const [deleted] = await db
      .delete(decisions)
      .where(eq(decisions.id, id))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: "Decision not found." }, { status: 404 });
    }

    return NextResponse.json({ decision: deleted });
  } catch (err) {
    console.error("failed to delete decision", err);
    const message =
      err instanceof Error ? err.message : "Failed to delete decision.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
