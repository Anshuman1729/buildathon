"use client";

import { useState } from "react";
import type { DecisionRow } from "@/lib/types";
import { SourceBadge } from "./SourceBadge";
import { Card } from "./Card";
import { statusColor } from "@/lib/ui";

function fmtDay(ts: string | number): string {
  const d = new Date(typeof ts === "string" ? Number(ts) || ts : ts);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtTime(ts: string | number): string {
  const d = new Date(typeof ts === "string" ? Number(ts) || ts : ts);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function DecisionTimeline({
  decisions,
  onStatusChange,
}: {
  decisions: DecisionRow[];
  onStatusChange?: () => void;
}) {
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);

  async function markDone(id: number) {
    setUpdatingId(id);
    try {
      await fetch(`/api/decisions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "done" }),
      });
      onStatusChange?.();
    } finally {
      setUpdatingId(null);
    }
  }

  async function deleteDecision(id: number) {
    if (confirmingId !== id) {
      setConfirmingId(id);
      return;
    }
    setConfirmingId(null);
    setUpdatingId(id);
    try {
      await fetch(`/api/decisions/${id}`, { method: "DELETE" });
      onStatusChange?.();
    } finally {
      setUpdatingId(null);
    }
  }

  if (decisions.length === 0) {
    return (
      <Card className="text-sm" >
        <span style={{ color: "var(--muted)" }}>
          No decisions match. Add a source or clear filters to see your team&apos;s memory.
        </span>
      </Card>
    );
  }

  // Group by day (already sorted newest-first from the API).
  const groups: { day: string; items: DecisionRow[] }[] = [];
  for (const d of decisions) {
    const day = fmtDay(d.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(d);
    else groups.push({ day, items: [d] });
  }

  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <div key={g.day}>
          <div
            className="mb-2 text-xs font-semibold uppercase tracking-wide"
            style={{ color: "var(--muted)" }}
          >
            {g.day}
          </div>
          <div className="space-y-2">
            {g.items.map((d) => (
              <Card key={d.id}>
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm leading-relaxed">{d.text}</p>
                  <div className="flex shrink-0 items-center gap-2">
                    {d.category && (
                      <span
                        className="rounded-full border px-2 py-0.5 text-[11px]"
                        style={{ color: "var(--muted)" }}
                      >
                        {d.category}
                      </span>
                    )}
                    <SourceBadge sourceType={d.sourceType} />
                    <span
                      className="rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase"
                      style={{
                        color: statusColor[d.status] ?? "var(--muted)",
                        border: `1px solid ${statusColor[d.status] ?? "var(--border)"}`,
                      }}
                    >
                      {d.status}
                    </span>
                  </div>
                </div>
                <div
                  className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs"
                  style={{ color: "var(--muted)" }}
                >
                  <span>👤 {d.owner ?? "Unassigned"}</span>
                  <span>📅 {d.deadline ?? "No deadline"}</span>
                  <span>🗂 {d.sourceLabel ?? `Source #${d.sourceMeeting}`}</span>
                  <span>🕑 {fmtTime(d.createdAt)}</span>
                  <div className="ml-auto flex items-center gap-2">
                    {d.status !== "done" && (
                      <button
                        onClick={() => markDone(d.id)}
                        disabled={updatingId === d.id}
                        className="rounded-full border px-2 py-0.5 text-[11px] font-medium disabled:opacity-50"
                        style={{ color: "var(--accent)" }}
                      >
                        {updatingId === d.id ? "Marking…" : "Mark done"}
                      </button>
                    )}
                    {confirmingId === d.id && (
                      <button
                        onClick={() => setConfirmingId(null)}
                        className="rounded-full border px-2 py-0.5 text-[11px] font-medium"
                        style={{ color: "var(--muted)" }}
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      onClick={() => deleteDecision(d.id)}
                      disabled={updatingId === d.id}
                      className="rounded-full border px-2 py-0.5 text-[11px] font-medium disabled:opacity-50"
                      style={{
                        color: "var(--danger)",
                        borderColor: confirmingId === d.id ? "var(--danger)" : undefined,
                      }}
                    >
                      {updatingId === d.id
                        ? "Deleting…"
                        : confirmingId === d.id
                          ? "Confirm delete?"
                          : "Delete"}
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
