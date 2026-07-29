import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Node TLS runtime', () => {
  it('starts every Next.js runtime with the trusted system CA store', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));

    for (const script of ['dev', 'start']) {
      expect(packageJson.scripts[script], script).toMatch(
        /^node --use-system-ca node_modules\/next\/dist\/bin\/next /,
      );
    }
    expect(packageJson.scripts.build).toBe('next build');
  });
});
