import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveAuthOrigin } from './auth-origin';

afterEach(() => vi.unstubAllEnvs());

describe('resolveAuthOrigin', () => {
  it('keeps a local callback on its request origin even when a production URL is configured', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://glowbal-education.com');

    expect(resolveAuthOrigin('http://localhost:3000')).toBe('http://localhost:3000');
  });

  it('uses the configured canonical origin in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://glowbal-education.com/');

    expect(resolveAuthOrigin('https://main-site-seven-opal.vercel.app')).toBe('https://glowbal-education.com');
  });
});
