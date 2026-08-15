import { describe, expect, it } from 'vitest';
import { emailButton, escapeHtml, glowbalEmailLayout, metricRow, trustRow } from './template';

describe('GlowBal email template helpers', () => {
  it('escapes values that are inserted into email HTML', () => {
    expect(escapeHtml(`<A&B "test">`)).toBe('&lt;A&amp;B &quot;test&quot;&gt;');
  });

  it('renders a solid red CTA and escapes the destination', () => {
    const html = emailButton('Continue →', 'https://example.test/?a=1&b=2');
    expect(html).toContain('#E11D48');
    expect(html).toContain('Continue →');
    expect(html).toContain('a=1&amp;b=2');
  });

  it('renders metrics when present and nothing for an empty set', () => {
    expect(metricRow([])).toBe('');
    const html = metricRow([
      { label: 'Current match', value: '82%' },
      { label: 'Actions', value: '3' },
    ]);
    expect(html).toContain('82%');
    expect(html).toContain('Current match');
    expect(html).toContain('Actions');
  });

  it('can render the compact layout with unsubscribe and no social row', () => {
    const html = glowbalEmailLayout({
      titleHtml: 'Utility email',
      bodyHtml: 'Body',
      includeSocials: false,
      unsubscribeUrl: 'https://example.test/unsubscribe?a=1&b=2',
    });
    expect(html).not.toContain('aria-label="Instagram"');
    expect(html).not.toContain('/brand/apply-globe.png');
    expect(html).toContain('Unsubscribe');
    expect(html).toContain('a=1&amp;b=2');
  });

  it('renders the hero, trust row and configured socials for milestone mail', () => {
    const html = glowbalEmailLayout({
      preheader: 'Preview',
      eyebrow: 'Milestone',
      titleHtml: 'Welcome',
      bodyHtml: 'Body',
      hero: true,
      actionHtml: emailButton('Open GlowBal', 'https://glowbal-education.com'),
      afterActionHtml: trustRow(),
      footerNote: 'Account notice',
    });
    expect(html).toContain('/brand/apply-globe.png');
    expect(html).toContain('Milestone');
    expect(html).toContain('Secure. Private. Always you.');
    expect(html).toContain('Instagram');
    expect(html).toContain('Facebook');
    expect(html).toContain('Account notice');
  });
});
