import Link from 'next/link';
import { KitIcon, ICONS } from '@/shared/ui';

/** Very small, per spec §6.A — a back caret and the product name, nothing else. */
export function PlannerHeader() {
  return (
    <header className="flex items-center gap-gb-sm px-gb-xl pt-gb-xl">
      <Link
        href="/"
        aria-label="Back"
        className="flex size-[28px] shrink-0 items-center justify-center rounded-gb-full text-fg-brand transition-colors hover:bg-brand-subtle"
      >
        <KitIcon art={ICONS.arrowLeft} frame={20} />
      </Link>
      <span className="text-gb-sm font-semibold text-fg-brand">GlowBal Planner</span>
    </header>
  );
}
