import { describe, expect, it } from 'vitest';
import {
  AUTH_ERROR_MESSAGES,
  authErrorBody,
  authErrorFromResponse,
  authErrorText,
  formatAuthError,
  isAuthErrorCode,
} from './errors';

/** Stand-in for `t()`: pretends everything is translated by prefixing. */
const fakeT = (en: string, vars?: Record<string, string | number>) =>
  'VI:' + en.replace(/\{(\w+)\}/g, (_m, k: string) => (vars && k in vars ? String(vars[k]) : `{${k}}`));

describe('formatAuthError', () => {
  it('interpolates vars into the template', () => {
    expect(formatAuthError('password_too_short', { min: 8 })).toBe(
      'Password must be at least 8 characters.',
    );
  });

  it('leaves an unknown placeholder visible rather than printing undefined', () => {
    expect(formatAuthError('password_too_short', { nope: 1 })).toContain('{min}');
  });

  it('returns the template untouched when there are no vars', () => {
    expect(formatAuthError('password_breached')).toBe(AUTH_ERROR_MESSAGES.password_breached);
  });
});

describe('authErrorBody', () => {
  it('sends the code AND pre-interpolated English', () => {
    // The English is for curl, logs and tests; the code is what the UI renders.
    expect(authErrorBody('password_too_short', { min: 8 })).toEqual({
      error: 'Password must be at least 8 characters.',
      code: 'password_too_short',
      vars: { min: 8 },
    });
  });

  it('omits vars entirely when there are none', () => {
    const body = authErrorBody('email_exists');
    expect(body).not.toHaveProperty('vars');
    expect(body.code).toBe('email_exists');
  });
});

describe('authErrorFromResponse', () => {
  it('prefers the code, and keeps its vars', () => {
    expect(
      authErrorFromResponse({ error: 'ignored', code: 'password_too_short', vars: { min: 8 } }, 'fb'),
    ).toEqual({ code: 'password_too_short', vars: { min: 8 } });
  });

  it('falls back to a plain English error from a route not on the contract', () => {
    expect(authErrorFromResponse({ error: 'Legacy message' }, 'fb')).toEqual({
      text: 'Legacy message',
    });
  });

  it('ignores a code it does not recognise', () => {
    expect(authErrorFromResponse({ error: 'x', code: 'not_a_real_code' }, 'fb')).toEqual({
      text: 'x',
    });
  });

  it('survives null, a string, and an empty body', () => {
    expect(authErrorFromResponse(null, 'fb')).toEqual({ text: 'fb' });
    expect(authErrorFromResponse('boom', 'fb')).toEqual({ text: 'fb' });
    expect(authErrorFromResponse({}, 'fb')).toEqual({ text: 'fb' });
    expect(authErrorFromResponse({ error: '' }, 'fb')).toEqual({ text: 'fb' });
  });
});

describe('authErrorText', () => {
  it('translates a coded error through t, interpolating after translation', () => {
    // This is the property that makes the language switcher work: the stored
    // value is a code, so re-rendering with a different `t` yields a different
    // language without re-submitting the form.
    expect(authErrorText({ code: 'password_too_short', vars: { min: 8 } }, fakeT)).toBe(
      'VI:Password must be at least 8 characters.',
    );
  });

  it('still routes an uncoded message through t', () => {
    expect(authErrorText({ text: 'Invalid login credentials' }, fakeT)).toBe(
      'VI:Invalid login credentials',
    );
  });
});

describe('isAuthErrorCode', () => {
  it('accepts every code it claims to know and nothing else', () => {
    for (const code of Object.keys(AUTH_ERROR_MESSAGES)) expect(isAuthErrorCode(code)).toBe(true);
    expect(isAuthErrorCode('toString')).toBe(false);
    expect(isAuthErrorCode(undefined)).toBe(false);
    expect(isAuthErrorCode(42)).toBe(false);
  });
});
