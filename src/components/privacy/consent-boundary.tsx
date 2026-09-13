'use client';

import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { GoogleAnalytics } from '@next/third-parties/google';
import { startTransition, useEffect, useState } from 'react';
import { useT } from '@/lib/i18n';
import { CONSENT_POLICY_VERSION, consentCookieAssignment } from '@/shared/lib';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { ICONS, KitIcon } from '@/shared/ui/icons';
import { Modal } from '@/shared/ui/modal';
import { Toggle } from '@/shared/ui/toggle';

/** GA4 Measurement ID, or undefined when analytics is not configured. */
const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_ID;

type ConsentItem = { readonly name: string; readonly purpose: string };

/**
 * What each category in the settings dialog actually contains. English keys,
 * translated at render.
 *
 * EVERY ROW MUST NAME SOMETHING THE SITE REALLY SETS OR LOADS, and everything
 * it sets or loads must have a row. A row for a cookie that does not exist
 * tells a student we collect something we don't; a missing row hides one we
 * do. Checked against the code on 2026-09-13:
 *   - Sign-in session  → Supabase auth cookies, refreshed in `src/proxy.ts`
 *   - Language         → the `lib/i18n.tsx` localStorage key + cookie mirror
 *   - Privacy choice   → `glowbal-consent` + `gb_consent` (this file)
 *   - Referral code    → `gb_ref`, set by `/c/<code>`
 *   - Google Analytics / Vercel Web Analytics / Speed Insights → mounted below
 *   - Referral visit ID → `gb_visitor`, set by `/c/<code>` only with consent
 * Adding a tracker means adding its row here in the same change.
 */
const NECESSARY_ITEMS: readonly ConsentItem[] = [
  { name: 'Sign-in session', purpose: 'Keeps you signed in while you move between pages.' },
  { name: 'Language', purpose: 'Remembers whether you read GlowBal in English or Vietnamese.' },
  { name: 'Your privacy choice', purpose: 'Remembers what you pick here, so we do not ask again on every page.' },
  { name: 'Referral code', purpose: 'Records which ambassador link brought you here.' },
];

const ANALYTICS_ITEMS: readonly ConsentItem[] = [
  {
    name: 'Google Analytics',
    purpose:
      'Which pages you visit and a few key steps, such as finishing an essay review. Never the content of your documents.',
  },
  { name: 'Vercel Web Analytics', purpose: 'Anonymous page-view counts.' },
  { name: 'Vercel Speed Insights', purpose: 'How fast pages load on your device.' },
  { name: 'Referral visit ID', purpose: 'Tells repeat visits apart when you open an ambassador link.' },
];

export const CONSENT_STORAGE_KEY = 'glowbal-consent';
export const CONSENT_OPEN_EVENT = 'glowbal:open-consent-settings';
/**
 * Re-exported, not defined here: the version is also read by server code
 * through the mirror cookie, and `@/shared/lib` is the one place both sides can
 * import from — this file is a client component. Importers keep working.
 */
export { CONSENT_POLICY_VERSION };

/**
 * The categories this site asks consent for. One today.
 *
 * A union of field names rather than a bare boolean because the next one is
 * already foreseeable: Google Ads needs its own opt-in, kept separate from
 * analytics so a visitor can accept measurement without accepting advertising.
 * Every member must name a field on `ConsentRecord` — `consentAllows` indexes
 * the record by it, so the two cannot drift apart.
 */
export type ConsentCategory = 'analytics';

export type ConsentRecord = {
  policyVersion: string;
  analytics: boolean;
  updatedAt: string;
};

/**
 * Does this record permit `category`?
 *
 * The single read path. Nothing should reach for `record.analytics` directly:
 * an absent field reads as a refusal here, which is what lets a later version
 * add a category without invalidating the records this one wrote.
 *
 * ── ADDING A CATEGORY (the Google Ads case) ─────────────────────────
 *  1. `ConsentCategory` — add the name, e.g. `'analytics' | 'advertising'`.
 *  2. `ConsentRecord` — add `advertising?: boolean`, OPTIONAL. Optional is the
 *     load-bearing part: it is what makes an older stored record still parse.
 *  3. `parseStoredConsent` — validate the new field only when it is present.
 *  4. `makeConsentRecord` — take the categories as an object instead of a
 *     positional boolean.
 *  5. `serialiseConsentCookie` — append a flag. The cookie format already
 *     tolerates extra segments; see `shared/lib/consent-cookie.ts`.
 *  6. The settings modal — one more checkbox. The banner's three buttons are a
 *     product decision (see the block above them) and do not have to grow.
 *  7. `CONSENT_POLICY_VERSION` — bump it. Collecting for advertising widens
 *     what is collected, so every visitor is asked again. That re-prompt is the
 *     policy working, not a regression to engineer around.
 *  8. Google Consent Mode — GA4 is mounted bare here, with no
 *     `gtag('consent', …)` call, because not mounting IS the gate while
 *     analytics is the only category. Ads tags cannot work that way: they load
 *     in a denied default state and get an `update` when the visitor accepts.
 *     That call belongs in this component, beside where GA is mounted.
 */
