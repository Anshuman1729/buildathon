// Shared display constants used by DecisionTimeline, ConflictsPanel, and GanttView
// so status/source styling stays consistent across views.

export const statusColor: Record<string, string> = {
  open: "var(--accent)",
  done: "var(--success)",
  stale: "var(--warning)",
};

export const sourceMeta: Record<
  string,
  { icon: string; label: string }
> = {
  meeting: { icon: "🗓️", label: "Meeting" },
  slack: { icon: "💬", label: "Slack" },
  email: { icon: "✉️", label: "Email" },
  chat: { icon: "🧠", label: "Chat" },
};

export function getSourceMeta(sourceType: string | null | undefined) {
  return sourceMeta[sourceType ?? ""] ?? { icon: "🗂", label: "Source" };
}
