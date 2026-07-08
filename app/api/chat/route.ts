import { desc, eq } from "drizzle-orm";
import { getDb, getSchemaReady } from "@/lib/db";
import { decisions, meetings, openQuestions } from "@/lib/db/schema";
import { GROQ_MODEL, getGroq } from "@/lib/groq";
import { CATEGORIES, type Category } from "@/lib/extract";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "groq-sdk/resources/chat/completions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function systemPrompt(): string {
  const today = new Date().toISOString().slice(0, 10);
  return `You are the "Second Brain" for a team's meetings, Slack channels, and email threads.
Today's date: ${today}

You have two jobs:
1. Answer questions using ONLY the stored decisions and open questions provided below as context. Cite
   owners and deadlines when relevant. If the context does not contain the answer, say so plainly — do
   not invent facts.
2. Let the user record new decisions and open questions directly through this chat, as an alternative to
   pasting a transcript.

When the user describes something that sounds like a decision the team made, do NOT call create_decision
until you have all of:
- a clear, concise statement of the decision
- an owner (or the user has explicitly said it's unassigned/nobody/unowned)
- a deadline (or the user has explicitly said there is none)
- enough context to pick a category from: ${CATEGORIES.join(", ")}

If any of those is missing or ambiguous, ask ONE short clarifying question for the most important missing
piece. NEVER invent, guess, or default a value for owner, deadline, or category that the user did not
actually state — if you are not certain, ask instead of calling a tool. Getting a field wrong is worse
than asking one more question. Once — and only once — you have everything, call create_decision.

Deadline resolution: if the user states a due date or timeframe (e.g. "Friday", "the 25th", "10 July",
"end of month"), resolve it against Today's date above and output an ISO date (YYYY-MM-DD) — e.g. "10
July" with no year stated means the next occurrence of July 10 on or after today's date, never a past or
arbitrary year. If you cannot confidently resolve an exact date, pass the phrase exactly as the user said
it instead of guessing a date.

If the user corrects or adds a detail (owner, deadline, category, text) to a decision you already saved
earlier in this conversation — visible as "Saved decision #<id>" in your own prior reply — call
update_decision with that same id and only the field(s) being changed. Do NOT call create_decision again
for the same decision; that creates an unwanted duplicate.

For an open/unresolved question the user raises, call create_open_question once you have the question
text (owner is optional, no need to ask for it).

Be concise and direct. Do not narrate that you are "about to call a tool" — just ask the clarifying
question or make the call.`;
}

const TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "create_decision",
      description:
        "Save a new decision once the user has given a clear owner, deadline (or explicit confirmation there is none), and enough context to classify a category.",
      parameters: {
        type: "object",
        properties: {
          text: { type: "string", description: "Concise, self-contained statement of the decision." },
          owner: { type: "string", description: "Person responsible, or 'unassigned'." },
          deadline: { type: "string", description: "ISO date (YYYY-MM-DD) or phrase, or 'none'." },
          category: { type: "string", enum: [...CATEGORIES] },
        },
        required: ["text", "owner", "deadline", "category"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_decision",
      description:
        "Correct or fill in a field on a decision you already saved earlier in this conversation (identified by the numeric id from your own 'Saved decision #<id>' reply) — use this instead of create_decision when the user is following up on something already saved, to avoid creating a duplicate.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "number", description: "The id from a prior 'Saved decision #<id>' reply." },
          text: { type: "string" },
          owner: { type: "string" },
          deadline: { type: "string" },
          category: { type: "string", enum: [...CATEGORIES] },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_open_question",
      description: "Save an open/unresolved question the user raises via chat.",
      parameters: {
        type: "object",
        properties: {
          text: { type: "string" },
          owner: { type: "string", description: "Person expected to follow up, or 'unassigned'." },
        },
        required: ["text"],
      },
    },
  },
];

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t || /^(null|n\/a|none|unassigned|unknown)$/i.test(t)) return null;
  return t;
}

function normalizeCategory(v: unknown): Category {
  const raw = str(v);
  const matched = raw ? CATEGORIES.find((c) => c.toLowerCase() === raw.toLowerCase()) : undefined;
  return matched ?? "Other";
}

