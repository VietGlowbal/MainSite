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
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-transparent px-gb-xl py-gb-3xl md:px-gb-4xl md:py-gb-5xl">
      <div className="mx-auto flex max-w-gb-width-xl flex-col gap-gb-4xl">
        <div className="flex flex-col gap-gb-2xl">
          <Link
            href="/profile"
            className="inline-flex w-fit items-center gap-gb-md rounded-gb-md px-gb-md py-gb-xs text-gb-sm font-semibold text-fg-tertiary transition-colors hover:bg-surface-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <KitIcon art={ICONS.arrowLeft} frame={16} className="shrink-0" />
            Back to profile
          </Link>

          <div className="flex flex-col gap-gb-md">
            <h1 className="font-display text-gb-display-sm font-semibold tracking-gb-display-tight text-fg">
              {title}
            </h1>
            <p className="text-gb-md text-fg-tertiary">{description}</p>
          </div>
        </div>

        {children}
      </div>
    </main>
  );
}
