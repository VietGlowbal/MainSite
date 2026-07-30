/**
 * Tests: URL canonicalization utility
 */

import { describe, it, expect } from 'vitest';
import {
  canonicalizeOfficialProgrammeUrl,
  canonicalizeUrl,
} from '@/lib/ingestion/url-utils';

describe('canonicalizeUrl', () => {
  it('strips UTM params', () => {
    const result = canonicalizeUrl(
      'https://example.edu/programme?utm_source=google&utm_medium=cpc'
    );
    expect(result).not.toContain('utm_');
    expect(result).toContain('example.edu');
  });

  it('strips known tracking params', () => {
    const result = canonicalizeUrl('https://example.edu/prog?fbclid=abc&gclid=xyz');
    expect(result).not.toContain('fbclid');
    expect(result).not.toContain('gclid');
  });

  it('preserves legitimate query params', () => {
    const result = canonicalizeUrl('https://example.edu/search?q=cs&level=masters');
    expect(result).toContain('level=masters');
    expect(result).toContain('q=cs');
  });

  it('throws on non-http scheme', () => {
    expect(() => canonicalizeUrl('ftp://example.edu/prog')).toThrow();
  });

  it('normalizes to lowercase scheme/host', () => {
    const result = canonicalizeUrl('HTTPS://Example.EDU/Programme');
    expect(result).toMatch(/^https:\/\/example\.edu/i);
  });

  it('removes trailing question mark when no params remain', () => {
    const result = canonicalizeUrl('https://example.edu/prog?utm_source=x');
    expect(result).not.toContain('?');
  });

  it('sorts remaining params deterministically', () => {
    const a = canonicalizeUrl('https://example.edu/prog?z=1&a=2');
    const b = canonicalizeUrl('https://example.edu/prog?a=2&z=1');
    expect(a).toBe(b);
  });
});

describe('canonicalizeOfficialProgrammeUrl', () => {
  it('accepts HTTPS URLs on an approved domain or subdomain', () => {
    expect(
      canonicalizeOfficialProgrammeUrl(
        'https://catalog.example.edu/program?utm_source=test',
        ['example.edu']
      )
    ).toBe('https://catalog.example.edu/program');
  });

  it('rejects HTTP, credentials, IPs, ports and unrelated domains', () => {
    const domains = ['example.edu'];
    expect(() =>
      canonicalizeOfficialProgrammeUrl('http://example.edu/program', domains)
    ).toThrow();
    expect(() =>
      canonicalizeOfficialProgrammeUrl(
        'https://user:pass@example.edu/program',
        domains
      )
    ).toThrow();
    expect(() =>
      canonicalizeOfficialProgrammeUrl('https://127.0.0.1/program', domains)
    ).toThrow();
    expect(() =>
      canonicalizeOfficialProgrammeUrl(
        'https://example.edu:8443/program',
        domains
      )
    ).toThrow();
    expect(() =>
      canonicalizeOfficialProgrammeUrl('https://evil.example/program', domains)
    ).toThrow();
  });
});
