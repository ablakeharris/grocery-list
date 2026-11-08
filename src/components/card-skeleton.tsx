export function CardSkeleton() {
  return (
    <div
      aria-busy
      aria-label="Loading"
      className="animate-pulse rounded-2xl border border-line bg-card p-4 shadow-sm sm:p-6"
    >
      <div className="h-6 w-48 rounded bg-soft" />
      <div className="mt-3 h-4 w-32 rounded bg-soft" />
      <div className="my-4 border-t border-line" />
      <div className="h-10 rounded-lg bg-soft" />
      <div className="mt-6 space-y-3">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-8 rounded bg-soft" />
        ))}
      </div>
    </div>
  );
}
