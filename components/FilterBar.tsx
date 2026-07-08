"use client";

export type Filters = { owner: string; category: string };

export const ALL = "__all__";
export const UNASSIGNED = "__unassigned__";
export const UNCATEGORIZED = "__uncategorized__";

const selectClass =
  "rounded-lg border bg-transparent px-3 py-1.5 text-sm outline-none focus:border-[var(--accent)]";

export function FilterBar({
  owners,
  categories,
  filters,
  onChange,
  showCategory = true,
}: {
  owners: string[];
  categories: string[];
  filters: Filters;
  onChange: (f: Filters) => void;
  showCategory?: boolean;
}) {
  const active = filters.owner !== ALL || filters.category !== ALL;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={filters.owner}
        onChange={(e) => onChange({ ...filters, owner: e.target.value })}
        className={selectClass}
        aria-label="Filter by owner"
        style={{ background: "var(--surface)", color: "var(--text)" }}
      >
        <option value={ALL}>All owners</option>
        <option value={UNASSIGNED}>Unassigned</option>
        {owners.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>

      {showCategory && (
        <select
          value={filters.category}
          onChange={(e) => onChange({ ...filters, category: e.target.value })}
          className={selectClass}
          aria-label="Filter by category"
          style={{ background: "var(--surface)", color: "var(--text)" }}
        >
          <option value={ALL}>All categories</option>
          <option value={UNCATEGORIZED}>Uncategorized</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      )}

      {active && (
        <button
          onClick={() => onChange({ owner: ALL, category: ALL })}
          className="text-xs underline"
          style={{ color: "var(--muted)" }}
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

export function applyFilters<
  T extends { owner: string | null; category?: string | null }
>(items: T[], filters: Filters): T[] {
  return items.filter((item) => {
    if (filters.owner !== ALL) {
      if (filters.owner === UNASSIGNED ? item.owner !== null : item.owner !== filters.owner) {
        return false;
      }
    }
    if (filters.category !== ALL) {
      const category = item.category ?? null;
      if (filters.category === UNCATEGORIZED ? category !== null : category !== filters.category) {
        return false;
      }
    }
    return true;
  });
}
