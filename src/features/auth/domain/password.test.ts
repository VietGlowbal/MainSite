import { describe, expect, it } from 'vitest';
import {
  countBreaches,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  splitHashForRange,
  validatePassword,
} from './password';

describe('validatePassword', () => {
  it('rejects the passwords the old min(6) floor let through', () => {
    // The whole reason the floor moved: these all passed before 2026-09-04 and
    // `123456` is the most common breached password in existence.
    expect(validatePassword('123456')?.code).toBe('password_too_short');
    expect(validatePassword('abc')?.code).toBe('password_too_short');
    expect(validatePassword('1234567')?.code).toBe('password_too_short');
  });

  it('accepts at exactly the minimum, not one below', () => {
    expect(validatePassword('a'.repeat(PASSWORD_MIN_LENGTH - 1))?.code).toBe(
      'password_too_short',
    );
    expect(validatePassword('a'.repeat(PASSWORD_MIN_LENGTH))).toBeNull();
  });

  it('accepts at exactly the maximum, not one above', () => {
    expect(validatePassword('a'.repeat(PASSWORD_MAX_LENGTH))).toBeNull();
    expect(validatePassword('a'.repeat(PASSWORD_MAX_LENGTH + 1))?.code).toBe('password_too_long');
  });

  it('treats a whitespace-only password as blank rather than long enough', () => {
    expect(validatePassword('         ')?.code).toBe('password_blank');
    expect(validatePassword('')?.code).toBe('password_blank');
  });

  it('does NOT trim — surrounding spaces are real characters in a passphrase', () => {
    // Trimming would store a different string than the user typed, and they
    // would then fail to sign in with the exact password they chose.
    expect(validatePassword('  a passphrase  ')).toBeNull();
  });

  it('imposes no composition rules', () => {
    // NIST SP 800-63B withdrew that advice; length plus the breach check is the
    // policy. A long all-lowercase passphrase is fine.
    expect(validatePassword('correct horse battery staple')).toBeNull();
  });

  it('carries the limit as a var so the message stays translatable', () => {
    // The number must NOT be baked into the sentence: the English text is the
    // i18n key, and a key containing `8` would miss the moment the floor moves.
    expect(validatePassword('short')?.vars).toEqual({ min: PASSWORD_MIN_LENGTH });
    expect(validatePassword('a'.repeat(PASSWORD_MAX_LENGTH + 1))?.vars).toEqual({
      max: PASSWORD_MAX_LENGTH,
    });
    expect(validatePassword('')?.vars).toBeUndefined();
  });
});

describe('splitHashForRange', () => {
  it('sends five characters and keeps the other thirty-five', () => {
    // SHA-1('password'). Only the prefix is ever transmitted.
    const { prefix, suffix } = splitHashForRange('5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8');
    expect(prefix).toBe('5BAA6');
    expect(suffix).toBe('1E4C9B93F3F0682250B6CF8331B7EE68FD8');
    expect(prefix).toHaveLength(5);
    expect(suffix).toHaveLength(35);
  });

  it('uppercases, because HIBP indexes uppercase', () => {
    expect(splitHashForRange('5baa61e4c9b93f3f0682250b6cf8331b7ee68fd8').prefix).toBe('5BAA6');
  });
});

describe('countBreaches', () => {
  const SUFFIX = '1E4C9B93F3F0682250B6CF8331B7EE68FD8';

  it('finds the suffix and returns its count', () => {
    expect(countBreaches(`${SUFFIX}:9659364\r\nAAAAAAAA:3`, SUFFIX)).toBe(9659364);
  });

  it('returns 0 when the suffix is absent', () => {
    expect(countBreaches('0018A45C4D1DEF81644B54AB7F969B88D65:1\r\nAAAA:2', SUFFIX)).toBe(0);
  });

  it('treats a zero count as PADDING, not as a breach', () => {
    // We request Add-Padding, so HIBP injects synthetic zero-count rows to stop
    // the response size leaking how many real matches the prefix had. Counting
    // one as a hit would reject good passwords at random.
    expect(countBreaches(`${SUFFIX}:0`, SUFFIX)).toBe(0);
  });

  it('matches case-insensitively', () => {
    expect(countBreaches(`${SUFFIX.toLowerCase()}:42`, SUFFIX)).toBe(42);
  });

  it('survives blank lines, LF-only endings and malformed rows', () => {
    expect(countBreaches(`\n\nnot-a-row\n${SUFFIX}:7\n`, SUFFIX)).toBe(7);
  });

  it('returns 0 for an unparseable count rather than NaN', () => {
    expect(countBreaches(`${SUFFIX}:not-a-number`, SUFFIX)).toBe(0);
  });

  it('returns 0 for an empty body', () => {
    expect(countBreaches('', SUFFIX)).toBe(0);
  });
});
