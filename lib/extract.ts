import { GROQ_MODEL, extractJson, getGroq } from "./groq";

export type SourceType = "meeting" | "slack" | "email";

export const SOURCE_TYPES: SourceType[] = ["meeting", "slack", "email"];

// Fixed set so category is usable as a filter dropdown instead of an
// unbounded pile of model-invented labels.
export const CATEGORIES = [
  "Engineering",
  "Design",
  "Product",
  "Marketing",
  "Sales",
  "Support",
  "Finance",
  "Ops",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export type ExtractedDecision = {
  text: string;
  owner: string | null;
  deadline: string | null;
  sourceSnippet: string | null;
  category: Category;
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

const JSON_SHAPE = `Return ONLY a JSON object with this exact shape:
{
  "decisions": [
    {
      "text": "concise statement of the decision that was made",
      "owner": "person responsible or null",
      "deadline": "see deadline rule below",
      "source_snippet": "a short verbatim quote from the input that supports this decision, or null if none is clearly identifiable",
      "category": "one of: ${CATEGORIES.join(", ")}"
    }
  ],
  "open_questions": [
    { "text": "an unresolved question or open thread", "owner": "person expected to follow up or null" }
  ]
}`;

const COMMON_RULES = `Rules:
- A "decision" is a concrete choice the group committed to (not a suggestion or discussion point).
- Only include decisions and questions actually present in the input. Do not invent any.
- Use null (not empty string) for "owner" when it is not stated or not identifiable.
- Deadline rule (applies only to the "deadline" field, do not use the general owner/null rule for
  it): if the input states ANY due date or timeframe for a decision (e.g. "Friday", "the 25th", "end
  of month", "next sprint", "Monday"), you MUST resolve it using the "Today's date" given in the
  input — output an ISO date (YYYY-MM-DD) when you can confidently resolve one (e.g. "Friday" -> the
  date of the next occurring Friday on/after today's date; "end of month" -> the last day of today's
  month). If you genuinely cannot resolve a specific date, output the phrase exactly as written (e.g.
  "end of month") instead of guessing — never output null just because you can't produce a clean ISO
  date. Use null for "deadline" ONLY when the input states no due date or timeframe at all for that
  decision.
- Keep each "text" short and self-contained (readable without the original input).
- "source_snippet" must be a verbatim substring copied from the input, never paraphrased. Prefer the
  shortest snippet that clearly supports the decision. Use null if you can't point to one.
- "category" must be exactly one of: ${CATEGORIES.join(", ")} — classify each decision into whichever
  fits best based on its subject matter. Use "Other" if none clearly fits. Never invent a category
  outside this list.
- Respond with JSON only. No prose, no markdown.`;

const SYSTEM_PROMPTS: Record<SourceType, string> = {
  meeting: `You extract structured standup/meeting memory from raw meeting transcripts.
${JSON_SHAPE}
${COMMON_RULES}`,

  slack: `You extract structured decisions and open threads from a pasted Slack conversation export.
Slack messages are short, informal, and often imply a decision without stating it formally (e.g.
"ok let's just go with option B", "yeah I'll handle the migration by fri" — these count as decisions).
Messages typically look like:
Username  HH:MM AM
message text
Username  HH:MM AM
message text
${JSON_SHAPE}
${COMMON_RULES}
- Treat casual agreement/commitment language ("sounds good", "I'll do it", "let's ship it") as a
  decision when it resolves something the channel was discussing — don't require formal phrasing.
- The "owner" is usually the Slack username who committed to the action, not who wrote the message
  reporting on it.`,

  email: `You extract structured decisions and open threads from a pasted email thread (subject line,
sender(s), and body text, possibly including multiple replies quoted below each other).
${JSON_SHAPE}
${COMMON_RULES}
- Use the subject line and sender names to disambiguate who owns what when the body doesn't repeat a
  name explicitly.
- If the thread has multiple replies, later replies may confirm, change, or override earlier ones —
  prefer the most recent stated decision on a given topic.
- Ignore quoted signature blocks, disclaimers, and "On [date], [person] wrote:" quote headers when
  looking for decision text — but they may still be used as source_snippet context if that's where
  the decision was stated.`,
};

/** Send raw source text to Groq and return normalized decisions + open questions. */
export async function extractFromSource(
  sourceType: SourceType,
  rawText: string
): Promise<Extraction> {
  const groq = getGroq();
  const systemPrompt = SYSTEM_PROMPTS[sourceType];

  const completion = await groq.chat.completions.create({
    model: GROQ_MODEL,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Today's date: ${new Date().toISOString().slice(0, 10)}\n\nInput:\n\n${rawText}`,
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
      const rec = d as Record<string, unknown>;
      const text = str(rec?.text);
      if (!text) return null;
      const rawCategory = str(rec?.category);
      const category = (
        rawCategory && (CATEGORIES as readonly string[]).includes(rawCategory)
          ? rawCategory
          : "Other"
      ) as Category;
      return {
        text,
        owner: str(rec?.owner),
        deadline: str(rec?.deadline),
        sourceSnippet: str(rec?.source_snippet),
        category,
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
