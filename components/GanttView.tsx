"use client";

import { useMemo, useState } from "react";
import type { DecisionRow } from "@/lib/types";
import { statusColor } from "@/lib/ui";
import { SourceBadge } from "./SourceBadge";

type GanttItem = {
  decision: DecisionRow;
  start: Date;
  end: Date;
};

// createdAt comes from the API as either a numeric epoch or an ISO string
// (same convention DecisionTimeline uses for its own timestamp fields).
function parseTimestamp(v: string | number): Date | null {
  const d = new Date(typeof v === "string" && /^\d+$/.test(v) ? Number(v) : v);
  return Number.isNaN(d.getTime()) ? null : d;
}

// deadline is free-form text from the model (ISO date if possible, else a
// phrase). Never treat it as a bare epoch number — a deadline like "2026"
// would otherwise parse as milliseconds-since-epoch (Jan 1 1970).
function parseDeadline(v: string): Date | null {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function GanttView({
  decisions,
  onStatusChange,
}: {
  decisions: DecisionRow[];
  onStatusChange?: () => void;
}) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [updating, setUpdating] = useState(false);

  async function markDone(id: number) {
    setUpdating(true);
    try {
      await fetch(`/api/decisions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "done" }),
      });
      onStatusChange?.();
    } finally {
      setUpdating(false);
    }
  }

  const { items, excludedCount } = useMemo(() => {
    const parsed: GanttItem[] = [];
    let excluded = 0;

    for (const d of decisions) {
      if (!d.deadline) {
        excluded++;
        continue;
      }
      const deadline = parseDeadline(d.deadline);
      if (!deadline) {
        excluded++;
        continue;
      }
      const created = parseTimestamp(d.createdAt) ?? deadline;
      // Guard against a deadline text that predates creation (e.g. a stale
      // "last Friday" style deadline) by always ordering start <= end.
      const start = created.getTime() <= deadline.getTime() ? created : deadline;
      const end = created.getTime() <= deadline.getTime() ? deadline : created;
      parsed.push({ decision: d, start, end });
    }

    return { items: parsed, excludedCount: excluded };
  }, [decisions]);

  const selected = items.find((i) => i.decision.id === selectedId)?.decision ?? null;

  if (items.length === 0) {
    return (
      <div
        className="rounded-xl border p-6 text-sm"
        style={{ background: "var(--surface)", color: "var(--muted)" }}
      >
        No decisions with a usable deadline yet.
        {excludedCount > 0 &&
          ` (${excludedCount} decision${excludedCount === 1 ? "" : "s"} excluded — no deadline set.)`}
      </div>
    );
  }

  const minTime = Math.min(...items.map((i) => i.start.getTime()));
  const maxTime = Math.max(...items.map((i) => i.end.getTime()));
  const span = Math.max(maxTime - minTime, 1);
  const pct = (t: number) => ((t - minTime) / span) * 100;

  // Group by owner, alphabetical, "Unassigned" last.
  const byOwner = new Map<string, GanttItem[]>();
  for (const item of items) {
    const key = item.decision.owner ?? "Unassigned";
    const list = byOwner.get(key) ?? [];
    list.push(item);
    byOwner.set(key, list);
  }
  const owners = [...byOwner.keys()].sort((a, b) => {
    if (a === "Unassigned") return 1;
    if (b === "Unassigned") return -1;
    return a.localeCompare(b);
  });

  return (
    <div className="space-y-4">
      {excludedCount > 0 && (
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          {excludedCount} decision{excludedCount === 1 ? "" : "s"} excluded — no
          parseable deadline.
        </p>
      )}

      <div
        className="rounded-xl border p-4"
        style={{ background: "var(--surface)" }}
      >
        {/* Time axis labels */}
        <div
          className="mb-2 flex justify-between pl-[140px] text-[11px]"
          style={{ color: "var(--muted)" }}
        >
          <span>{fmtDate(new Date(minTime))}</span>
          <span>{fmtDate(new Date(maxTime))}</span>
        </div>

        <div className="space-y-3">
          {owners.map((owner) => (
            <div key={owner} className="flex items-center gap-3">
              <div
                className="w-[140px] shrink-0 truncate text-xs font-medium"
                title={owner}
              >
                👤 {owner}
              </div>
              <div
                className="relative h-7 flex-1 rounded-md"
                style={{ background: "var(--surface-2)" }}
              >
                {byOwner.get(owner)!.map((item) => {
                  const left = pct(item.start.getTime());
                  const width = Math.max(
                    pct(item.end.getTime()) - left,
                    1.5
                  );
                  const color =
                    statusColor[item.decision.status] ?? "var(--muted)";
                  const isSelected = item.decision.id === selectedId;
                  return (
                    <button
                      key={item.decision.id}
                      onClick={() =>
                        setSelectedId(isSelected ? null : item.decision.id)
                      }
                      title={item.decision.text}
                      className="absolute top-1 h-5 rounded-sm text-left transition-[filter]"
                      style={{
                        left: `${left}%`,
                        width: `${width}%`,
                        background: color,
                        outline: isSelected ? "2px solid var(--text)" : "none",
                        outlineOffset: 1,
                      }}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {selected && (
        <div
          className="rounded-xl border p-4"
          style={{ background: "var(--surface)" }}
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm leading-relaxed">{selected.text}</p>
            <div className="flex shrink-0 items-center gap-2">
              <SourceBadge sourceType={selected.sourceType} />
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase"
                style={{
                  color: statusColor[selected.status] ?? "var(--muted)",
                  border: `1px solid ${statusColor[selected.status] ?? "var(--border)"}`,
                }}
              >
                {selected.status}
              </span>
            </div>
          </div>
          <div
            className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs"
            style={{ color: "var(--muted)" }}
          >
            <span>👤 {selected.owner ?? "Unassigned"}</span>
            <span>📅 {selected.deadline}</span>
            <span>🗂 {selected.sourceLabel ?? `Source #${selected.sourceMeeting}`}</span>
            {selected.status !== "done" && (
              <button
                onClick={() => markDone(selected.id)}
                disabled={updating}
                className="ml-auto rounded-full border px-2 py-0.5 text-[11px] font-medium disabled:opacity-50"
                style={{ color: "var(--accent)" }}
              >
                {updating ? "Marking…" : "Mark done"}
              </button>
            )}
          </div>
          <div
            className="mt-3 rounded-lg border p-3 text-xs italic"
            style={{ background: "var(--surface-2)", color: "var(--muted)" }}
          >
            {selected.sourceSnippet
              ? `“${selected.sourceSnippet}”`
              : "No source snippet was captured for this decision."}
          </div>
        </div>
      )}
    </div>
  );
}
