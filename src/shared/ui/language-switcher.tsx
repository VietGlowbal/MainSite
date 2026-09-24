'use client';

import { useLanguage } from '@/lib/i18n';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getLocaleFromPath, getLocaleText, isLocalizedPublicPath, localizePath } from '@/lib/i18n/locale';

/**
 * EN / VI toggle.
 *
 * ⚠️ RENDERED BY `TopNav` AND `MobileNav` THEMSELVES — do not pass one into
 * `utility`, or the header shows two.
 *
 * That is a correction, not a preference. `TopNav`'s `utility` prop was
 * documented as being for this control, and for months exactly ONE of the
 * seventeen call sites passed it: the app chrome in `nav-reveal.tsx`. So the
 * switcher existed on `/profile` and `/scholarships` and nowhere else — every
 * page that ships its own header (Home, /universities, /apply, /news, /mentors,
 * /about, /ai-strategy, /onboarding …) had no way to change language at all on
 * desktop. A slot that has to be filled by convention gets forgotten; building
 * it in means a new page cannot ship without it.
 *
 * `utility` survives for the genuinely page-specific control, `SavedNavLink`,
 * which really is not on every page.
 *
 * There is no Figma frame for this. The design file is an English-only mockup;
 * the app is bilingual, and the switcher used to live in a sidebar footer that
 * the redesign deleted. See the note on `TopNav`'s `utility` prop.
 *
 * `useLanguage` falls back to a no-op English context when no provider is
 * mounted, so this can never throw — but `LanguageProvider` wraps the whole
 * tree in `src/app/layout.tsx`, so in practice it is always live.
 */

type Props = {
  /**
   * `button` is the desktop header control — a bordered pill.
   * `row` is the full-width form for `MobileNav`'s drawer footer, matching
   * `SavedNavLink variant="row"` beside it: a 28px pill in a stack of
   * full-width rows reads as a stray element.
   */
  variant?: 'button' | 'row';
  /** Only meaningful for `button`; the drawer footer is always the light sheet. */
  tone?: 'dark' | 'light';
};

/** Same two tones as `TopNav`'s secondary action, for the same reason: a grey
 *  hairline disappears against the black bar. */
const BUTTON_TONE: Record<'dark' | 'light', string> = {
  dark: 'border-white/12 text-white hover:bg-white/8',
  light: 'border-line text-fg-secondary hover:bg-surface-hover',
};

export function LanguageSwitcher({ variant = 'button', tone = 'light' }: Props = {}) {
  const { lang, setLang, t } = useLanguage();
  const pathname = usePathname();
  const routeLocale = getLocaleFromPath(pathname);
  const current = isLocalizedPublicPath(pathname) ? routeLocale : lang;
  const next = current === 'en' ? 'vi' : 'en';
  const nextLabel = next === 'en' ? 'English' : 'Vietnamese';
  const currentLabel = current === 'en' ? 'English' : 'Vietnamese';
  const code = current === 'en' ? 'EN' : 'VI';
  const flag = current === 'en' ? '🇬🇧' : '🇻🇳';
  const href = localizePath(pathname, next);
  const label = getLocaleText(current, currentLabel);
  const switchLabel = `${getLocaleText(current, 'Switch to')} ${getLocaleText(current, nextLabel)}`;

  if (variant === 'row') {
    return (
      <Link
        href={href}
        onClick={() => setLang(next)}
        aria-label={switchLabel}
        className="mb-gb-lg flex w-full items-center justify-between rounded-gb-md px-gb-lg py-gb-md text-gb-sm font-medium text-fg-tertiary transition-colors hover:bg-surface-hover"
      >
        <span>{flag} {current === 'vi' ? label : t(label)}</span>
        <span className="text-gb-xs font-semibold tracking-wide text-fg-muted">{code}</span>
      </Link>
    );
  }

  /*
   * The language NAME is dropped on desktop and the two-letter code kept. A
   * header has no room for "Tiếng Việt" beside the nav and two buttons — see
   * the width note in SavedNavLink, which cost a clipped label learning the
   * same lesson — and the code is what the mobile sheet already shows on its
   * right edge.
   */
  return (
    <Link
      href={href}
      onClick={() => setLang(next)}
      aria-label={switchLabel}
      title={switchLabel}
      className={`flex shrink-0 items-center gap-gb-sm rounded-gb-md border px-gb-lg py-gb-sm text-gb-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${BUTTON_TONE[tone]}`}
    >
      <span aria-hidden="true">{flag}</span>
      <span>{code}</span>
    </Link>
  );
}
