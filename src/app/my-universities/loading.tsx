import { Container } from '@/shared/ui';

/**
 * Skeleton for the saved list. Mirrors the row geometry the page settles into
 * (cover + card, three of them) so the layout does not jump on load.
 *
 * Deliberately without the TopNav/Footer chrome: those are static and the real
 * page paints them from the same primitives, so repeating them here would only
 * add a flash of a second header.
 */
export default function Loading() {
  return (
    <main className="gb-page-full-bleed gb-has-mobile-header min-h-screen bg-surface py-gb-6xl">
      <Container className="flex flex-col gap-gb-6xl">
        <div className="flex flex-col gap-gb-lg">
          <div className="h-gb-5xl w-[240px] animate-pulse rounded-gb-md bg-surface-muted" />
          <div className="h-gb-4xl w-full max-w-gb-width-xl animate-pulse rounded-gb-md bg-surface-muted" />
        </div>
        <div className="flex flex-col gap-gb-5xl">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-wrap items-center gap-gb-lg lg:gap-gb-3xl">
              <div className="size-gb-4xl shrink-0 animate-pulse rounded-gb-sm bg-surface-muted" />
              <div className="aspect-[260/188] w-full animate-pulse rounded-gb-2xl bg-surface-muted lg:h-[188px] lg:w-[260px] lg:shrink-0" />
              <div className="h-[188px] w-full animate-pulse rounded-gb-2xl bg-surface-muted lg:min-w-0 lg:flex-1" />
            </div>
          ))}
        </div>
      </Container>
    </main>
  );
}
