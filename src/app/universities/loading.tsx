export default function Loading() {
  return (
    <main className="min-h-screen bg-transparent px-4 py-8 text-slate-800 md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="space-y-2">
          <div className="h-6 w-32 rounded-full bg-slate-100 animate-pulse" />
          <div className="h-10 w-80 rounded-xl bg-slate-100 animate-pulse" />
          <div className="h-5 w-96 rounded-lg bg-slate-100 animate-pulse" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glow-card space-y-3 animate-pulse">
              <div className="h-4 w-24 rounded bg-slate-100" />
              <div className="h-6 w-48 rounded bg-slate-100" />
              <div className="flex gap-2">
                <div className="h-5 w-16 rounded-full bg-slate-100" />
                <div className="h-5 w-20 rounded-full bg-slate-100" />
              </div>
              <div className="h-8 w-full rounded-xl bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
