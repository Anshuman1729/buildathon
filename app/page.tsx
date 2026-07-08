"use client";

import { useCallback, useEffect, useState } from "react";
import { AddSourceForm } from "@/components/AddSourceForm";
import { ChatBox } from "@/components/ChatBox";
import { ConflictsPanel } from "@/components/ConflictsPanel";
import { DecisionTimeline } from "@/components/DecisionTimeline";
import { GanttView } from "@/components/GanttView";
import type { DecisionsResponse, DecisionRow, QuestionRow } from "@/lib/types";

type ViewTab = "timeline" | "gantt";

export default function Home() {
  const [decisions, setDecisions] = useState<DecisionRow[]>([]);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewTab>("timeline");

  const loadDecisions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/decisions");
      const json: DecisionsResponse = await res.json();
      setDecisions(json.decisions ?? []);
      setQuestions(json.openQuestions ?? []);
    } catch {
      // leave existing state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDecisions();
  }, [loadDecisions]);

  const handleAdded = useCallback(() => {
    loadDecisions();
    setRefreshKey((k) => k + 1); // re-run conflicts check
  }, [loadDecisions]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold">🧠 Second Brain Standup</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          Queryable memory of decisions, owners, and open threads across your
          meetings, Slack channels, and email threads.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Left column: add source + timeline/gantt */}
        <div className="space-y-6">
          <AddSourceForm onAdded={handleAdded} />

          <section>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex gap-1">
                <button
                  onClick={() => setView("timeline")}
                  className="rounded-lg px-3 py-1.5 text-sm font-semibold"
                  style={
                    view === "timeline"
                      ? { background: "var(--accent)", color: "#0b0d12" }
                      : { color: "var(--muted)" }
                  }
                >
                  Timeline
                </button>
                <button
                  onClick={() => setView("gantt")}
                  className="rounded-lg px-3 py-1.5 text-sm font-semibold"
                  style={
                    view === "gantt"
                      ? { background: "var(--accent)", color: "#0b0d12" }
                      : { color: "var(--muted)" }
                  }
                >
                  Gantt
                </button>
              </div>
              <span className="text-xs" style={{ color: "var(--muted)" }}>
                {loading ? "Loading…" : `${decisions.length} total`}
              </span>
            </div>
            {view === "timeline" ? (
              <DecisionTimeline decisions={decisions} />
            ) : (
              <GanttView decisions={decisions} />
            )}
          </section>

          {questions.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-semibold">Open questions</h2>
              <div className="space-y-2">
                {questions.map((q) => (
                  <div
                    key={q.id}
                    className="rounded-xl border p-3 text-sm"
                    style={{ background: "var(--surface)" }}
                  >
                    <p>{q.text}</p>
                    <p
                      className="mt-1 text-xs"
                      style={{ color: "var(--muted)" }}
                    >
                      {q.owner ?? "Unassigned"} ·{" "}
                      {q.sourceLabel ?? "unknown source"}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Right column: conflicts + chat */}
        <aside className="space-y-6">
          <ConflictsPanel refreshKey={refreshKey} />
          <ChatBox />
        </aside>
      </div>
    </main>
  );
}
