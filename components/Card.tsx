export function Card({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${className}`}
      style={{ background: "var(--surface)" }}
    >
      {children}
    </div>
  );
}
