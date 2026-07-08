"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AddSourceForm } from "@/components/AddSourceForm";
import { ChatBox } from "@/components/ChatBox";
import { ConflictsPanel } from "@/components/ConflictsPanel";
import { DecisionTimeline } from "@/components/DecisionTimeline";
import { GanttView } from "@/components/GanttView";
import { Modal } from "@/components/Modal";
import { FilterBar, applyFilters, ALL, type Filters } from "@/components/FilterBar";
import { CATEGORIES } from "@/lib/extract";
import type { DecisionsResponse, DecisionRow, ConflictsResponse } from "@/lib/types";

type Tab = "timeline" | "gantt" | "archive" | "conflicts";

const TABS: { id: Tab; label: string }[] = [
  { id: "timeline", label: "Timeline" },
  { id: "gantt", label: "Gantt" },
  { id: "archive", label: "Archive" },
  { id: "conflicts", label: "Conflicts & stale" },
];

const NO_FILTERS: Filters = { owner: ALL, category: ALL };

export default function Home() {
  const [decisions, setDecisions] = useState<DecisionRow[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("timeline");
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [addOpen, setAddOpen] = useState(false);

  const [conflicts, setConflicts] = useState<ConflictsResponse | null>(null);
  const [conflictsLoading, setConflictsLoading] = useState(true);
  const [conflictsError, setConflictsError] = useState<string | null>(null);

  const loadDecisions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/decisions");
      const json: DecisionsResponse = await res.json();
      setDecisions(json.decisions ?? []);
    } catch {
      // leave existing state
    } finally {
      setLoading(false);
    }
  }, []);

  const loadConflicts = useCallback(async () => {
    setConflictsLoading(true);
    setConflictsError(null);
    try {
      const res = await fetch("/api/conflicts");
      const json = await res.json();
      if (!res.ok) {
        setConflictsError(json.error ?? "Failed to run checks.");
        return;
      }
      setConflicts(json);
    } catch {
      setConflictsError("Network error.");
    } finally {
      setConflictsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDecisions();
  }, [loadDecisions]);

  // Only re-run the (LLM-backed, non-cheap) conflicts check on real data
  // mutations, not on every Conflicts-tab mount/switch — otherwise tab
  // navigation alone re-triggers the contradiction check and produces a
  // different result each time due to model sampling variance.
  useEffect(() => {
    loadConflicts();
  }, [loadConflicts, refreshKey]);

  const handleAdded = useCallback(() => {
    loadDecisions();
    setRefreshKey((k) => k + 1); // re-run conflicts check
  }, [loadDecisions]);

  const owners = useMemo(
    () => [...new Set(decisions.map((d) => d.owner).filter((o): o is string => !!o))].sort(),
    [decisions]
  );

  const activeDecisions = useMemo(
    () => decisions.filter((d) => d.status !== "done"),
    [decisions]
  );
  const doneDecisions = useMemo(
    () => decisions.filter((d) => d.status === "done"),
    [decisions]
  );

  const filteredActive = useMemo(() => applyFilters(activeDecisions, filters), [activeDecisions, filters]);
  const filteredArchive = useMemo(() => applyFilters(doneDecisions, filters), [doneDecisions, filters]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">🧠 Second Brain Standup</h1>
          <p className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>
            Queryable memory of decisions, owners, and open threads across your meetings, Slack channels, and email threads.
          </p>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="rounded-lg px-4 py-2 text-sm font-semibold"
          style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
        >
          + Add source
        </button>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <nav className="flex flex-wrap gap-1">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className="rounded-lg px-3 py-1.5 text-sm font-semibold"
                  style={
                    tab === t.id
                      ? { background: "var(--accent)", color: "var(--accent-contrast)" }
                      : { color: "var(--muted)" }
                  }
                >
                  {t.label}
                </button>
              ))}
            </nav>
            <span className="text-xs" style={{ color: "var(--muted)" }}>
              {loading ? "Loading…" : `${activeDecisions.length} active`}
            </span>
          </div>

          {(tab === "timeline" || tab === "gantt" || tab === "archive") && (
            <FilterBar owners={owners} categories={[...CATEGORIES]} filters={filters} onChange={setFilters} />
          )}

          {tab === "timeline" && (
            <DecisionTimeline decisions={filteredActive} onStatusChange={handleAdded} />
          )}
          {tab === "gantt" && (
            <GanttView decisions={filteredActive} onStatusChange={handleAdded} />
          )}
          {tab === "archive" && (
            <DecisionTimeline decisions={filteredArchive} onStatusChange={handleAdded} />
          )}
          {tab === "conflicts" && (
            <ConflictsPanel
              data={conflicts}
              loading={conflictsLoading}
              error={conflictsError}
              onRecheck={loadConflicts}
              onStatusChange={handleAdded}
            />
          )}
        </div>

        {/* Persistent right rail: always visible regardless of active tab */}
        <aside className="min-h-[28rem] lg:sticky lg:top-6 lg:h-[calc(100vh-9rem)]">
          <ChatBox onAdded={handleAdded} />
        </aside>
      </div>

      {addOpen && (
        <Modal title="Add source" onClose={() => setAddOpen(false)}>
          <AddSourceForm onAdded={handleAdded} onClose={() => setAddOpen(false)} />
        </Modal>
      )}
    </main>
  );
}
