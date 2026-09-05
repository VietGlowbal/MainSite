import { GlowbalLogo } from '@/components/glowbal-logo';
import { SiteNavigation } from '@/components/site-navigation';
import {
  FOOTER_COLUMNS,
  FOOTER_COPYRIGHT,
  FOOTER_RATINGS,
  FOOTER_SOCIAL,
  FOOTER_TAGLINE,
} from '@/features/marketing/navigation';
import { Container, Footer } from '@/shared/ui';

/**
 * Streaming shell for `/universities/matches`.
 *
 * This route scored RES 0 in the 2026-09-05 audit and it is not crashing —
 * Vercel reports no runtime errors on it. It is simply the heaviest read in the
 * app: it ranks every university against the student's profile, and until the
 * ranking finished the browser had nothing at all. See docs/performance.md.
 *
 * ⚠️ THIS FILE HAS TO RENDER THE CHROME ITSELF, unlike the `/ai-strategy`
 * skeleton. There is no layout between `src/app/layout.tsx` and this page, and
 * `nav-reveal.tsx` suppresses the global app shell for `/universities`, so a
 * bare skeleton here would flash a page with no header and then grow one —
 * exactly the shift fix 2 removed from the nav. Header and footer are therefore
 * the real components, and only the results area is a placeholder; if this page
 * ever gains a `layout.tsx`, move them there and strip this back.
 */
function Bar({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-gb-md bg-surface-muted ${className}`} />;
}

export default function Loading() {
  return (
    <div className="gb-page-full-bleed gb-has-mobile-header bg-surface">
      <SiteNavigation tone="light" showSaved />

      <main aria-busy="true" aria-label="Loading your matches">
        <Container className="flex flex-col gap-gb-4xl py-gb-7xl">
          <div className="flex flex-col gap-gb-lg">
            <Bar className="h-gb-5xl w-3/5 max-w-[460px]" />
            <Bar className="h-gb-xl w-full max-w-[620px]" />
          </div>

          {/* Match cards: crest, title block, then the score rail on the right —
              the shape `UniversityMatchResults` settles into. */}
          <div className="flex flex-col gap-gb-2xl">
            {Array.from({ length: 4 }).map((_, card) => (
              <div
                key={card}
                className="flex items-start gap-gb-2xl rounded-gb-xl border border-line p-gb-3xl"
              >
                <Bar className="h-gb-6xl w-gb-6xl shrink-0 rounded-gb-lg" />
                <div className="flex min-w-0 flex-1 flex-col gap-gb-md">
                  <Bar className="h-gb-2xl w-2/5" />
                  <Bar className="h-gb-md w-full" />
                  <Bar className="h-gb-md w-4/5" />
                </div>
                <Bar className="h-gb-5xl w-gb-9xl shrink-0" />
              </div>
            ))}
          </div>
        </Container>
      </main>

      <Footer
        logo={<GlowbalLogo height={28} />}
        tagline={FOOTER_TAGLINE}
        columns={FOOTER_COLUMNS}
        social={FOOTER_SOCIAL}
        copyright={FOOTER_COPYRIGHT}
        ratings={FOOTER_RATINGS}
      />
    </div>
  );
}
