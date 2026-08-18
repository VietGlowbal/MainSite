import { afterEach, describe, expect, it, vi } from 'vitest';
import { getEmailSender } from './config';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getEmailSender', () => {
  it('uses support@glowbal-education.com as the product-wide default', () => {
    vi.stubEnv('EMAIL_FROM_DEFAULT', '');
    vi.stubEnv('EMAIL_FROM_MENTORSHIP', '');
    vi.stubEnv('EMAIL_FROM_MARKETING', '');
    vi.stubEnv('WAITLIST_FROM_EMAIL', 'mentorship@old.example');

    expect(getEmailSender()).toBe('GlowBal <support@glowbal-education.com>');
    expect(getEmailSender('mentorship')).toBe('GlowBal <support@glowbal-education.com>');
    expect(getEmailSender('marketing')).toBe('GlowBal <support@glowbal-education.com>');
  });

  it('supports an intentional modern sender override', () => {
    vi.stubEnv('EMAIL_FROM_DEFAULT', 'mail@glowbal-education.com');
    expect(getEmailSender()).toBe('GlowBal <mail@glowbal-education.com>');
  });
});
