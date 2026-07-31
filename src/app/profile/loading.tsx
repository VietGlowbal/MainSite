import { PageLoaderOverlay } from '@/shared/ui';

/**
 * The skeleton mirrors the real layout in profile-client.tsx — dark hero band,
 * then a two-column grid of section cards and a right rail. A skeleton that
 * does not match the page it precedes makes the swap read as a second
 * navigation rather than as content arriving.
 */
export default function Loading() {
  return (
    <main className="min-h-screen bg-transparent px-gb-xl py-gb-3xl md:px-gb-4xl md:py-gb-5xl">
      <div className="mx-auto flex max-w-gb-desktop animate-pulse flex-col gap-gb-4xl">
        <div className="h-64 rounded-gb-2xl bg-surface-inverse-deep md:h-56" />

        <div className="grid gap-gb-4xl lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="grid gap-gb-xl sm:grid-cols-2">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="h-44 rounded-gb-2xl border border-line bg-surface" />
            ))}
          </div>

          <div className="flex flex-col gap-gb-xl">
            <div className="h-72 rounded-gb-2xl border border-line bg-surface" />
            <div className="h-40 rounded-gb-2xl border border-line bg-surface" />
            <div className="h-48 rounded-gb-2xl border border-line bg-surface" />
          </div>
        </div>
      </div>
      <PageLoaderOverlay />
    </main>
  );
}
