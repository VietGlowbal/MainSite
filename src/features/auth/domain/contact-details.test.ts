import { describe, expect, it } from 'vitest';
import {
  ageOn,
  contactDetailsComplete,
  isRealCalendarDate,
  normalizePhone,
  safeInternalPath,
  validateContactDetails,
} from './contact-details';

const NOW = new Date('2026-08-17T00:00:00Z');

describe('contactDetailsComplete', () => {
  it('treats a blank phone as missing, not present', () => {
    // The whole reason the predicate exists: the sign-up route wrote '' for
    // absent fields, so 19 rows are NOT NULL but only 16 hold a number.
    expect(contactDetailsComplete({ phone: '', date_of_birth: '2002-08-09' })).toBe(false);
    expect(contactDetailsComplete({ phone: '   ', date_of_birth: '2002-08-09' })).toBe(false);
  });

  it('treats a null row or null fields as missing', () => {
    expect(contactDetailsComplete(null)).toBe(false);
    expect(contactDetailsComplete(undefined)).toBe(false);
    expect(contactDetailsComplete({ phone: null, date_of_birth: null })).toBe(false);
  });

  it('needs both fields, not either', () => {
    expect(contactDetailsComplete({ phone: '+84912345678', date_of_birth: null })).toBe(false);
    expect(contactDetailsComplete({ phone: null, date_of_birth: '2002-08-09' })).toBe(false);
    expect(contactDetailsComplete({ phone: '+84912345678', date_of_birth: '2002-08-09' })).toBe(true);
  });
});

describe('normalizePhone', () => {
  it('promotes a Vietnamese national number to +84', () => {
    expect(normalizePhone('0912345678')).toBe('+84912345678');
    expect(normalizePhone('0912 345 678')).toBe('+84912345678');
  });

  it('leaves an explicit country code alone', () => {
    expect(normalizePhone('+84 90 765 4321')).toBe('+84907654321');
    expect(normalizePhone('+44 20 7946 0000')).toBe('+442079460000');
  });

  it('rejects what cannot be a phone number', () => {
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone('   ')).toBeNull();
    expect(normalizePhone('abc')).toBeNull();
    expect(normalizePhone('12345')).toBeNull();
    expect(normalizePhone('1234567890123456')).toBeNull();
  });
});

describe('ageOn', () => {
  it('does not count a birthday that has not happened yet this year', () => {
    expect(ageOn('2002-08-16', NOW)).toBe(24);
    expect(ageOn('2002-08-17', NOW)).toBe(24);
    expect(ageOn('2002-08-18', NOW)).toBe(23);
  });
});

describe('validateContactDetails', () => {
  const valid = { full_name: 'Nguyễn Văn A', phone: '0912345678', date_of_birth: '2002-08-09' };

  it('accepts a complete, plausible submission', () => {
    expect(validateContactDetails(valid, NOW)).toEqual({});
  });

  it('rejects each blank field', () => {
    expect(validateContactDetails({ ...valid, full_name: '  ' }, NOW).full_name).toBeDefined();
    expect(validateContactDetails({ ...valid, phone: '' }, NOW).phone).toBeDefined();
    expect(validateContactDetails({ ...valid, date_of_birth: '' }, NOW).date_of_birth).toBeDefined();
  });

  it('rejects a future date of birth', () => {
    expect(validateContactDetails({ ...valid, date_of_birth: '2027-01-01' }, NOW).date_of_birth).toBeDefined();
  });

  it('rejects ages outside the plausible applicant range', () => {
    expect(validateContactDetails({ ...valid, date_of_birth: '2020-01-01' }, NOW).date_of_birth).toBeDefined();
    expect(validateContactDetails({ ...valid, date_of_birth: '1900-01-01' }, NOW).date_of_birth).toBeDefined();
  });

  it('rejects a malformed date', () => {
    expect(validateContactDetails({ ...valid, date_of_birth: '09/08/2002' }, NOW).date_of_birth).toBeDefined();
    expect(validateContactDetails({ ...valid, date_of_birth: '2002-13-45' }, NOW).date_of_birth).toBeDefined();
  });

  it('rejects a well-formed date of a day that does not exist', () => {
    // Date.parse would accept these by normalising them; Postgres would not,
    // and the student would meet a 500 instead of a field error.
    expect(validateContactDetails({ ...valid, date_of_birth: '2002-02-30' }, NOW).date_of_birth).toBeDefined();
    expect(validateContactDetails({ ...valid, date_of_birth: '2001-02-29' }, NOW).date_of_birth).toBeDefined();
  });
});

describe('isRealCalendarDate', () => {
  it('accepts real days, including a genuine leap day', () => {
    expect(isRealCalendarDate('2002-08-09')).toBe(true);
    expect(isRealCalendarDate('2000-02-29')).toBe(true);
    expect(isRealCalendarDate('2004-02-29')).toBe(true);
  });

  it('rejects days that do not exist, which Date.parse silently rolls over', () => {
    expect(Number.isNaN(Date.parse('2002-02-30'))).toBe(false); // the trap itself
    expect(isRealCalendarDate('2002-02-30')).toBe(false);
    expect(isRealCalendarDate('2001-02-29')).toBe(false);
    expect(isRealCalendarDate('1900-02-29')).toBe(false);
    expect(isRealCalendarDate('2002-04-31')).toBe(false);
    expect(isRealCalendarDate('2002-13-01')).toBe(false);
    expect(isRealCalendarDate('2002-00-10')).toBe(false);
  });
});

describe('safeInternalPath', () => {
  it('keeps an ordinary same-origin path', () => {
    expect(safeInternalPath('/apply', '/fallback')).toBe('/apply');
    expect(safeInternalPath('/my-universities/program?tier=reach', '/fallback')).toBe(
      '/my-universities/program?tier=reach',
    );
  });

  it('rejects protocol-relative targets that would leave the origin', () => {
    // Both begin with '/', which a naive startsWith check would wave through.
    expect(safeInternalPath('//attacker.example', '/fallback')).toBe('/fallback');
    expect(safeInternalPath('/\\attacker.example', '/fallback')).toBe('/fallback');
  });

  it('rejects absolute URLs and non-paths', () => {
    expect(safeInternalPath('https://attacker.example', '/fallback')).toBe('/fallback');
    expect(safeInternalPath('apply', '/fallback')).toBe('/fallback');
    expect(safeInternalPath(undefined, '/fallback')).toBe('/fallback');
    expect(safeInternalPath(null, '/fallback')).toBe('/fallback');
  });

  it('refuses to bounce back into the gate that produced it', () => {
    expect(safeInternalPath('/auth', '/fallback')).toBe('/fallback');
    expect(safeInternalPath('/auth/complete-profile', '/fallback')).toBe('/fallback');
    expect(safeInternalPath('/auth?redirect=/apply', '/fallback')).toBe('/fallback');
  });
});
