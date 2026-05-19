export default function Loading() {
  return (
    <main className="min-h-screen bg-transparent px-6 py-16 md:px-10">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="space-y-3">
          <div className="h-6 w-32 rounded-full bg-slate-100 animate-pulse" />
          <div className="h-9 w-72 rounded-xl bg-slate-100 animate-pulse" />
          <div className="h-4 w-96 rounded-lg bg-slate-100 animate-pulse" />
        </div>
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <div className="rounded-2xl border border-slate-100 bg-white p-4 space-y-3 animate-pulse">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-8 rounded-lg bg-slate-100" />
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="glow-card space-y-3 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-slate-100" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-24 rounded bg-slate-100" />
                    <div className="h-2.5 w-16 rounded bg-slate-100" />
                  </div>
                </div>
                <div className="h-3 w-full rounded bg-slate-100" />
                <div className="h-8 w-full rounded-xl bg-slate-100" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
