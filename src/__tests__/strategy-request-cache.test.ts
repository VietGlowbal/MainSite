import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('strategy request memoization', () => {
  it('deduplicates nav/page reads in a real RSC render and refreshes on the next request', () => {
    // An isolated process uses Next's server React and RSC renderer. Ordinary
    // client React tests deliberately do not enable the server cache dispatcher.
    const output = execFileSync(process.execPath, ['src/__tests__/fixtures/strategy-request-cache.mjs', '--assert'], {
      cwd: process.cwd(), encoding: 'utf8', timeout: 15000,
    });
    expect(JSON.parse(output)).toEqual({
      firstRequestReads: 5, secondRequestReads: 5, separateAppReads: 10, separateUserReads: 10,
      readyFirst: true, readyNext: false,
    });
  });
});
