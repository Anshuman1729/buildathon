// Shared display constants used by DecisionTimeline, ConflictsPanel, and GanttView
// so status/source styling stays consistent across views.

export const statusColor: Record<string, string> = {
  open: "#6ea8fe",
  done: "#7ee2b8",
  stale: "#f5b971",
};

export const sourceMeta: Record<
  string,
  { icon: string; label: string }
> = {
  meeting: { icon: "🗓️", label: "Meeting" },
  slack: { icon: "💬", label: "Slack" },
  email: { icon: "✉️", label: "Email" },
};

export function getSourceMeta(sourceType: string | null | undefined) {
  return sourceMeta[sourceType ?? ""] ?? { icon: "🗂", label: "Source" };
}
