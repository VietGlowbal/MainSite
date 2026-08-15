import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isPaymentAdmin } from './auth-helpers';

vi.mock('@/server/db/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
        }),
      }),
    }),
  }),
}));

describe('isPaymentAdmin', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('recognizes founder Khánh Linh Nguyễn by ID', async () => {
    const result = await isPaymentAdmin('a8bccd1d-dcbc-409e-879c-90c483a7c3a1', 'random@example.com');
    expect(result).toBe(true);
  });

  it('recognizes founder Khánh Linh Nguyễn by email', async () => {
    const result = await isPaymentAdmin('some-other-uuid', 'khanhlinh05.work@gmail.com');
    expect(result).toBe(true);
  });

  it('recognizes founder taduchien314@gmail.com by email', async () => {
    const result = await isPaymentAdmin('some-other-uuid', 'taduchien314@gmail.com');
    expect(result).toBe(true);
  });

  it('recognizes founder VinUniversity by ID', async () => {
    const result = await isPaymentAdmin('39539b5e-842d-4bf0-aaa9-9611e411700f', 'random@example.com');
    expect(result).toBe(true);
  });

  it('recognizes founder VinUniversity by email', async () => {
    const result = await isPaymentAdmin('some-other-uuid', 'linhnk0505@gmail.com');
    expect(result).toBe(true);
  });



  it('recognizes user in MANUAL_PAYMENT_REVIEWER_USER_IDS', async () => {
    process.env.MANUAL_PAYMENT_REVIEWER_USER_IDS = '91056608-5d63-4dc3-9f7e-fbd48e4f3b84,11111111-2222-3333-4444-555555555555';
    const result = await isPaymentAdmin('11111111-2222-3333-4444-555555555555', 'admin@example.com');
    expect(result).toBe(true);
  });

  it('recognizes email matching MANUAL_PAYMENT_FOUNDER_EMAIL', async () => {
    process.env.MANUAL_PAYMENT_FOUNDER_EMAIL = 'customfounder@glowbal.vn';
    const result = await isPaymentAdmin('some-uuid', 'customfounder@glowbal.vn');
    expect(result).toBe(true);
  });

  it('rejects regular admins who are not payment admins/founder', async () => {
    process.env.MANUAL_PAYMENT_REVIEWER_USER_IDS = 'a8bccd1d-dcbc-409e-879c-90c483a7c3a1';
    process.env.MANUAL_PAYMENT_FOUNDER_EMAIL = 'khanhlinh05.work@gmail.com';
    const result = await isPaymentAdmin('33333333-3333-3333-3333-333333333333', 'regularadmin@glowbal.vn');
    expect(result).toBe(false);
  });
});
