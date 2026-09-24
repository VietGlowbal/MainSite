import { describe, expect, it } from 'vitest';

import { supabaseAuthCookieOptions } from './supabase-auth-cookie';

describe('Supabase auth cookie options', () => {
  it('adds Secure only when asked to', () => {
    expect(supabaseAuthCookieOptions(true).secure).toBe(true);
    expect(supabaseAuthCookieOptions(false).secure).toBe(false);
  });

  it('stays SameSite=Lax — Strict drops the session on the Google OAuth return', () => {
    expect(supabaseAuthCookieOptions(true).sameSite).toBe('lax');
  });

  it('never sets httpOnly, name or maxAge', () => {
    // httpOnly hides the session from createBrowserClient; a name renames the
    // cookie and signs everyone out. See the header of supabase-auth-cookie.ts.
    const options = supabaseAuthCookieOptions(true);
    expect(options).not.toHaveProperty('httpOnly');
    expect(options).not.toHaveProperty('name');
    expect(options).not.toHaveProperty('maxAge');
    expect(options.path).toBe('/');
  });
});
