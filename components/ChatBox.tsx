"use client";

import { useRef, useState } from "react";

type Turn = { role: "user" | "assistant"; content: string };

export function ChatBox() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    const question = input.trim();
    if (!question || streaming) return;

    setInput("");
    setTurns((t) => [...t, { role: "user", content: question }]);
    setStreaming(true);

    // Placeholder assistant turn we stream into.
    setTurns((t) => [...t, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });

      if (!res.ok || !res.body) {
        const msg = await res.text();
        appendToLast(msg || "Error contacting the model.");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        appendToLast(decoder.decode(value, { stream: true }));
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
      }
    } catch {
      appendToLast("\n\n[Network error.]");
    } finally {
      setStreaming(false);
    }
  }

  function appendToLast(chunk: string) {
    setTurns((t) => {
      const copy = [...t];
      const last = copy[copy.length - 1];
      if (last && last.role === "assistant") {
        copy[copy.length - 1] = { ...last, content: last.content + chunk };
      }
      return copy;
    });
  }

  return (
    <div
      className="flex flex-col rounded-xl border"
      style={{ background: "var(--surface)" }}
    >
      <h2
        className="border-b px-4 py-3 text-sm font-semibold uppercase tracking-wide"
        style={{ color: "var(--muted)" }}
      >
        Ask your second brain
      </h2>

      <div
        ref={scrollRef}
        className="max-h-72 min-h-[6rem] space-y-3 overflow-y-auto px-4 py-3"
      >
        {turns.length === 0 && (
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Ask about decisions, owners, deadlines, or open threads across your
            meetings.
          </p>
        )}
        {turns.map((t, i) => (
          <div key={i} className={t.role === "user" ? "text-right" : ""}>
            <span
              className="inline-block max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm"
              style={{
                background:
                  t.role === "user" ? "var(--accent)" : "var(--surface-2)",
                color: t.role === "user" ? "#0b0d12" : "var(--text)",
              }}
            >
              {t.content || (streaming ? "…" : "")}
            </span>
          </div>
        ))}
      </div>

      <form onSubmit={ask} className="flex gap-2 border-t p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. What did we decide about the launch date?"
          className="flex-1 rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        />
        <button
          type="submit"
          disabled={streaming || !input.trim()}
          className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
          style={{ background: "var(--accent)", color: "#0b0d12" }}
        >
          {streaming ? "…" : "Ask"}
        </button>
      </form>
    </div>
  );
}
