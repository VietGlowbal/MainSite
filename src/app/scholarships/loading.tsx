export default function Loading() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading scholarships"
      className="min-h-screen bg-surface-muted px-4 pb-12 pt-6 md:px-8 md:pb-16 md:pt-10"
    >
      <div className="mx-auto w-full max-w-7xl space-y-8">
        <div className="h-64 rounded-[28px] glowbal-skeleton-shimmer" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="h-11 rounded-xl glowbal-skeleton" />
          ))}
        </div>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <div key={item} className="h-80 rounded-2xl glowbal-skeleton-shimmer" />
          ))}
        </div>
      </div>
    </main>
  );
}
