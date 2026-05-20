/**
 * GLOWBAL — universities/search loading state.
 *
 * Branded skeleton that mirrors the actual page layout (sticky search,
 * filter sidebar, university grid) so the perceived load feels instant.
 * The pulses use the GLOWBAL pink/aqua gradient instead of slate so the
 * loading state still reads as part of the brand.
 */
export default function Loading() {
  return (
    <main className="min-h-screen bg-transparent text-slate-800">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
        {/* Sticky search hero skeleton */}
        <section className="rounded-[2rem] border border-black/5 bg-white/95 px-6 py-6 shadow-[0_12px_32px_rgba(22,33,62,0.06)] backdrop-blur md:px-8 md:py-7">
          <div className="flex flex-col items-center gap-6 md:flex-row md:items-center">
            {/* Globe placeholder — pink→aqua gradient pulse */}
            <div
              className="shrink-0 h-[140px] w-[140px] rounded-full glowbal-skeleton-shimmer"
              aria-hidden
            />

            <div className="flex-1 w-full space-y-4">
              <div className="h-6 w-3/4 rounded-full glowbal-skeleton" />
              <div className="grid gap-3 lg:grid-cols-[1fr_1fr_180px_auto]">
                <div className="h-11 rounded-full glowbal-skeleton" />
                <div className="h-11 rounded-full glowbal-skeleton" />
                <div className="h-11 rounded-full glowbal-skeleton" />
                <div className="h-11 w-28 rounded-full glowbal-skeleton-cta" />
              </div>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-6 w-24 rounded-full glowbal-skeleton" />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Body skeleton */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr]">
          {/* Sidebar */}
          <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-9 rounded-lg glowbal-skeleton" />
            ))}
            <div className="h-9 rounded-full glowbal-skeleton-cta mt-4" />
          </aside>

          {/* Grid */}
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="h-5 w-32 rounded-full glowbal-skeleton" />
              <div className="h-7 w-24 rounded-full glowbal-skeleton-cta" />
              <div className="h-7 w-20 rounded-full glowbal-skeleton" />
              <div className="h-7 w-20 rounded-full glowbal-skeleton ml-auto" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <article
                  key={i}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_14px_rgba(15,23,42,0.06)]"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <div className="h-32 w-full glowbal-skeleton-shimmer" />
                  <div className="p-4 space-y-3">
                    <div className="-mt-10 h-12 w-12 rounded-full glowbal-skeleton border-4 border-white" />
                    <div className="h-4 w-4/5 rounded-full glowbal-skeleton" />
                    <div className="h-3 w-2/5 rounded-full glowbal-skeleton" />
                    <div className="grid grid-cols-3 gap-1 pt-2 border-t border-slate-100">
                      {[1, 2, 3].map((j) => (
                        <div key={j} className="space-y-1">
                          <div className="h-2 w-3/4 rounded-full glowbal-skeleton" />
                          <div className="h-3 w-1/2 rounded-full glowbal-skeleton" />
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <div className="h-7 flex-1 rounded-full glowbal-skeleton-cta" />
                      <div className="h-7 w-8 rounded-full glowbal-skeleton" />
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
