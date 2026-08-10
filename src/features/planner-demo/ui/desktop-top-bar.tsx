import Link from 'next/link';
import { Avatar, Container } from '@/shared/ui';
import { DEMO_STUDENT_NAME } from '../domain';

/**
 * Desktop-only app shell chrome (`lg:` and up). Mobile keeps `PlannerHeader`
 * instead — spec §6.A's "very small, no large navigation" stays true there;
 * this is the "add a real desktop shell" pivot for wider screens only.
 */
export function DesktopTopBar({ course }: { course: string }) {
  return (
    <header className="sticky top-0 z-30 hidden h-gb-7xl border-b border-line bg-surface/95 backdrop-blur-sm lg:block">
      <Container className="flex h-full items-center justify-between">
        <Link href="/" className="text-gb-sm font-semibold text-fg-brand">
          GlowBal Planner
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
