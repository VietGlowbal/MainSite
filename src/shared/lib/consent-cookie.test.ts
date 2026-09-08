import { describe, expect, it } from 'vitest';

import {
  CONSENT_COOKIE,
  CONSENT_POLICY_VERSION,
  analyticsConsentedFromCookie,
  consentCookieAssignment,
  serialiseConsentCookie,
} from './consent-cookie';

describe('consent mirror cookie', () => {
  it('encodes the policy version alongside the one bit', () => {
    expect(serialiseConsentCookie(true)).toBe(`${CONSENT_POLICY_VERSION}.1`);
    expect(serialiseConsentCookie(false)).toBe(`${CONSENT_POLICY_VERSION}.0`);
  });

  it('reads acceptance only from an exact, current value', () => {
    expect(analyticsConsentedFromCookie(serialiseConsentCookie(true))).toBe(true);
    expect(analyticsConsentedFromCookie(serialiseConsentCookie(false))).toBe(false);
  });

  it('fails closed on anything it does not recognise', () => {
    // Each of these must read as "no consent", because the caller uses a false
    // to decide it may not store an identifier on the device.
    for (const value of [
      null,
      undefined,
      '',
      '1',
      'true',
      '2020-01-01.1', // superseded policy version — consent must be asked again
      `${CONSENT_POLICY_VERSION}.2`,
      ` ${CONSENT_POLICY_VERSION}.1`,
    ]) {
      expect(analyticsConsentedFromCookie(value)).toBe(false);
    }
  });

  it('writes a year-long, lax, path-wide cookie and adds Secure only on https', () => {
    const secure = consentCookieAssignment(true, true);
    expect(secure).toContain(`${CONSENT_COOKIE}=${CONSENT_POLICY_VERSION}.1`);
    expect(secure).toContain('Path=/');
    expect(secure).toContain('SameSite=Lax');
    expect(secure).toContain(`Max-Age=${60 * 60 * 24 * 365}`);
    expect(secure).toContain('Secure');
    // Localhost is http; a Secure cookie there would simply never be stored.
    expect(consentCookieAssignment(false, false)).not.toContain('Secure');
  });
});
