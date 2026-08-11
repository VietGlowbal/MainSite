import Link from 'next/link';
import { GlowbalLogo } from '@/components/glowbal-logo';
import { Avatar, Container } from '@/shared/ui';
import { DEMO_STUDENT_NAME } from '../domain';

/**
 * Desktop app shell chrome (`lg:` and up) — spec §4: reuse GlowBal's real
 * wordmark and brand rather than inventing a parallel product identity.
 * Deliberately NOT the full production `SiteNavigation` (My Portal, Search,
 * notifications) — that component assumes a real signed-in session, and
 * this route is intentionally auth-free (see `layout.tsx`'s gate). Mobile
 * keeps `PlannerHeader` instead — spec §6's "no large navigation" stays
 * true there.
 */
export function DesktopTopBar({ course }: { course: string }) {
  return (
    <header className="sticky top-0 z-30 hidden h-gb-7xl border-b border-line bg-surface/95 backdrop-blur-sm lg:block">
      <Container className="flex h-full items-center justify-between">
        <Link href="/" aria-label="GlowBal">
          <GlowbalLogo height={24} />
        </Link>
        <div className="flex items-center gap-gb-md">
          <span className="text-gb-sm text-fg-tertiary">
            {DEMO_STUDENT_NAME} <span className="text-fg-muted">·</span> {course}
          </span>
          <Avatar name={DEMO_STUDENT_NAME} size="sm" />
        </div>
      </Container>
    </header>
  );
}
