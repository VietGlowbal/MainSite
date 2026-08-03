import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('LOR AI rate limit', () => {
  it('allows repeated requests while testing in development', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const { lorAiLimiter } = await import('./rate-limiter');

    for (let attempt = 0; attempt < 10; attempt += 1) {
      expect(lorAiLimiter.checkLimit('test-user').allowed).toBe(true);
    }

    lorAiLimiter.destroy();
  });
});
