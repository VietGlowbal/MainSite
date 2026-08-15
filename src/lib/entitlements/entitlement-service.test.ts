import { describe, expect, it } from 'vitest';
import { isPlusEntitlementActive } from './entitlement-service';

describe('Plus entitlement expiry', () => {
  it('requires both plus status and a future expiry', () => {
    expect(isPlusEntitlementActive({ plus_status: true, plus_expires_at: '2999-01-01T00:00:00.000Z' }, new Date('2026-01-01'))).toBe(true);
    expect(isPlusEntitlementActive({ plus_status: true, plus_expires_at: '2025-01-01T00:00:00.000Z' }, new Date('2026-01-01'))).toBe(false);
    expect(isPlusEntitlementActive({ plus_status: true, plus_expires_at: null }, new Date('2026-01-01'))).toBe(false);
  });
});
