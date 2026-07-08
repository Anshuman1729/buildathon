import Groq from "groq-sdk";

export const GROQ_MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";

let client: Groq | null = null;

/**
 * Lazily construct the Groq client so a missing key fails at request time with a
 * clear message rather than at import/build time.
 */
export function getGroq(): Groq {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY is not set. Add it to .env.local (get a free key at https://console.groq.com/keys)."
    );
  }
  if (!client) {
    // Explicit timeout so a slow/hanging network call fails with a clear
    // error instead of hanging until the platform's own request timeout
    // (e.g. Vercel's function execution limit), which just looks like the
    // UI being permanently stuck with no diagnostic information.
    client = new Groq({ apiKey, timeout: 25_000, maxRetries: 1 });
  }
  return client;
}

/**
 * Best-effort extraction of a JSON object from an LLM response. Open models
 * don't guarantee schema, so we strip code fences, slice the outermost braces,
 * and fall back to a caller-supplied default instead of throwing.
 */
export function extractJson<T>(raw: string, fallback: T): T {
  if (!raw) return fallback;
  let text = raw.trim();

  // Strip ```json ... ``` or ``` ... ``` fences.
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) text = fenceMatch[1].trim();

  // Slice from first { to last } (objects) — the schemas we ask for are objects.
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    text = text.slice(first, last + 1);
  }

  try {
    return JSON.parse(text) as T;
  } catch (err) {
    console.error("extractJson: failed to parse model output", err, raw);
    return fallback;
  }
}
