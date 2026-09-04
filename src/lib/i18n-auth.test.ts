import { describe, expect, it } from 'vitest';
import { AUTH_TRANSLATIONS } from './i18n-auth';
import { translations } from './i18n-catalog';
import { AUTH_ERROR_MESSAGES } from '@/features/auth/domain';

/**
 * These guard the one failure mode this design has.
 *
 * `t()` keys on the English source string and falls back to English when a key
 * is missing, so a typo in a catalog key does not throw, does not warn, and
 * does not show up in a typecheck — the message simply stays English for
 * Vietnamese users. Only a test comparing the two sides catches it.
 */
describe('auth error catalog', () => {
  it('translates every error the auth routes can return', () => {
    const missing = Object.entries(AUTH_ERROR_MESSAGES)
      .filter(([, english]) => !(english in AUTH_TRANSLATIONS))
      .map(([code]) => code);
    expect(missing).toEqual([]);
  });

  it('is reachable through the merged runtime catalog, not just its own module', () => {
    // A catalog file nobody spreads into `translations` is dead weight.
    for (const english of Object.values(AUTH_ERROR_MESSAGES)) {
      expect(translations[english]).toBeDefined();
    }
  });

  it('keeps every {placeholder} in the Vietnamese text', () => {
    // A translation that drops `{min}` renders "ít nhất ký tự" — grammatical,
    // and missing the number the whole message exists to communicate.
    const placeholders = (s: string) => (s.match(/\{(\w+)\}/g) ?? []).sort();
    const broken: string[] = [];
    for (const [english, vietnamese] of Object.entries(AUTH_TRANSLATIONS)) {
      const want = placeholders(english);
      if (want.length > 0 && placeholders(vietnamese).join() !== want.join()) broken.push(english);
    }
    expect(broken).toEqual([]);
  });

  it('actually translates — no entry left as a copy of the English', () => {
    const untranslated = Object.entries(AUTH_TRANSLATIONS)
      .filter(([english, vietnamese]) => english === vietnamese)
      .map(([english]) => english);
    expect(untranslated).toEqual([]);
  });
});