export function consentAllows(record: ConsentRecord | null, category: ConsentCategory): boolean {
  return record?.[category] === true;
}

export function parseStoredConsent(raw: string | null): ConsentRecord | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<ConsentRecord>;
    if (
      value.policyVersion !== CONSENT_POLICY_VERSION ||
      typeof value.analytics !== 'boolean' ||
      typeof value.updatedAt !== 'string'
    ) {
      return null;
    }
    return value as ConsentRecord;
  } catch {
    return null;
  }
}

export function hasPrivacySignal(
  browser: { doNotTrack?: string | null; globalPrivacyControl?: boolean; msDoNotTrack?: string | null },
): boolean {
  return (
    browser.globalPrivacyControl === true ||
    browser.doNotTrack === '1' ||
    browser.msDoNotTrack === '1'
  );
}

export function makeConsentRecord(analytics: boolean, now = new Date()): ConsentRecord {
  return {
    policyVersion: CONSENT_POLICY_VERSION,
    analytics,
    updatedAt: now.toISOString(),
  };
}

function browserPrivacySignal(): boolean {
  const browser = window.navigator as Navigator & {
    globalPrivacyControl?: boolean;
    msDoNotTrack?: string | null;
  };
  return hasPrivacySignal(browser) || (window as Window & { doNotTrack?: string }).doNotTrack === '1';
}

function readLocalConsent(): ConsentRecord | null {
  try {
    return parseStoredConsent(window.localStorage.getItem(CONSENT_STORAGE_KEY));
  } catch {
    return null;
  }
}

/**
 * Persist a decision in both places it has to be readable.
 *
 * localStorage is the source of truth and the only copy that carries the whole
 * record. The cookie carries one bit, and exists because a choice kept purely
 * in localStorage is invisible to the server — which is where `/c/<code>`
 * decides whether it may write the `gb_visitor` cookie. Two try blocks, not
 * one: private-mode browsers throw on localStorage while cookies still work,
 * and the cookie is the copy that gates device storage, so it must not be lost
 * to the other's failure.
 */
function writeLocalConsent(record: ConsentRecord): void {
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // The in-memory choice still protects this page when storage is unavailable.
  }
  try {
    document.cookie = consentCookieAssignment(
      record.analytics,
      window.location.protocol === 'https:',
    );
  } catch {
    // Cookies disabled entirely. Server-side callers then see no consent and
    // fail closed, which is the outcome we want anyway.
  }
}

