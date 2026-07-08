"use client";

import { useState } from "react";

export function AddMeetingForm({ onAdded }: { onAdded: () => void }) {
  const [title, setTitle] = useState("");
  const [transcript, setTranscript] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!transcript.trim() || loading) return;
    setLoading(true);
    setError(null);
    setSummary(null);
    try {
      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, transcript }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      const d = data.decisions?.length ?? 0;
      const q = data.openQuestions?.length ?? 0;
      setSummary(
        `Saved "${data.meeting.title}" — extracted ${d} decision${
          d === 1 ? "" : "s"
        } and ${q} open question${q === 1 ? "" : "s"}.`
      );
      setTitle("");
      setTranscript("");
      onAdded();
    } catch {
      setError("Network error. Is the dev server running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-xl border p-4"
      style={{ background: "var(--surface)" }}
    >
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
        Add meeting
      </h2>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Meeting title (optional)"
        className="mb-2 w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
      />
      <textarea
        value={transcript}
        onChange={(e) => setTranscript(e.target.value)}
        placeholder="Paste raw meeting transcript here…"
        rows={8}
        className="w-full resize-y rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
      />
      <div className="mt-3 flex items-center gap-3">
        <button
          type="submit"
          disabled={loading || !transcript.trim()}
          className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          style={{ background: "var(--accent)", color: "#0b0d12" }}
        >
          {loading ? "Extracting…" : "Extract & save"}
        </button>
        {summary && (
          <span className="text-sm" style={{ color: "#7ee2b8" }}>
            {summary}
          </span>
        )}
        {error && (
          <span className="text-sm" style={{ color: "#ff8b8b" }}>
            {error}
          </span>
        )}
      </div>
    </form>
  );
}
