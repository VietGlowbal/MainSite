export default function Loading() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading applications"
      className="min-h-screen bg-transparent px-4 py-8 text-slate-800 md:px-8"
    >
      <div className="w-full space-y-6">
        <div className="space-y-2">
          <div className="h-10 w-72 rounded-xl glowbal-skeleton" />
          <div className="h-4 w-96 max-w-full rounded-full glowbal-skeleton" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className="glow-card space-y-3">
              <div className="h-4 w-20 rounded-full glowbal-skeleton" />
              <div className="h-8 w-16 rounded-lg glowbal-skeleton" />
            </div>
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-28 rounded-2xl glowbal-skeleton-shimmer" />
          ))}
        </div>
      </div>
    </main>
  );
}
