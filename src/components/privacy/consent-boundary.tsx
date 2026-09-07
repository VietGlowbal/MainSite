'use client';

import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { startTransition, useEffect, useState } from 'react';
import { useT } from '@/lib/i18n';
import { Button } from '@/shared/ui/button';
import { Modal } from '@/shared/ui/modal';

export const CONSENT_STORAGE_KEY = 'glowbal-consent';
export const CONSENT_POLICY_VERSION = '2026-09-08';
export const CONSENT_OPEN_EVENT = 'glowbal:open-consent-settings';

export type ConsentRecord = {
  policyVersion: string;
  analytics: boolean;
  updatedAt: string;
};

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

function writeLocalConsent(record: ConsentRecord): void {
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // The in-memory choice still protects this page when storage is unavailable.
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
        if (signal && stored.analytics) writeLocalConsent(effective);
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
      {consent?.analytics ? <Analytics /> : null}
      {consent?.analytics ? <SpeedInsights /> : null}

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
            <div className="flex flex-wrap gap-gb-md">
              <Button size="sm" onClick={() => saveConsent(true)}>
                {t('Accept non-essential')}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => saveConsent(false)}>
                {t('Reject non-essential')}
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
