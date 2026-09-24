/**
 * Streaming shell for the whole `/ai-strategy/[applicationId]` workspace —
 * matching report, strategy report, planner, CV steps, statement, final check.
 *
 * Before this file, none of the 27 `/ai-strategy/*` routes had a `loading.tsx`
 * or a single `<Suspense>`, so nothing was paintable until every server await
 * had resolved: auth, then the entitlement gate, then the page's own report
 * query. That is the whole reason this cluster sat at RES 40–68 while TTFB was
 * 0.27s. See `docs/performance.md`.
 *
 * ⚠️ THE BOUNDARY IS AT THIS SEGMENT, NOT AT `/ai-strategy`, AND THAT IS
 * DELIBERATE. Next wraps a segment's `loading.tsx` around the *children* of
 * that segment's layout, so putting it here means `layout.tsx` — which checks
 * the session and the GlowBal Plus entitlement — still runs to completion
 * server-side before anything flushes. A boundary one level up at
 * `/ai-strategy` would have flushed first and demoted the paywall's
 * `redirect('/plus?application=…')` into a client-side bounce, so a student
 * without Plus would watch a skeleton of a page they are not entitled to
 * before being sent away. Do not move this file up.
 *
 * Because the layout has already rendered by the time this shows, the header,
 * footer and the rose `ApplicationNav` band are all real and on screen — this
 * skeleton only stands in for the content inside `ReflectionChrome`'s
 * `max-w-5xl` Container. Nothing above it can move, so the swap costs no
 * layout shift.
 *
 * Shape is deliberately generic: nineteen pages share this boundary and they do
 * not share a layout beyond "heading, some prose, a few stacked cards". A
 * skeleton that mimicked one of them would misrepresent the other eighteen —
 * the failure mode `/profile/loading.tsx` warns about, where the swap reads as
 * a second navigation instead of content arriving.
 */
function Bar({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-gb-md bg-surface-muted ${className}`} />;
}

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="flex flex-col gap-gb-4xl">
      {/* Page heading + standfirst */}
      <div className="flex flex-col gap-gb-lg">
        <Bar className="h-gb-5xl w-3/5 max-w-[420px]" />
        <Bar className="h-gb-xl w-full max-w-[560px]" />
      </div>

      {/* Stacked content cards — the common shape across the reports, the
          planner's step list and the CV steps. */}
      {Array.from({ length: 3 }).map((_, card) => (
        <div key={card} className="flex flex-col gap-gb-xl rounded-gb-xl border border-line p-gb-3xl">
          <Bar className="h-gb-2xl w-2/5" />
          <div className="flex flex-col gap-gb-md">
            <Bar className="h-gb-md w-full" />
            <Bar className="h-gb-md w-11/12" />
            <Bar className="h-gb-md w-4/5" />
          </div>
        </div>
      ))}
    </div>
  );
}
