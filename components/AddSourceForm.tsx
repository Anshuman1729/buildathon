"use client";

import { useState } from "react";
import type { SourceType } from "@/lib/types";

const TABS: { type: SourceType; label: string; placeholder: string }[] = [
  {
    type: "meeting",
    label: "Meeting",
    placeholder: "Paste raw meeting transcript here…",
  },
  {
    type: "slack",
    label: "Slack",
    placeholder:
      "Paste a Slack conversation export, e.g.:\n\nAlice  10:03 AM\nok let's just ship the dashboard update friday\n\nBob  10:04 AM\nsounds good, I'll own the rollout",
  },
  {
    type: "email",
    label: "Email",
    placeholder:
      "Paste a raw email thread (subject, sender, body — including any quoted replies)…",
  },
];

export function AddSourceForm({ onAdded }: { onAdded: () => void }) {
  const [tab, setTab] = useState<SourceType>("meeting");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  const activeTab = TABS.find((t) => t.type === tab)!;

  function switchTab(type: SourceType) {
    setTab(type);
    setError(null);
    setSummary(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || loading) return;
    setLoading(true);
    setError(null);
    setSummary(null);
    try {
      // Client-side safety net: the server-side Groq call has its own
      // timeout, but this ensures the button never sits on "Extracting…"
      // forever if something upstream still misbehaves.
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45_000);
      const res = await fetch("/api/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceType: tab, title, text }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
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
      setText("");
      onAdded();
    } catch (err) {
      setError(
        err instanceof DOMException && err.name === "AbortError"
          ? "Request timed out. The extraction service may be slow or unreachable — try again."
          : "Network error. Is the dev server running?"
      );
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
      <h2
        className="mb-3 text-sm font-semibold uppercase tracking-wide"
        style={{ color: "var(--muted)" }}
      >
        Add source
      </h2>

      <div className="mb-3 flex gap-1">
        {TABS.map((t) => (
          <button
            key={t.type}
            type="button"
            onClick={() => switchTab(t.type)}
            className="rounded-lg px-3 py-1.5 text-xs font-medium"
            style={
              tab === t.type
                ? { background: "var(--accent)", color: "#0b0d12" }
                : { background: "var(--surface-2)", color: "var(--muted)" }
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={`${activeTab.label} title (optional)`}
        className="mb-2 w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
      />
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={activeTab.placeholder}
        rows={8}
        className="w-full resize-y rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
      />
      <div className="mt-3 flex items-center gap-3">
        <button
          type="submit"
          disabled={loading || !text.trim()}
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
