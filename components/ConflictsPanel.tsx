"use client";

import { useState } from "react";
import type { ConflictsResponse } from "@/lib/types";
import { SourceBadge } from "./SourceBadge";
import { Card } from "./Card";

export function ConflictsPanel({
  data,
  loading,
  error,
  onRecheck,
  onStatusChange,
}: {
  data: ConflictsResponse | null;
  loading: boolean;
  error: string | null;
  onRecheck: () => void;
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

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h2
          className="text-sm font-semibold uppercase tracking-wide"
          style={{ color: "var(--muted)" }}
        >
          Conflicts &amp; stale
        </h2>
        <button
          onClick={onRecheck}
          className="text-xs underline"
          style={{ color: "var(--muted)" }}
        >
          {loading ? "Checking…" : "Re-check"}
        </button>
      </div>

      {error && (
        <p className="text-sm" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}

      {!error && data && (
        <div className="space-y-4">
          <Section
            title={`⚠️ Contradictions (${data.contradictions.length})`}
            empty="No contradictions detected."
            items={data.contradictions.length}
          >
            {data.contradictionError && (
              <p className="mb-2 text-xs" style={{ color: "var(--danger)" }}>
                {data.contradictionError}
              </p>
            )}
            {data.contradictions.map((c, i) => (
              <div
                key={i}
                className="rounded-lg border p-3"
                style={{ background: "var(--surface-2)" }}
              >
                <p className="mb-2 text-xs" style={{ color: "var(--warning)" }}>
                  {c.reason}
                </p>
                <p className="flex items-center gap-2 text-xs" style={{ color: "var(--muted)" }}>
                  <b>A:</b> {c.a?.text ?? "—"}
                  {c.a && <SourceBadge sourceType={c.a.sourceType} />}
                </p>
                <p className="mt-1 flex items-center gap-2 text-xs" style={{ color: "var(--muted)" }}>
                  <b>B:</b> {c.b?.text ?? "—"}
                  {c.b && <SourceBadge sourceType={c.b.sourceType} />}
                </p>
              </div>
            ))}
          </Section>

          <Section
            title={`⏳ Stale (14+ days, no update) (${data.stale.length})`}
            empty="Nothing stale."
            items={data.stale.length}
          >
            {data.stale.map((s) => (
              <div
                key={s.id}
                className="rounded-lg border p-3 text-xs"
                style={{ background: "var(--surface-2)" }}
              >
                <div className="flex items-start justify-between gap-2">
                  <p>{s.text}</p>
                  <SourceBadge sourceType={s.sourceType} />
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <p style={{ color: "var(--muted)" }}>
                    {s.owner ?? "Unassigned"} · {s.deadline ?? "no deadline"}
                  </p>
                  <button
                    onClick={() => markDone(s.id)}
                    disabled={updatingId === s.id}
                    className="shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium disabled:opacity-50"
                    style={{ color: "var(--accent)" }}
                  >
                    {updatingId === s.id ? "Marking…" : "Mark done"}
                  </button>
                </div>
              </div>
            ))}
          </Section>
        </div>
      )}
    </Card>
  );
}

function Section({
  title,
  empty,
  items,
  children,
}: {
  title: string;
  empty: string;
  items: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold">{title}</h3>
      {items === 0 ? (
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          {empty}
        </p>
      ) : (
        <div className="space-y-2">{children}</div>
      )}
    </div>
  );
}
