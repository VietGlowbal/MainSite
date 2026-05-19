export default function Loading() {
  return (
    <main className="min-h-screen bg-transparent px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
          <div className="hidden lg:block rounded-2xl border border-slate-100 bg-white p-2 h-72 animate-pulse" />

          <div className="space-y-6 min-w-0">
            <div className="glow-card animate-pulse h-44" />
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="glow-card animate-pulse h-64" />
              <div className="glow-card animate-pulse h-64" />
            </div>
            <div className="glow-card animate-pulse h-72" />
          </div>
        </div>
      </div>
    </main>
  );
}
