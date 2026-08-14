import { describe, expect, it } from 'vitest';
import { ENGINE_VERSION, shouldRegenerate } from './versioning';

describe('shouldRegenerate', () => {
  it('regenerates when nothing has been stored yet', () => {
    expect(shouldRegenerate({ inputHash: 'abc' }, null)).toBe(true);
  });

  it('does not regenerate when the input and engine version both match', () => {
    expect(
      shouldRegenerate(
        { inputHash: 'abc' },
        { inputHash: 'abc', engineVersion: ENGINE_VERSION },
      ),
    ).toBe(false);
  });

  it('regenerates when the input hash has changed', () => {
    expect(
      shouldRegenerate(
        { inputHash: 'new-hash' },
        { inputHash: 'old-hash', engineVersion: ENGINE_VERSION },
      ),
    ).toBe(true);
  });

  it('regenerates when the engine version is stale even if the input has not changed', () => {
    expect(
      shouldRegenerate(
        { inputHash: 'abc' },
        { inputHash: 'abc', engineVersion: '0.0.1' },
      ),
    ).toBe(true);
  });
});
