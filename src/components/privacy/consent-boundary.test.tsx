import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@vercel/analytics/next', () => ({
  Analytics: () => <output data-testid="vercel-analytics" />,
}));
vi.mock('@vercel/speed-insights/next', () => ({
  SpeedInsights: () => <output data-testid="vercel-speed-insights" />,
}));

import {
  ConsentBoundary,
  CONSENT_POLICY_VERSION,
  CONSENT_STORAGE_KEY,
  hasPrivacySignal,
  makeConsentRecord,
  parseStoredConsent,
} from './consent-boundary';
import { ConsentSettingsTrigger } from '@/shared/ui/consent-settings-trigger';
import { CONSENT_COOKIE, analyticsConsentedFromCookie } from '@/shared/lib';

/** The mirror cookie's current value, or null when it was never written. */
function consentCookie(): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${CONSENT_COOKIE}=([^;]*)`));
  return match?.[1] ?? null;
}

afterEach(() => {
  window.localStorage.clear();
  document.cookie = `${CONSENT_COOKIE}=; Path=/; Max-Age=0`;
  vi.restoreAllMocks();
});

describe('consent state', () => {
  it('accepts only the current version and a boolean analytics choice', () => {
    const record = makeConsentRecord(true, new Date('2026-09-08T00:00:00.000Z'));
    expect(parseStoredConsent(JSON.stringify(record))).toEqual(record);
    expect(parseStoredConsent(JSON.stringify({ ...record, policyVersion: 'old' }))).toBeNull();
    expect(parseStoredConsent(JSON.stringify({ ...record, analytics: 'yes' }))).toBeNull();
    expect(CONSENT_POLICY_VERSION).toBe('2026-09-08');
  });

  it('treats GPC, DNT and the legacy Microsoft signal as opt-outs', () => {
    expect(hasPrivacySignal({ globalPrivacyControl: true })).toBe(true);
    expect(hasPrivacySignal({ doNotTrack: '1' })).toBe(true);
    expect(hasPrivacySignal({ msDoNotTrack: '1' })).toBe(true);
    expect(hasPrivacySignal({ doNotTrack: '0' })).toBe(false);
  });
});

describe('ConsentBoundary', () => {
  it('does not mount analytics before a choice, then persists acceptance', async () => {
    const user = userEvent.setup();
    render(
      <ConsentBoundary>
        <p>content</p>
      </ConsentBoundary>,
    );

    expect(screen.queryByTestId('vercel-analytics')).not.toBeInTheDocument();
    await screen.findByRole('complementary', { name: 'Cookie preferences' });
    await user.click(screen.getByRole('button', { name: 'Accept' }));

    expect(screen.getByTestId('vercel-analytics')).toBeInTheDocument();
    expect(screen.getByTestId('vercel-speed-insights')).toBeInTheDocument();
    expect(parseStoredConsent(window.localStorage.getItem(CONSENT_STORAGE_KEY))).toMatchObject({
      analytics: true,
    });
    // The server reads this copy, and only this one: /c/<code> decides whether
    // it may write gb_visitor from it.
    expect(analyticsConsentedFromCookie(consentCookie())).toBe(true);
  });

  it('accepts from the second banner button too, by owner decision', async () => {
    // "Accept Essential Cookies" is wired to saveConsent(true) on purpose (see
    // the comment beside it). This test exists so that anyone who "fixes" it to
    // false gets a red test naming the decision, rather than a silent change in
    // what the banner consents to.
    const user = userEvent.setup();
    render(
      <ConsentBoundary>
        <p>content</p>
      </ConsentBoundary>,
    );

    await screen.findByRole('complementary', { name: 'Cookie preferences' });
    await user.click(screen.getByRole('button', { name: 'Accept Essential Cookies' }));

    expect(screen.getByTestId('vercel-analytics')).toBeInTheDocument();
    expect(parseStoredConsent(window.localStorage.getItem(CONSENT_STORAGE_KEY))).toMatchObject({
      analytics: true,
    });
    expect(analyticsConsentedFromCookie(consentCookie())).toBe(true);
  });

  it('allows the footer trigger to reopen settings and switch analytics off', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify(makeConsentRecord(true)),
    );
    render(
      <ConsentBoundary>
        <ConsentSettingsTrigger />
      </ConsentBoundary>,
    );

    await waitFor(() => expect(screen.getByTestId('vercel-analytics')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Privacy settings' }));
    expect(screen.getByRole('dialog', { name: 'Privacy settings' })).toBeInTheDocument();
    const analytics = screen.getByRole('switch', { name: 'Analytics' });
    expect(analytics).toBeChecked();
    await user.click(analytics);
    await user.click(screen.getByRole('button', { name: 'Save my choices' }));

    expect(screen.queryByTestId('vercel-analytics')).not.toBeInTheDocument();
    expect(parseStoredConsent(window.localStorage.getItem(CONSENT_STORAGE_KEY))).toMatchObject({
      analytics: false,
    });
    expect(analyticsConsentedFromCookie(consentCookie())).toBe(false);
  });

  it('refuses everything optional in one click from Configure', async () => {
    // Configure is the only refusal the banner offers (known-issues §9), so the
    // refusal inside it must be the first thing a visitor meets: it is the
    // first button in the dialog, which is where Modal puts focus on open.
    const user = userEvent.setup();
    render(
      <ConsentBoundary>
        <p>content</p>
      </ConsentBoundary>,
    );

    await screen.findByRole('complementary', { name: 'Cookie preferences' });
    await user.click(screen.getByRole('button', { name: 'Configure' }));

    const reject = screen.getByRole('button', { name: 'Reject all optional cookies' });
    expect(reject).toHaveFocus();
    expect(screen.getByRole('switch', { name: 'Analytics' })).not.toBeChecked();
    await user.click(reject);

    expect(screen.queryByRole('dialog', { name: 'Privacy settings' })).not.toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: 'Cookie preferences' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('vercel-analytics')).not.toBeInTheDocument();
    expect(parseStoredConsent(window.localStorage.getItem(CONSENT_STORAGE_KEY))).toMatchObject({
      analytics: false,
    });
    expect(analyticsConsentedFromCookie(consentCookie())).toBe(false);
  });

  it('shows necessary cookies as always on, with a switch only for the optional category', async () => {
    const user = userEvent.setup();
    render(
      <ConsentBoundary>
        <p>content</p>
      </ConsentBoundary>,
    );

    await screen.findByRole('complementary', { name: 'Cookie preferences' });
    await user.click(screen.getByRole('button', { name: 'Configure' }));

    const necessary = screen.getByRole('region', { name: 'Necessary' });
    expect(within(necessary).getByText('Always on')).toBeInTheDocument();
    expect(within(necessary).queryByRole('switch')).not.toBeInTheDocument();
    expect(screen.getAllByRole('switch')).toHaveLength(1);
  });

  it('keeps Accept all and the switch unavailable while the browser sends a privacy signal', async () => {
    const user = userEvent.setup();
    Object.defineProperty(window.navigator, 'globalPrivacyControl', { value: true, configurable: true });
    try {
      render(
        <ConsentBoundary>
          <ConsentSettingsTrigger />
        </ConsentBoundary>,
      );

      // A privacy signal decides on mount, so no banner: settings come from the footer.
      await waitFor(() =>
        expect(parseStoredConsent(window.localStorage.getItem(CONSENT_STORAGE_KEY))).toMatchObject({
          analytics: false,
        }),
      );
      await user.click(screen.getByRole('button', { name: 'Privacy settings' }));

      expect(screen.getByRole('button', { name: 'Accept all cookies' })).toBeDisabled();
      expect(screen.getByRole('switch', { name: 'Analytics' })).toBeDisabled();
    } finally {
      delete (window.navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl;
    }
  });

  it('mirrors a pre-existing stored choice into the cookie on mount', async () => {
    // The upgrade path: someone who accepted before the mirror cookie existed
    // has a localStorage record and no cookie. Without the write-back on mount
    // the server would read them as never having consented, for a year.
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(makeConsentRecord(true)));
    expect(consentCookie()).toBeNull();

    render(
      <ConsentBoundary>
        <p>content</p>
      </ConsentBoundary>,
    );

    await waitFor(() => expect(analyticsConsentedFromCookie(consentCookie())).toBe(true));
    expect(screen.queryByRole('complementary', { name: 'Cookie preferences' })).not.toBeInTheDocument();
  });
});
