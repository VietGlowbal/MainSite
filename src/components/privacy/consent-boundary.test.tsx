import { render, screen, waitFor } from '@testing-library/react';
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

afterEach(() => {
  window.localStorage.clear();
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
    await user.click(screen.getByRole('button', { name: 'Accept non-essential' }));

    expect(screen.getByTestId('vercel-analytics')).toBeInTheDocument();
    expect(screen.getByTestId('vercel-speed-insights')).toBeInTheDocument();
    expect(parseStoredConsent(window.localStorage.getItem(CONSENT_STORAGE_KEY))).toMatchObject({
      analytics: true,
    });
  });

  it('allows the footer trigger to reopen settings and reject analytics', async () => {
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
    await user.click(screen.getByRole('checkbox', { name: /Non-essential analytics/ }));
    await user.click(screen.getByRole('button', { name: 'Save privacy preferences' }));

    expect(screen.queryByTestId('vercel-analytics')).not.toBeInTheDocument();
    expect(parseStoredConsent(window.localStorage.getItem(CONSENT_STORAGE_KEY))).toMatchObject({
      analytics: false,
    });
  });
});
