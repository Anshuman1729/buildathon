"use client";

import { useCallback, useEffect, useState } from "react";
import type { ConflictsResponse } from "@/lib/types";

export function ConflictsPanel({ refreshKey }: { refreshKey: number }) {
  const [data, setData] = useState<ConflictsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/conflicts");
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to run checks.");
        return;
      }
      setData(json);
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  return (
    <div
      className="rounded-xl border p-4"
      style={{ background: "var(--surface)" }}
    >
      <div className="mb-3 flex items-center justify-between">
        <h2
          className="text-sm font-semibold uppercase tracking-wide"
          style={{ color: "var(--muted)" }}
        >
          Conflicts &amp; stale
        </h2>
        <button
          onClick={load}
          className="text-xs underline"
          style={{ color: "var(--muted)" }}
        >
          {loading ? "Checking…" : "Re-check"}
        </button>
      </div>

      {error && (
        <p className="text-sm" style={{ color: "#ff8b8b" }}>
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
              <p className="mb-2 text-xs" style={{ color: "#ff8b8b" }}>
                {data.contradictionError}
              </p>
            )}
            {data.contradictions.map((c, i) => (
              <div
                key={i}
                className="rounded-lg border p-3"
                style={{ background: "var(--surface-2)" }}
              >
                <p className="mb-2 text-xs" style={{ color: "#f5b971" }}>
                  {c.reason}
                </p>
                <p className="text-xs" style={{ color: "var(--muted)" }}>
                  <b>A:</b> {c.a?.text ?? "—"}
                </p>
                <p className="text-xs" style={{ color: "var(--muted)" }}>
                  <b>B:</b> {c.b?.text ?? "—"}
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
                <p>{s.text}</p>
                <p className="mt-1" style={{ color: "var(--muted)" }}>
                  {s.owner ?? "Unassigned"} · {s.deadline ?? "no deadline"}
                </p>
              </div>
            ))}
          </Section>
        </div>
      )}
    </div>
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
