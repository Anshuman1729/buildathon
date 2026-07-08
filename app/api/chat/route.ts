import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { decisions, openQuestions } from "@/lib/db/schema";
import { GROQ_MODEL, getGroq } from "@/lib/groq";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `You are the "Second Brain" for a team's meetings. Answer the user's question using ONLY the
stored decisions and open questions provided below as context. Cite owners and deadlines when relevant.
If the context does not contain the answer, say so plainly — do not invent facts.
Be concise and direct.`;

export async function POST(req: Request) {
  let body: { question?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON body.", { status: 400 });
  }

  const question = (body.question ?? "").trim();
  if (!question) {
    return new Response("A question is required.", { status: 400 });
  }

  // Pull stored memory as context (small demo dataset — send it all).
  const allDecisions = db
    .select()
    .from(decisions)
    .orderBy(desc(decisions.createdAt))
    .all();
  const allQuestions = db
    .select()
    .from(openQuestions)
    .orderBy(desc(openQuestions.createdAt))
    .all();

  const context = buildContext(allDecisions, allQuestions);

  let groq;
  try {
    groq = getGroq();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Chat unavailable.";
    return new Response(message, { status: 500 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const completion = await groq.chat.completions.create({
          model: GROQ_MODEL,
          temperature: 0.3,
          stream: true,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: `Stored memory:\n${context}\n\nQuestion: ${question}`,
            },
          ],
        });

        for await (const chunk of completion) {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) controller.enqueue(encoder.encode(delta));
        }
      } catch (err) {
        console.error("chat stream failed", err);
        controller.enqueue(
          encoder.encode("\n\n[Error generating answer. Please try again.]")
        );
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
      ? qs
          .map((q) => `- ${q.text}${q.owner ? ` (owner: ${q.owner})` : ""}`)
          .join("\n")
      : "(none)";

  return `DECISIONS:\n${decisionLines}\n\nOPEN QUESTIONS:\n${questionLines}`;
}
