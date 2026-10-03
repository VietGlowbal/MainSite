import { describe, expect, it } from 'vitest';
import {
  consultationNotes,
  firstInvalidField,
  formatDateOfBirthInput,
  parseDateOfBirth,
  validateConsultation,
  type ConsultationInput,
} from './consultation';

const NOW = new Date(Date.UTC(2026, 8, 27));

const VALID: ConsultationInput = {
  name: '  Trần Minh Khoa ',
  dob: '14/03/2008',
  email: 'MinhKhoa.Tran@Example.com',
  dialCode: 'VN',
  phone: '912 345 678',
  destination: 'United Kingdom',
  budget: '300-500m',
  package: 'yearly',
  consent: true,
};

describe('validateConsultation', () => {
  it('accepts a complete request and normalises it for storage', () => {
    const result = validateConsultation(VALID, NOW);
    expect(result).toEqual({
      ok: true,
      request: {
        name: 'Trần Minh Khoa',
        dateOfBirth: '2008-03-14',
        email: 'minhkhoa.tran@example.com',
        dialCode: 'VN',
        phone: '912 345 678',
        destination: 'United Kingdom',
        budget: '300-500m',
        package: 'yearly',
      },
    });
  });

  it('reports every required field that is empty, and missing consent', () => {
    const result = validateConsultation(
      { ...VALID, name: ' ', dob: '', email: '', phone: '', destination: '', consent: false },
      NOW,
    );
    expect(result).toEqual({
      ok: false,
      errors: {
        name: 'required',
        dob: 'required',
        email: 'required',
        phone: 'required',
        destination: 'required',
        consent: 'consent',
      },
    });
  });

  it('keeps budget and package optional', () => {
    const result = validateConsultation({ ...VALID, budget: '', package: '' }, NOW);
    expect(result.ok && result.request.budget).toBeNull();
    expect(result.ok && result.request.package).toBeNull();
  });

  it('drops an unknown budget, package or dial code instead of storing it', () => {
    const result = validateConsultation({ ...VALID, budget: 'lots', package: 'gold', dialCode: 'ZZ' }, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.request.budget).toBeNull();
    expect(result.request.package).toBeNull();
    expect(result.request.dialCode).toBe('VN');
  });

  it('flags a malformed email with its own code', () => {
    expect(validateConsultation({ ...VALID, email: 'minhkhoa.tran@gmail' }, NOW)).toEqual({
      ok: false,
      errors: { email: 'email' },
    });
  });

  it('flags a phone number too short to call', () => {
    expect(validateConsultation({ ...VALID, phone: '12-34' }, NOW)).toEqual({
      ok: false,
      errors: { phone: 'phone' },
    });
  });

  it.each([['31/02/2008'], ['14-03-2008'], ['14/03/2031'], ['01/01/1899']])(
    'rejects %s as a date of birth',
    (dob) => {
      expect(validateConsultation({ ...VALID, dob }, NOW)).toEqual({ ok: false, errors: { dob: 'dob' } });
    },
  );
});

describe('parseDateOfBirth', () => {
  it('turns dd/mm/yyyy into an ISO date', () => {
    expect(parseDateOfBirth('29/02/2008', NOW)).toBe('2008-02-29');
  });

  it('refuses a day that does not exist', () => {
    expect(parseDateOfBirth('29/02/2007', NOW)).toBeNull();
  });
});

describe('formatDateOfBirthInput', () => {
  it.each([
    ['1', '1'],
    ['14', '14'],
    ['140', '14/0'],
    ['1403', '14/03'],
    ['14032008', '14/03/2008'],
    ['14/03/2008', '14/03/2008'],
    ['14.03.2008 extra', '14/03/2008'],
    ['1403200899', '14/03/2008'],
  ])('formats %j as %j', (raw, formatted) => {
    expect(formatDateOfBirthInput(raw)).toBe(formatted);
  });
});

describe('consultationNotes', () => {
  it('writes the column-less fields as one labelled line', () => {
    const result = validateConsultation(VALID, NOW);
    if (!result.ok) throw new Error('expected a valid request');
    expect(consultationNotes(result.request)).toBe(
      'Destination: United Kingdom · Budget: 300–500 million VND · Package: GlowBal Yearly · Source: Home consultation form',
    );
  });

  it('says so when budget and package were left out', () => {
    const result = validateConsultation({ ...VALID, budget: '', package: '' }, NOW);
    if (!result.ok) throw new Error('expected a valid request');
    expect(consultationNotes(result.request)).toContain('Budget: Not given · Package: Not chosen');
  });
});

describe('firstInvalidField', () => {
  it('follows the order the fields appear on screen', () => {
    expect(firstInvalidField({ consent: 'consent', email: 'email', dob: 'dob' })).toBe('dob');
    expect(firstInvalidField({})).toBeNull();
  });
});
