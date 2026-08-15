import { describe, expect, it } from 'vitest';
import { signupConfirmationEmail } from './signup-confirmation';

describe('signupConfirmationEmail', () => {
  it('renders the approved GlowBal branding and personalisation', () => {
    const url = 'https://example.supabase.co/auth/v1/verify?token=secret';
    const html = signupConfirmationEmail(url, 'August');

    expect(html).toContain('August');
    expect(html).toContain('Go Glow, Go GlowBal');
    expect(html).toContain('#E11D48');
    expect(html).toContain('Confirm my account');
    expect(html).toContain('support@glowbal-education.com');
    expect(html).not.toContain('YouTube');
    expect(html).not.toContain('Or paste this link');
    expect(html).not.toContain('linear-gradient(135deg,#ff4d8c,#00b4d8)');

    // The auth URL must exist only as the button target, never as visible copy.
    expect(html.split(url)).toHaveLength(2);
    expect(html).toContain(`href="${url}"`);
  });

  it('uses a natural heading when the first name is unavailable', () => {
    const html = signupConfirmationEmail('https://example.com/confirm');
    expect(html).toContain('Confirm your email');
    expect(html).not.toContain('Confirm your email, there');
  });
});
