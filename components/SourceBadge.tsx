"use client";

import { getSourceMeta } from "@/lib/ui";

export function SourceBadge({
  sourceType,
}: {
  sourceType: string | null | undefined;
}) {
  const meta = getSourceMeta(sourceType);
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]"
      style={{ color: "var(--muted)" }}
      title={meta.label}
    >
      <span aria-hidden>{meta.icon}</span>
      {meta.label}
    </span>
  );
}
