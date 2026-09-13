import { Container } from '@/shared/ui/container';

/**
 * /universities loading state.
 *
 * Mirrors the rebuilt page (Figma 105:8300): hero, search row, chip rows and a
 * 3x3 card grid. Uses `animate-pulse` over token surfaces rather than the old
 * `glowbal-skeleton` legacy class, so nothing here depends on globals.css.
 */
function Bar({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-gb-md bg-surface-muted ${className}`} />;
}

export default function Loading() {
  return (
    <div className="gb-page-full-bleed bg-surface">
      <Container className="flex flex-col gap-gb-4xl py-gb-6xl">
        {/* Hero */}
        <div className="flex flex-col gap-gb-lg">
          <Bar className="h-gb-5xl w-2/3 max-w-[560px]" />
          <Bar className="h-gb-xl w-1/2 max-w-[420px]" />
        </div>

        {/* Search row */}
        <div className="grid gap-gb-lg md:grid-cols-[1fr_1fr_1fr_auto]">
          <Bar className="h-gb-6xl" />
          <Bar className="h-gb-6xl" />
          <Bar className="h-gb-6xl" />
          <Bar className="h-gb-6xl w-full md:w-[156px]" />
        </div>

        {/* Chip rows */}
        <div className="flex flex-wrap gap-gb-md">
          {Array.from({ length: 6 }).map((_, i) => (
            <Bar key={i} className="h-gb-6xl w-[120px]" />
          ))}
        </div>

        {/* Card grid */}
        <div className="grid grid-cols-1 gap-gb-4xl sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="flex flex-col overflow-hidden rounded-gb-xl bg-surface-muted">
              <Bar className="aspect-[386/226] w-full rounded-none" />
              <div className="flex flex-col gap-gb-xl p-gb-xl">
                <Bar className="h-gb-2xl w-3/5" />
                <Bar className="h-gb-md w-full" />
                <Bar className="h-gb-md w-4/5" />
                <Bar className="h-gb-2xl w-1/3 rounded-gb-full" />
                <div className="mt-gb-md flex flex-col gap-gb-md">
                  <Bar className="h-gb-lg w-full" />
                  <Bar className="h-gb-lg w-full" />
                  <Bar className="h-gb-lg w-full" />
                </div>
                <Bar className="mt-gb-md h-gb-5xl w-full" />
              </div>
            </div>
          ))}
        </div>
      </Container>
    </div>
  );
}
