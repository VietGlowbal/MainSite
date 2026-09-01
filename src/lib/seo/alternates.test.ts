import { describe, expect, it } from 'vitest';
import { buildLocaleAlternates, buildViLocaleAlternates } from './alternates';
import { SITE_URL } from '@/lib/site-url';

describe('Locale Alternates (hreflang & canonical)', () => {
  it('builds reciprocal alternates for root homepage', () => {
    const en = buildLocaleAlternates('/');
    expect(en.canonical).toBe(SITE_URL);
    expect(en.languages.en).toBe(SITE_URL);
    expect(en.languages.vi).toBe(`${SITE_URL}/vi`);
    expect(en.languages['x-default']).toBe(SITE_URL);

    const vi = buildViLocaleAlternates('/');
    expect(vi.canonical).toBe(`${SITE_URL}/vi`);
    expect(vi.languages.en).toBe(SITE_URL);
    expect(vi.languages.vi).toBe(`${SITE_URL}/vi`);
    expect(vi.languages['x-default']).toBe(SITE_URL);
  });

  it('builds reciprocal alternates for subpaths', () => {
    const en = buildLocaleAlternates('/scholarships');
    expect(en.canonical).toBe(`${SITE_URL}/scholarships`);
    expect(en.languages.en).toBe(`${SITE_URL}/scholarships`);
    expect(en.languages.vi).toBe(`${SITE_URL}/vi/scholarships`);
    expect(en.languages['x-default']).toBe(`${SITE_URL}/scholarships`);

    const vi = buildViLocaleAlternates('/scholarships');
    expect(vi.canonical).toBe(`${SITE_URL}/vi/scholarships`);
    expect(vi.languages.en).toBe(`${SITE_URL}/scholarships`);
    expect(vi.languages.vi).toBe(`${SITE_URL}/vi/scholarships`);
    expect(vi.languages['x-default']).toBe(`${SITE_URL}/scholarships`);
  });

  it('builds reciprocal alternates for dynamic entities', () => {
    const en = buildLocaleAlternates('/news/sample-slug');
    expect(en.canonical).toBe(`${SITE_URL}/news/sample-slug`);
    expect(en.languages.en).toBe(`${SITE_URL}/news/sample-slug`);
    expect(en.languages.vi).toBe(`${SITE_URL}/vi/news/sample-slug`);

    const vi = buildViLocaleAlternates('/universities/42');
    expect(vi.canonical).toBe(`${SITE_URL}/vi/universities/42`);
    expect(vi.languages.en).toBe(`${SITE_URL}/universities/42`);
    expect(vi.languages.vi).toBe(`${SITE_URL}/vi/universities/42`);
  });

  it('preserves query/hash context without duplicating /vi', () => {
    expect(buildLocaleAlternates('/news/story/?q=1#faq').languages.vi).toBe(
      `${SITE_URL}/vi/news/story/?q=1#faq`,
    );
    expect(buildViLocaleAlternates('/vi/news/story?q=1').canonical).toBe(
      `${SITE_URL}/vi/news/story?q=1`,
    );
  });
});
