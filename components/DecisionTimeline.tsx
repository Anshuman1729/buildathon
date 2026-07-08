"use client";

import { useState } from "react";
import type { DecisionRow } from "@/lib/types";
import { SourceBadge } from "./SourceBadge";
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

  if (decisions.length === 0) {
    return (
      <div
        className="rounded-xl border p-6 text-sm"
        style={{ background: "var(--surface)", color: "var(--muted)" }}
      >
        No decisions yet. Add a source to start building your team&apos;s memory.
      </div>
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
              <div
                key={d.id}
                className="rounded-xl border p-4"
                style={{ background: "var(--surface)" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm leading-relaxed">{d.text}</p>
                  <div className="flex shrink-0 items-center gap-2">
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
                  {d.status !== "done" && (
                    <button
                      onClick={() => markDone(d.id)}
                      disabled={updatingId === d.id}
                      className="ml-auto rounded-full border px-2 py-0.5 text-[11px] font-medium disabled:opacity-50"
                      style={{ color: "var(--accent)" }}
                    >
                      {updatingId === d.id ? "Marking…" : "Mark done"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
