import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * What these tests are actually protecting.
 *
 * The route's security properties are all in the ORDER it does things, and none
 * of them are visible from a type signature:
 *
 *   * the session is re-verified server-side before anything else happens;
 *   * a Google-only account never reaches the password check;
 *   * the attempt limiter sits between "well-formed" and "verified", so typos
 *     do not spend the budget and a wordlist cannot pump HIBP requests;
 *   * a wrong current password is reported without changing anything;
 *   * a failed notification email never turns a successful change into an error.
 *
 * Every one of those is a silent regression if it breaks — the endpoint still
 * returns 200 and still changes the password.
 */
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  changeOwnPassword: vi.fn(),
  checkPasswordBreach: vi.fn(),
  checkLimit: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: mocks.getUser } }),
}));

vi.mock('@/features/auth/api', () => ({
  changeOwnPassword: mocks.changeOwnPassword,
  checkPasswordBreach: mocks.checkPasswordBreach,
}));

vi.mock('@/lib/rate-limiter', () => ({
  passwordChangeLimiter: { checkLimit: mocks.checkLimit },
}));

vi.mock('@/lib/send-email', () => ({ sendEmail: mocks.sendEmail }));

import { POST } from './route';

const USER = {
  id: 'user-1',
  email: 'student@example.com',
  identities: [{ provider: 'email' }],
  user_metadata: { full_name: 'Linh Tran' },
};

const CURRENT = 'old-password-1';
const NEXT = 'a-much-better-passphrase';

function request(body: unknown) {
  return new NextRequest('https://glowbal.test/api/account/password', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/account/password', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: USER } });
    mocks.checkLimit.mockReturnValue({ allowed: true });
    mocks.checkPasswordBreach.mockResolvedValue({ status: 'clean' });
    mocks.changeOwnPassword.mockResolvedValue({ status: 'ok' });
    mocks.sendEmail.mockResolvedValue({ ok: true, messageId: 'm1' });
  });

  it('changes the password and confirms it by email', async () => {
    const response = await POST(request({ currentPassword: CURRENT, newPassword: NEXT }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mocks.changeOwnPassword).toHaveBeenCalledWith({
      // The address comes from the verified session, never from the body.
      email: USER.email,
      currentPassword: CURRENT,
      newPassword: NEXT,
    });
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: USER.email, template: 'password-changed' }),
    );
  });

  it('refuses an unauthenticated caller', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });

    const response = await POST(request({ currentPassword: CURRENT, newPassword: NEXT }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: 'not_signed_in' });
    expect(mocks.changeOwnPassword).not.toHaveBeenCalled();
  });

  it('will not touch a Google-only account', async () => {
    // There is no password to verify, so accepting this would mean setting one
    // on the strength of the session alone — permanent access from borrowed
    // access. The UI offers the emailed link instead.
    mocks.getUser.mockResolvedValue({
      data: { user: { ...USER, identities: [{ provider: 'google' }] } },
    });

    const response = await POST(request({ currentPassword: '', newPassword: NEXT }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'password_not_set' });
    expect(mocks.changeOwnPassword).not.toHaveBeenCalled();
  });

  it('rejects a weak new password without spending an attempt', async () => {
    const response = await POST(request({ currentPassword: CURRENT, newPassword: 'short' }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: 'password_too_short',
      vars: { min: 8 },
    });
    expect(mocks.checkLimit).not.toHaveBeenCalled();
    expect(mocks.checkPasswordBreach).not.toHaveBeenCalled();
  });

  it('rejects reusing the current password', async () => {
    const response = await POST(request({ currentPassword: CURRENT, newPassword: CURRENT }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'password_unchanged' });
    expect(mocks.changeOwnPassword).not.toHaveBeenCalled();
  });

  it('stops a guessing run before it reaches Supabase or HIBP', async () => {
    mocks.checkLimit.mockReturnValue({ allowed: false });

    const response = await POST(request({ currentPassword: 'guess-one-two', newPassword: NEXT }));

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toMatchObject({ code: 'rate_limited' });
    expect(mocks.checkLimit).toHaveBeenCalledWith(`user:${USER.id}`);
    expect(mocks.checkPasswordBreach).not.toHaveBeenCalled();
    expect(mocks.changeOwnPassword).not.toHaveBeenCalled();
  });

  it('rejects a breached new password', async () => {
    mocks.checkPasswordBreach.mockResolvedValue({ status: 'breached', count: 9659364 });

    const response = await POST(request({ currentPassword: CURRENT, newPassword: NEXT }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'password_breached' });
    expect(mocks.changeOwnPassword).not.toHaveBeenCalled();
  });

  it('goes ahead when the breach check is unavailable — it fails open', async () => {
    // Same call as sign-up and reset: HIBP being down must not lock a user out
    // of rotating a password they think is compromised.
    mocks.checkPasswordBreach.mockResolvedValue({ status: 'unavailable', reason: 'timeout' });

    const response = await POST(request({ currentPassword: CURRENT, newPassword: NEXT }));

    expect(response.status).toBe(200);
    expect(mocks.changeOwnPassword).toHaveBeenCalled();
  });

  it('reports a wrong current password and sends no email', async () => {
    mocks.changeOwnPassword.mockResolvedValue({ status: 'wrong_password' });

    const response = await POST(request({ currentPassword: 'not-my-password', newPassword: NEXT }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'current_password_incorrect' });
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it('still reports success when the notification email fails', async () => {
    // The password IS changed by that point. Reporting failure would send the
    // user round again, and the retry would be rejected as `password_unchanged`.
    mocks.sendEmail.mockResolvedValue({ ok: false, error: 'resend down' });

    const response = await POST(request({ currentPassword: CURRENT, newPassword: NEXT }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it('survives a notification that throws', async () => {
    mocks.sendEmail.mockRejectedValue(new Error('boom'));

    const response = await POST(request({ currentPassword: CURRENT, newPassword: NEXT }));

    expect(response.status).toBe(200);
  });

  it('rejects a malformed body before authenticating', async () => {
    const response = await POST(
      new NextRequest('https://glowbal.test/api/account/password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'not json',
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'invalid_json' });
    expect(mocks.getUser).not.toHaveBeenCalled();
  });
});