export async function POST(req: Request) {
  let body: { messages?: { role: "user" | "assistant"; content: string }[] };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON body.", { status: 400 });
  }

  const clientMessages = (body.messages ?? []).filter(
    (m) => (m.role === "user" || m.role === "assistant") && m.content.trim()
  );
  if (clientMessages.length === 0) {
    return new Response("At least one message is required.", { status: 400 });
  }

  let context: string;
  let groq;
  try {
    await getSchemaReady();
    const db = getDb();
    const allDecisions = await db.select().from(decisions).orderBy(desc(decisions.createdAt));
    const allQuestions = await db.select().from(openQuestions).orderBy(desc(openQuestions.createdAt));
    context = buildContext(allDecisions, allQuestions);
    groq = getGroq();
  } catch (err) {
    console.error("chat setup failed", err);
    const message = err instanceof Error ? err.message : "Chat unavailable.";
    return new Response(message, { status: 500 });
  }

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: `${systemPrompt()}\n\nStored memory:\n${context}` },
    ...clientMessages,
  ];

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        // Phase 1: non-streaming call with tools so we can reliably detect
        // and execute a tool call before deciding how to respond — Groq's
        // streaming tool-call deltas need accumulation across chunks, which
        // adds real complexity for little benefit given how fast Groq
        // inference already is.
        const first = await groq.chat.completions.create({
          model: GROQ_MODEL,
          temperature: 0,
          tools: TOOLS,
          tool_choice: "auto",
          messages,
        });

        const choice = first.choices[0];
        const toolCalls = choice?.message?.tool_calls;

        if (!toolCalls || toolCalls.length === 0) {
          controller.enqueue(encoder.encode(choice?.message?.content ?? ""));
          controller.close();
          return;
        }

        // Phase 2: execute each requested tool call against the DB, then ask
        // the model to phrase a natural confirmation given the results.
        const toolResultMessages: ChatCompletionMessageParam[] = [];
        let sharedMeetingId: number | null = null;

        for (const call of toolCalls) {
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(call.function.arguments || "{}");
          } catch {
            // leave args empty; downstream str()/normalize calls handle it
          }

          let resultText: string;
          try {
            if (call.function.name === "create_decision") {
              const text = str(args.text);
              if (!text) {
                resultText = "Missing decision text — could not save.";
              } else {
                if (sharedMeetingId === null) {
                  sharedMeetingId = await ensureChatMeeting(clientMessages);
                }
                const [row] = await getDb()
                  .insert(decisions)
                  .values({
                    text,
                    owner: str(args.owner),
                    deadline: str(args.deadline),
                    category: normalizeCategory(args.category),
                    sourceMeeting: sharedMeetingId,
                  })
                  .returning();
                resultText = `Saved decision #${row.id}: "${row.text}" (owner: ${row.owner ?? "unassigned"}, deadline: ${row.deadline ?? "none"}, category: ${row.category}).`;
              }
            } else if (call.function.name === "update_decision") {
              const id = Number(args.id);
              if (!Number.isInteger(id) || id <= 0) {
                resultText = "Missing or invalid decision id — could not update.";
              } else {
                const patch: Partial<typeof decisions.$inferInsert> = {};
                if (args.text !== undefined) {
                  const text = str(args.text);
                  if (text) patch.text = text;
                }
                if (args.owner !== undefined) patch.owner = str(args.owner);
                if (args.deadline !== undefined) patch.deadline = str(args.deadline);
                if (args.category !== undefined) patch.category = normalizeCategory(args.category);

                const [row] = await getDb()
                  .update(decisions)
                  .set(patch)
                  .where(eq(decisions.id, id))
                  .returning();

                resultText = row
                  ? `Updated decision #${row.id}: "${row.text}" (owner: ${row.owner ?? "unassigned"}, deadline: ${row.deadline ?? "none"}, category: ${row.category}).`
                  : `No decision #${id} found — could not update.`;
              }
            } else if (call.function.name === "create_open_question") {
              const text = str(args.text);
              if (!text) {
                resultText = "Missing question text — could not save.";
              } else {
                if (sharedMeetingId === null) {
                  sharedMeetingId = await ensureChatMeeting(clientMessages);
                }
                const [row] = await getDb()
                  .insert(openQuestions)
                  .values({ text, owner: str(args.owner), sourceMeeting: sharedMeetingId })
                  .returning();
                resultText = `Saved open question #${row.id}: "${row.text}".`;
              }
            } else {
              resultText = `Unknown tool: ${call.function.name}`;
            }
          } catch (err) {
            console.error("chat tool execution failed", err);
            resultText = "Failed to save — a database error occurred.";
          }

          toolResultMessages.push({
            role: "tool",
            tool_call_id: call.id,
            content: resultText,
          });
        }

        const second = await groq.chat.completions.create({
          model: GROQ_MODEL,
          temperature: 0.3,
          stream: true,
          messages: [
            ...messages,
            { role: "assistant", content: choice.message.content ?? "", tool_calls: toolCalls },
            ...toolResultMessages,
          ],
        });

        for await (const chunk of second) {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) controller.enqueue(encoder.encode(delta));
        }
      } catch (err) {
        console.error("chat stream failed", err);
        controller.enqueue(encoder.encode("\n\n[Error generating answer. Please try again.]"));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}

/** One meetings row per chat turn that creates something, used as the required sourceMeeting FK. */
async function ensureChatMeeting(clientMessages: { role: string; content: string }[]): Promise<number> {
  const lastUser = [...clientMessages].reverse().find((m) => m.role === "user");
  const [meeting] = await getDb()
    .insert(meetings)
    .values({
      title: `Chat — ${new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}`,
      transcript: lastUser?.content ?? "(created via chat)",
      sourceType: "chat",
    })
    .returning();
  return meeting.id;
}

function buildContext(
  ds: (typeof decisions.$inferSelect)[],
  qs: (typeof openQuestions.$inferSelect)[]
): string {
  const decisionLines =
    ds.length > 0
      ? ds
          .map(
            (d) =>
              `- [${d.status}] ${d.text}${d.owner ? ` (owner: ${d.owner})` : ""}${
                d.deadline ? ` (deadline: ${d.deadline})` : ""
              }`
          )
          .join("\n")
      : "(none)";

  const questionLines =
    qs.length > 0
      ? qs.map((q) => `- ${q.text}${q.owner ? ` (owner: ${q.owner})` : ""}`).join("\n")
      : "(none)";

  return `DECISIONS:\n${decisionLines}\n\nOPEN QUESTIONS:\n${questionLines}`;
}
