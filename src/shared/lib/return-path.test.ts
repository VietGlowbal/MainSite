import { describe, expect, it } from 'vitest';
import { isAllowedInternalReturnPath } from './return-path';

describe('isAllowedInternalReturnPath', () => {
  it('allows plain internal relative paths, with or without a query/hash', () => {
    expect(isAllowedInternalReturnPath('/ai-strategy/reflection/achievements')).toBe(true);
    expect(isAllowedInternalReturnPath('/apply/abc-123')).toBe(true);
    expect(isAllowedInternalReturnPath('/profile?tab=academic')).toBe(true);
    expect(isAllowedInternalReturnPath('/profile#section')).toBe(true);
    expect(isAllowedInternalReturnPath('/')).toBe(true);
  });

  it('rejects empty, missing, or non-relative values', () => {
    expect(isAllowedInternalReturnPath(undefined)).toBe(false);
    expect(isAllowedInternalReturnPath(null)).toBe(false);
    expect(isAllowedInternalReturnPath('')).toBe(false);
    expect(isAllowedInternalReturnPath('ai-strategy/reflection')).toBe(false);
  });

  it('rejects protocol-relative paths that browsers resolve to an external host', () => {
    expect(isAllowedInternalReturnPath('//evil.com')).toBe(false);
    expect(isAllowedInternalReturnPath('//evil.com/phish')).toBe(false);
    expect(isAllowedInternalReturnPath('/\\evil.com')).toBe(false);
  });

  it('rejects an absolute scheme URL disguised as a relative path', () => {
    expect(isAllowedInternalReturnPath('/javascript:alert(1)')).toBe(false);
    expect(isAllowedInternalReturnPath('/https://evil.com')).toBe(false);
  });

  it('allows a colon that only appears after the first path segment (not a scheme)', () => {
    expect(isAllowedInternalReturnPath('/apply/abc?next=https://evil.com')).toBe(true);
  });
});
