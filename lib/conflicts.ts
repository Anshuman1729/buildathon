import { GROQ_MODEL, extractJson, getGroq } from "./groq";
import type { Decision } from "./db/schema";

export type Contradiction = {
  decisionAId: number;
  decisionBId: number;
  reason: string;
};

type RawContradiction = {
  decision_a_id: number;
  decision_b_id: number;
  reason: string;
};

const SYSTEM_PROMPT = `You review a list of decisions made across meetings and flag pairs that CONTRADICT each other
(e.g. two decisions that can't both be true, or a later decision that reverses an earlier one).
Return ONLY a JSON object:
{ "contradictions": [ { "decision_a_id": <id>, "decision_b_id": <id>, "reason": "one sentence why they conflict" } ] }
Rules:
- Only flag genuine contradictions, not merely related or sequential decisions.
- Use the numeric ids exactly as given. a_id should be the earlier/lower id.
- If there are no contradictions, return { "contradictions": [] }.
- Respond with JSON only.`;

/** Ask the model which stored decisions contradict each other. */
export async function findContradictions(
  decisions: Decision[]
): Promise<Contradiction[]> {
  if (decisions.length < 2) return [];

  const groq = getGroq();
  const list = decisions
    .map(
      (d) =>
        `id=${d.id} | ${d.text}${d.owner ? ` (owner: ${d.owner})` : ""}${
          d.deadline ? ` (deadline: ${d.deadline})` : ""
        }`
    )
    .join("\n");

  const completion = await groq.chat.completions.create({
    model: GROQ_MODEL,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Decisions:\n${list}` },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "";
  const parsed = extractJson<{ contradictions?: RawContradiction[] }>(raw, {
    contradictions: [],
  });

  const validIds = new Set(decisions.map((d) => d.id));
  const seen = new Set<string>();

  return (parsed.contradictions ?? [])
    .map((c) => {
      const a = Number(c.decision_a_id);
      const b = Number(c.decision_b_id);
      if (!validIds.has(a) || !validIds.has(b) || a === b) return null;
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      const key = `${lo}-${hi}`;
      if (seen.has(key)) return null;
      seen.add(key);
      return {
        decisionAId: lo,
        decisionBId: hi,
        reason:
          typeof c.reason === "string" && c.reason.trim()
            ? c.reason.trim()
            : "These decisions appear to conflict.",
      } satisfies Contradiction;
    })
    .filter((c): c is Contradiction => c !== null);
}
