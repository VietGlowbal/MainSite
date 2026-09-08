'use client';

import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { GoogleAnalytics } from '@next/third-parties/google';
import { startTransition, useEffect, useState } from 'react';
import { useT } from '@/lib/i18n';
import { CONSENT_POLICY_VERSION, consentCookieAssignment } from '@/shared/lib';
import { Button } from '@/shared/ui/button';
import { Modal } from '@/shared/ui/modal';

/** GA4 Measurement ID, or undefined when analytics is not configured. */
const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_ID;

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
              * banner, so it cannot be dropped. A browser sending GPC or DNT is
              * still refused whatever is pressed — `saveConsent` ands its
              * argument with `!privacySignal`.
              */}
            <div className="flex flex-wrap gap-gb-md">
              <Button size="sm" onClick={() => saveConsent(true)}>
                {t('Accept')}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => saveConsent(true)}>
                {t('Accept Essential Cookies')}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setSettingsOpen(true)}>
                {t('Configure')}
              </Button>
            </div>
          </div>
        </aside>
      ) : null}

      <Modal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        label={t('Privacy settings')}
        className="max-w-xl"
      >
        <div className="flex flex-col gap-gb-2xl">
          <div>
            <h2 className="text-gb-xl font-semibold text-fg">{t('Privacy settings')}</h2>
            <p id="privacy-settings-description" className="mt-gb-xs text-gb-sm text-fg-tertiary">
              {t('Necessary cookies are always available. Choose whether optional analytics may load.')}
            </p>
          </div>
          <div className="rounded-gb-lg border border-line bg-surface-muted p-gb-xl">
            <label htmlFor="consent-analytics" className="flex items-start gap-gb-md">
              <input
                id="consent-analytics"
                type="checkbox"
                checked={analyticsChoice}
                disabled={privacySignal}
                aria-describedby={
                  privacySignal ? 'privacy-settings-description privacy-signal-note' : 'privacy-settings-description'
                }
                onChange={(event) => setAnalyticsChoice(event.target.checked)}
                className="mt-gb-xxs size-gb-3xl shrink-0 accent-brand"
              />
              <span>
                <span className="block text-gb-sm font-semibold text-fg">{t('Non-essential analytics')}</span>
                <span className="block text-gb-sm text-fg-tertiary">
                  {t('Analytics are optional and are not required for your account or application.')}
                </span>
              </span>
            </label>
            {privacySignal ? (
              <p id="privacy-signal-note" className="mt-gb-lg text-gb-xs text-fg-muted">
                {t('Your browser privacy signal keeps optional analytics turned off.')}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap justify-end gap-gb-md">
            <Button variant="secondary" onClick={() => setSettingsOpen(false)}>
              {t('Cancel')}
            </Button>
            <Button onClick={() => saveConsent(analyticsChoice)}>{t('Save privacy preferences')}</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
