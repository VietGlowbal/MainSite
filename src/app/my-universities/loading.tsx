export default function Loading() {
  return (
    <main className="min-h-screen bg-transparent px-4 py-8 text-slate-800 md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="space-y-2">
          <div className="h-6 w-32 rounded-full bg-slate-100 animate-pulse" />
          <div className="h-10 w-72 rounded-xl bg-slate-100 animate-pulse" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="glow-card space-y-3 animate-pulse">
              <div className="h-4 w-20 rounded bg-slate-100" />
              <div className="h-6 w-40 rounded bg-slate-100" />
              <div className="h-3 w-full rounded bg-slate-100" />
              <div className="h-3 w-full rounded bg-slate-100" />
              <div className="h-8 w-full rounded-xl bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
