import { GROQ_MODEL, extractJson, getGroq } from "./groq";

export type ExtractedDecision = {
  text: string;
  owner: string | null;
  deadline: string | null;
};

export type ExtractedQuestion = {
  text: string;
  owner: string | null;
};

export type Extraction = {
  decisions: ExtractedDecision[];
  open_questions: ExtractedQuestion[];
};

const EMPTY: Extraction = { decisions: [], open_questions: [] };

const SYSTEM_PROMPT = `You extract structured standup/meeting memory from raw transcripts.
Return ONLY a JSON object with this exact shape:
{
  "decisions": [
    { "text": "concise statement of the decision that was made", "owner": "person responsible or null", "deadline": "due date/timeframe as written, ISO date if possible, or null" }
  ],
  "open_questions": [
    { "text": "an unresolved question or open thread", "owner": "person expected to follow up or null" }
  ]
}
Rules:
- A "decision" is a concrete choice the group committed to (not a suggestion or discussion point).
- Only include decisions and questions actually present in the transcript. Do not invent any.
- Use null (not empty string) when an owner or deadline is not stated.
- Keep each "text" short and self-contained (readable without the transcript).
- Respond with JSON only. No prose, no markdown.`;

/** Send a transcript to Groq and return normalized decisions + open questions. */
export async function extractFromTranscript(
  transcript: string
): Promise<Extraction> {
  const groq = getGroq();

  const completion = await groq.chat.completions.create({
    model: GROQ_MODEL,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Transcript:\n\n${transcript}`,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "";
  const parsed = extractJson<Partial<Extraction>>(raw, EMPTY);

  return {
    decisions: normalizeDecisions(parsed.decisions),
    open_questions: normalizeQuestions(parsed.open_questions),
  };
}

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t || t.toLowerCase() === "null" || t.toLowerCase() === "n/a") return null;
  return t;
}

function normalizeDecisions(input: unknown): ExtractedDecision[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((d) => {
      const text = str((d as Record<string, unknown>)?.text);
      if (!text) return null;
      return {
        text,
        owner: str((d as Record<string, unknown>)?.owner),
        deadline: str((d as Record<string, unknown>)?.deadline),
      } satisfies ExtractedDecision;
    })
    .filter((d): d is ExtractedDecision => d !== null);
}

function normalizeQuestions(input: unknown): ExtractedQuestion[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((q) => {
      const text = str((q as Record<string, unknown>)?.text);
      if (!text) return null;
      return {
        text,
        owner: str((q as Record<string, unknown>)?.owner),
      } satisfies ExtractedQuestion;
    })
    .filter((q): q is ExtractedQuestion => q !== null);
}
