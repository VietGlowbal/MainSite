/**
 * GLOWBAL — universities/search loading state.
 *
 * Branded skeleton that mirrors the actual page layout (search hero with
 * globe, stats strip, filter sidebar, list-row results, feature strip).
 * The pulses use the GLOWBAL pink/aqua gradient instead of slate so the
 * loading state still reads as part of the brand.
 */
export default function Loading() {
  return (
    <main className="min-h-screen bg-transparent text-slate-800">
      <div className="w-full px-4 py-6 md:px-6 md:py-8">
        {/* Hero skeleton — split layout matching the redesigned hero */}
        <section className="rounded-[2rem] border border-black/5 bg-white px-6 py-7 shadow-[0_12px_32px_rgba(22,33,62,0.06)] md:px-9 md:py-9">
          <div className="grid items-center gap-6 md:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-4">
              <div className="h-10 w-3/4 rounded-full glowbal-skeleton" />
              <div className="h-10 w-2/3 rounded-full glowbal-skeleton" />
              <div className="h-4 w-1/2 rounded-full glowbal-skeleton" />
              {/* Search bar pill */}
              <div className="grid gap-2 rounded-full border border-slate-200 bg-white p-1.5 md:grid-cols-[1.1fr_1fr_1fr_auto]">
                <div className="h-10 rounded-full glowbal-skeleton" />
                <div className="h-10 rounded-full glowbal-skeleton" />
                <div className="h-10 rounded-full glowbal-skeleton" />
                <div className="h-10 w-32 rounded-full glowbal-skeleton-cta" />
              </div>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-7 w-24 rounded-full glowbal-skeleton" />
                ))}
              </div>
            </div>
            <div className="hidden md:flex items-center justify-center">
              <div className="h-[200px] w-[200px] rounded-full glowbal-skeleton-shimmer md:h-[220px] md:w-[220px]" aria-hidden />
            </div>
          </div>
        </section>

        {/* Body skeleton */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr]">
          {/* Sidebar */}
          <aside className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="h-5 w-32 rounded-full glowbal-skeleton" />
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-1.5 border-b border-slate-100 pb-3 last:border-0">
                <div className="h-4 w-3/5 rounded-full glowbal-skeleton" />
                <div className="h-3 w-2/5 rounded-full glowbal-skeleton" />
                {i === 2 || i === 3 || i === 4 ? (
                  <div className="h-1.5 w-full rounded-full glowbal-skeleton mt-2" />
                ) : null}
              </div>
            ))}
            <div className="h-9 rounded-full glowbal-skeleton-cta mt-4" />
          </aside>

          {/* List */}
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="h-5 w-44 rounded-full glowbal-skeleton" />
              <div className="ml-auto flex gap-2">
                <div className="h-7 w-24 rounded-full glowbal-skeleton" />
                <div className="h-7 w-32 rounded-full glowbal-skeleton" />
                <div className="h-7 w-16 rounded-full glowbal-skeleton" />
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <article
                  key={i}
                  className="flex flex-col gap-4 rounded-[1.5rem] border border-slate-200 bg-white p-3 shadow-[0_4px_14px_rgba(15,23,42,0.04)] md:flex-row md:p-4"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <div className="h-44 w-full rounded-[1.25rem] glowbal-skeleton-shimmer md:w-56" />
                  <div className="flex flex-1 flex-col gap-2">
                    <div className="h-5 w-3/5 rounded-full glowbal-skeleton" />
                    <div className="h-3 w-2/5 rounded-full glowbal-skeleton" />
                    <div className="h-3 w-full rounded-full glowbal-skeleton" />
                    <div className="h-3 w-4/5 rounded-full glowbal-skeleton" />
                    <div className="mt-1 flex gap-2">
                      <div className="h-6 w-20 rounded-full glowbal-skeleton" />
                      <div className="h-6 w-24 rounded-full glowbal-skeleton" />
                      <div className="h-6 w-16 rounded-full glowbal-skeleton" />
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col justify-between gap-3 md:w-56 md:border-l md:border-slate-100 md:pl-4">
                    {[1, 2, 3].map((j) => (
                      <div key={j} className="flex items-center justify-between">
                        <div className="h-3 w-20 rounded-full glowbal-skeleton" />
                        <div className="h-3 w-12 rounded-full glowbal-skeleton" />
                      </div>
                    ))}
                    <div className="flex items-center gap-2 pt-2">
                      <div className="h-8 flex-1 rounded-full glowbal-skeleton-cta" />
                      <div className="h-4 w-16 rounded-full glowbal-skeleton" />
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>

        {/* Feature strip skeleton */}
        <section className="mt-8 grid gap-5 rounded-2xl border border-slate-200 bg-white px-6 py-5 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full glowbal-skeleton" />
              <div className="space-y-1.5 flex-1">
                <div className="h-4 w-3/4 rounded-full glowbal-skeleton" />
                <div className="h-3 w-full rounded-full glowbal-skeleton" />
              </div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
