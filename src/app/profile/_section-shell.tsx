import Link from 'next/link';
import { ICONS, KitIcon } from '@/shared/ui';

/**
 * The frame every /profile/<section> editor sits in.
 *
 * No Figma frame — see the note at the top of profile-client.tsx. The layout
 * mirrors that page so the two read as one place: same 768px measure the rest
 * of the redesign uses for a reading column, same display heading, same token
 * spacing.
 *
 * The back link is a real control rather than a text link with a chevron glued
 * on: it is the only way out of these pages on mobile, where the app sidebar is
 * behind a hamburger.
 */
export function ProfileSectionShell({
  title,
  description,
  children,
  backHref = '/profile',
  backLabel = 'Back to profile',
  contextNote,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  /**
   * When this editor was opened from an application (via a verified
   * `return` chain), points back at that application's review step instead
   * of the generic `/profile` — editing one field mid-application is a
   * detour within that journey, never a trip away from it.
   */
  backHref?: string;
  /** e.g. "← Cambridge Computer Science" when `backHref` is application-scoped. */
  backLabel?: string;
  /** "We need this before analysing your application." — shown only in the application-scoped case. */
  contextNote?: string | undefined;
}) {
  return (
    <main className="min-h-screen bg-transparent px-gb-xl py-gb-3xl md:px-gb-4xl md:py-gb-5xl">
      <div className="mx-auto flex max-w-gb-width-xl flex-col gap-gb-4xl">
        <div className="flex flex-col gap-gb-2xl">
          <Link
            href={backHref}
            className="inline-flex w-fit items-center gap-gb-md rounded-gb-md px-gb-md py-gb-xs text-gb-sm font-semibold text-fg-tertiary transition-colors hover:bg-surface-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <KitIcon art={ICONS.arrowLeft} frame={16} className="shrink-0" />
            {backLabel}
          </Link>

          <div className="flex flex-col gap-gb-md">
            <h1 className="font-display text-gb-display-sm font-semibold tracking-gb-display-tight text-fg">
              {title}
            </h1>
            <p className="text-gb-md text-fg-tertiary">{description}</p>
            {contextNote ? (
              <p className="rounded-gb-lg bg-brand-subtle px-gb-lg py-gb-md text-gb-sm text-fg-brand">
                {contextNote}
              </p>
            ) : null}
          </div>
        </div>

        {children}
      </div>
    </main>
  );
}