export function ConsentBoundary({ children }: { children: React.ReactNode }) {
  const t = useT();
  const [ready, setReady] = useState(false);
  const [consent, setConsent] = useState<ConsentRecord | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [analyticsChoice, setAnalyticsChoice] = useState(false);
  const [privacySignal, setPrivacySignal] = useState(false);

  useEffect(() => {
    const signal = browserPrivacySignal();
    const stored = readLocalConsent();
    startTransition(() => {
      setPrivacySignal(signal);
      if (stored) {
        const effective = signal && stored.analytics ? makeConsentRecord(false) : stored;
        // Written back unconditionally, not only on a GPC downgrade. Visitors
        // who decided before the mirror cookie existed have a localStorage
        // record and no cookie, and the server would read that as no consent
        // forever. Rewriting an unchanged record is idempotent and repairs it.
        writeLocalConsent(effective);
        setConsent(effective);
        setAnalyticsChoice(signal ? false : stored.analytics);
      } else if (signal) {
        const rejected = makeConsentRecord(false);
        writeLocalConsent(rejected);
        setConsent(rejected);
      }
      setReady(true);
    });

    const openSettings = () => {
      const latest = readLocalConsent();
      setAnalyticsChoice(signal ? false : latest?.analytics ?? false);
      setSettingsOpen(true);
    };
    window.addEventListener(CONSENT_OPEN_EVENT, openSettings);
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, openSettings);
  }, []);

  function saveConsent(analytics: boolean) {
    const next = makeConsentRecord(analytics && !privacySignal);
    writeLocalConsent(next);
    setConsent(next);
    setAnalyticsChoice(next.analytics);
    setSettingsOpen(false);
  }

  const showBanner = ready && consent === null && !settingsOpen;

  return (
    <>
      {children}
      {consentAllows(consent, 'analytics') ? <Analytics /> : null}
      {consentAllows(consent, 'analytics') ? <SpeedInsights /> : null}
      {/*
       * GA4 sits behind the same gate as the two above, and for the same
       * reason — it is non-essential analytics. Mounting it from the root
       * layout instead would fetch gtag.js and start a GA session for a
       * visitor who turned analytics off in Configure, which is the one
       * outcome this component exists to prevent. Nothing is requested from Google
       * until `consent.analytics` is true, so a rejecting or GPC/DNT visitor
       * makes no third-party request at all.
       *
       * `GA_MEASUREMENT_ID` is read rather than passed in: it is a
       * NEXT_PUBLIC_* value that Next inlines at build time, so an unset one
       * makes this a literal `null` and no script tag is emitted. That is what
       * keeps local dev and CI silent.
       *
       * Cost: gtag.js loads through next/script at the default
       * `afterInteractive` strategy, i.e. after hydration, so it stays off the
       * critical path the /ai-strategy FCP/LCP work is measuring.
       */}
      {consentAllows(consent, 'analytics') && GA_MEASUREMENT_ID ? <GoogleAnalytics gaId={GA_MEASUREMENT_ID} /> : null}

      {showBanner ? (
        <aside
          aria-label={t('Cookie preferences')}
          className="fixed inset-x-4 bottom-4 z-[90] mx-auto max-w-3xl rounded-gb-xl border border-line bg-surface p-gb-2xl shadow-gb-lg sm:inset-x-6"
        >
          <div className="flex flex-col gap-gb-lg">
            <div>
              <h2 className="text-gb-md font-semibold text-fg">{t('Cookie preferences')}</h2>
              <p className="mt-gb-xs text-gb-sm text-fg-tertiary">
                {t('Necessary cookies keep GlowBal working. Optional analytics help us understand site use.')}
              </p>
            </div>
            {/*
              * THE SECOND BUTTON ALSO ACCEPTS EVERYTHING. Deliberate, decided
              * by the project owner on 2026-09-08: "Accept Essential Cookies"
              * calls `saveConsent(true)`, exactly like "Accept" beside it, so
              * analytics loads either way. This is not the old reject button
              * reworded and the `true` is not a typo — do not change it to
              * `false` without asking the owner.
              *
              * What follows from it: Configure is the only refusal left on this
              * banner, so it cannot be dropped — and inside it the refusal is
              * the first button, see the dialog below. A browser sending GPC or
              * DNT is still refused whatever is pressed — `saveConsent` ands its
              * argument with `!privacySignal`.
              */}
            <div className="flex flex-wrap gap-gb-md">
              <Button size="sm" onClick={() => saveConsent(true)}>
                {t('Accept')}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => saveConsent(true)}>
                {t('Accept Essential Cookies')}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  // No decision exists yet while the banner shows, so the switch
                  // starts off — and is reset, in case a cancelled visit left it on.
                  setAnalyticsChoice(false);
                  setSettingsOpen(true);
                }}
              >
                {t('Configure')}
              </Button>
            </div>
          </div>
        </aside>
      ) : null}

      {/*
       * THE SETTINGS DIALOG. No Figma frame draws it; the layout is the owner's
       * pick of two options put to them on 2026-09-13 ("categories + reject
       * all" over per-service switches).
       *
       *  1. Refusing is one click and comes first. "Reject all optional
       *     cookies" is the first focusable element, so Modal focuses it on
       *     open, and it has the same weight and size as "Accept all" beside it
       *     — a refusal styled quieter than the acceptance is the dark pattern
       *     regulators name first. Both save and close immediately.
       *  2. Every category is shown, including the one that cannot be changed.
       *     "Necessary" carries a locked "Always on" chip instead of a disabled
       *     switch: a greyed-out switch reads as "broken", not "required".
       *  3. One switch, because there is one optional category. Categories the
       *     site does not use (marketing, functional) are deliberately absent —
       *     a switch that controls nothing misinforms. When Google Ads lands
       *     (see `consentAllows`), it is a second card with its own switch.
       *  4. The switch has a visible On/Off word next to it, so the state does
       *     not rest on colour and knob position alone.
       *  5. "What's included" lists the real things behind each category — see
       *     NECESSARY_ITEMS / ANALYTICS_ITEMS for the rule that list follows.
       */}
      <Modal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        label={t('Privacy settings')}
        className="max-w-2xl"
      >
        <div className="flex flex-col gap-gb-2xl">
          <div>
            <h2 className="text-gb-xl font-semibold text-fg">{t('Privacy settings')}</h2>
            <p className="mt-gb-xs text-gb-sm text-fg-tertiary">
              {t(
                'Choose which cookies GlowBal may use. Turning off optional cookies does not limit anything you can do on GlowBal.',
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-gb-md sm:grid-cols-2">
            <Button size="lg" variant="secondary" className="text-center" onClick={() => saveConsent(false)}>
              <KitIcon art={ICONS.close} frame={20} className="shrink-0" />
              {t('Reject all optional cookies')}
            </Button>
            <Button
              size="lg"
              variant="secondary"
              className="text-center"
              disabled={privacySignal}
              onClick={() => saveConsent(true)}
            >
              <KitIcon art={ICONS.checkCircle} frame={20} className="shrink-0" />
              {t('Accept all cookies')}
            </Button>
          </div>

          <div className="flex items-center gap-gb-lg" aria-hidden="true">
            <span className="h-px flex-1 bg-line" />
            <span className="text-gb-xs font-medium text-fg-muted">{t('Or choose by category')}</span>
            <span className="h-px flex-1 bg-line" />
          </div>

          <div className="flex flex-col gap-gb-lg">
            <ConsentCategoryCard
              id="consent-necessary"
              title={t('Necessary')}
              description={t('Needed for GlowBal to work, so they cannot be turned off.')}
              items={NECESSARY_ITEMS}
              control={
                <Badge variant="neutral-chip" className="gap-gb-xs">
                  <KitIcon art={ICONS.checkCircle} frame={14} />
                  {t('Always on')}
                </Badge>
              }
            />
            <ConsentCategoryCard
              id="consent-analytics"
              title={t('Analytics')}
              description={t(
                'Help us see which pages students use and how fast they load. Not needed for your account or applications.',
              )}
              items={ANALYTICS_ITEMS}
              control={
                <span className="flex items-center gap-gb-md">
                  <span
                    aria-hidden="true"
                    className={`text-gb-sm font-semibold ${analyticsChoice ? 'text-fg-brand' : 'text-fg-muted'}`}
                  >
                    {analyticsChoice ? t('On') : t('Off')}
                  </span>
                  <Toggle
                    id="consent-analytics-switch"
                    checked={analyticsChoice}
                    disabled={privacySignal}
                    aria-labelledby="consent-analytics-title"
                    aria-describedby={
                      privacySignal
                        ? 'consent-analytics-description privacy-signal-note'
                        : 'consent-analytics-description'
                    }
                    onChange={(event) => setAnalyticsChoice(event.target.checked)}
                  />
                </span>
              }
              note={
                privacySignal ? (
                  <p id="privacy-signal-note" className="px-gb-xl pb-gb-lg text-gb-xs text-fg-muted">
                    {t('Your browser privacy signal keeps optional analytics turned off.')}
                  </p>
                ) : null
              }
            />
          </div>

          <div className="flex flex-wrap justify-end gap-gb-md">
            <Button variant="secondary" onClick={() => setSettingsOpen(false)}>
              {t('Cancel')}
            </Button>
            <Button onClick={() => saveConsent(analyticsChoice)}>{t('Save my choices')}</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

/**
 * One category in the settings dialog: title, what it is for, its control on
 * the right, and a collapsed list of what it contains.
 *
 * A `<section>` named by its title, so assistive tech lists "Necessary" and
 * "Analytics" as regions to jump between. `<details>` for the list because it
 * is keyboard-operable and announced as expandable with no script.
 */
function ConsentCategoryCard({
  id,
  title,
  description,
  control,
  items,
  note,
}: {
  id: string;
  title: string;
  description: string;
  control: React.ReactNode;
  items: readonly ConsentItem[];
  note?: React.ReactNode;
}) {
  const t = useT();
  return (
    <section
      aria-labelledby={`${id}-title`}
      className="overflow-hidden rounded-gb-lg border border-line bg-surface"
    >
      <div className="flex flex-wrap items-start justify-between gap-gb-lg p-gb-xl">
        <div className="min-w-0 flex-1 basis-gb-9xl">
          <h3 id={`${id}-title`} className="text-gb-md font-semibold text-fg">
            {title}
          </h3>
          <p id={`${id}-description`} className="mt-gb-xxs text-gb-sm text-fg-tertiary">
            {description}
          </p>
        </div>
        {control}
      </div>
      {note}
      <details className="group border-t border-line">
        <summary className="flex cursor-pointer list-none items-center gap-gb-xs px-gb-xl py-gb-md text-gb-sm font-semibold text-fg-brand hover:bg-surface-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand [&::-webkit-details-marker]:hidden">
          {t("What's included ({count})", { count: items.length })}
          <KitIcon
            art={ICONS.chevronDown}
            frame={20}
            className="transition-transform group-open:rotate-180 motion-reduce:transition-none"
          />
        </summary>
        <ul className="flex flex-col gap-gb-md px-gb-xl pb-gb-xl">
          {items.map((item) => (
            <li key={item.name} className="text-gb-sm">
              <span className="block font-medium text-fg-secondary">{t(item.name)}</span>
              <span className="block text-fg-muted">{t(item.purpose)}</span>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
