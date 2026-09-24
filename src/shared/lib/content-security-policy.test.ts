import { describe, expect, it } from 'vitest';

import { buildContentSecurityPolicy, createNonce } from './content-security-policy';

function directive(policy: string, name: string): string | undefined {
  return policy
    .split(';')
    .map((part) => part.trim())
    .find((part) => part === name || part.startsWith(`${name} `));
}

describe('createNonce', () => {
  it('is base64 of 16 random bytes and never repeats', () => {
    const nonces = new Set(Array.from({ length: 200 }, () => createNonce()));
    expect(nonces.size).toBe(200);
    for (const nonce of nonces) {
      expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    }
  });
});

describe('buildContentSecurityPolicy', () => {
  const production = buildContentSecurityPolicy({ nonce: 'abc123', isDev: false });

  it('enforces script-src with the nonce and strict-dynamic', () => {
    const scriptSrc = directive(production.enforced, 'script-src');
    expect(scriptSrc).toContain("'nonce-abc123'");
    expect(scriptSrc).toContain("'strict-dynamic'");
    expect(production.nonce).toBe('abc123');
  });

  it('has no unsafe-inline or scheme fallback in script-src', () => {
    // Security review 2026-09-14: "unsafe-inline, unsafe-eval still active".
    const scriptSrc = directive(production.enforced, 'script-src');
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toMatch(/\shttps?:(\s|$)/);
  });

  it('allows eval only in development', () => {
    expect(production.enforced).not.toContain("'unsafe-eval'");
    expect(production.reportOnly).not.toContain("'unsafe-eval'");
    const dev = buildContentSecurityPolicy({ nonce: 'abc123', isDev: true });
    expect(directive(dev.enforced, 'script-src')).toContain("'unsafe-eval'");
  });

  it('enforces the script, framing and upgrade directives', () => {
    expect(directive(production.enforced, 'object-src')).toBe("object-src 'none'");
    expect(directive(production.enforced, 'base-uri')).toBe("base-uri 'self'");
    expect(directive(production.enforced, 'frame-ancestors')).toBe("frame-ancestors 'self'");
    expect(directive(production.enforced, 'upgrade-insecure-requests')).toBeDefined();
  });

  it('keeps upgrade-insecure-requests out of report-only, where browsers ignore it', () => {
    expect(directive(production.reportOnly, 'upgrade-insecure-requests')).toBeUndefined();
  });

  it('leaves the unverified origin allowlists report-only', () => {
    // Enforcing a wrong image or Supabase origin breaks a page for every
    // visitor; these have never been checked against real traffic.
    for (const name of ['default-src', 'img-src', 'connect-src', 'frame-src', 'style-src', 'form-action']) {
      expect(directive(production.enforced, name), name).toBeUndefined();
      expect(directive(production.reportOnly, name), name).toBeDefined();
    }
  });

  it('repeats script-src in report-only so it does not report every script', () => {
    expect(directive(production.reportOnly, 'script-src')).toBe(directive(production.enforced, 'script-src'));
  });
});
