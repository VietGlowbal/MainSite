import { describe, expect, it } from 'vitest';
import {
  buildContactRow,
  buildContactSheet,
  CONTACT_SHEET_COLUMNS,
  type AuthUserLike,
  type ProfileLike,
} from './user-contact-rows';

const col = (row: string[], name: (typeof CONTACT_SHEET_COLUMNS)[number]) =>
  row[CONTACT_SHEET_COLUMNS.indexOf(name)];

const user = (over: Partial<AuthUserLike> = {}): AuthUserLike => ({
  id: 'u1',
  email: 'student@example.com',
  created_at: '2026-08-17T00:00:00Z',
  email_confirmed_at: '2026-08-17T00:01:00Z',
  user_metadata: { full_name: 'Nguyen Van A' },
  ...over,
});

describe('buildContactRow', () => {
  it('prefers the profile column over the auth-metadata copy', () => {
    const row = buildContactRow(
      user({ user_metadata: { full_name: 'A', phone: '+84900000000', date_of_birth: '1999-01-01' } }),
      { user_id: 'u1', phone: '+84911111111', date_of_birth: '2002-08-09' },
    );

    expect(col(row, 'phone')).toBe('+84911111111');
    expect(col(row, 'date_of_birth')).toBe('2002-08-09');
  });

  it('falls back to auth metadata, which is where most phones actually live', () => {
    // 63 phones on metadata vs 16 on the profile table: without this fallback
    // the export loses three quarters of the numbers it exists to collect.
    const row = buildContactRow(
      user({ user_metadata: { full_name: 'A', phone: '+84900000000', date_of_birth: '1999-01-01' } }),
      { user_id: 'u1', phone: '', date_of_birth: null },
    );

    expect(col(row, 'phone')).toBe('+84900000000');
    expect(col(row, 'date_of_birth')).toBe('1999-01-01');
  });

  it('handles a user with no profile row at all — 176 of 409 are like this', () => {
    const row = buildContactRow(user(), undefined);

    expect(col(row, 'user_id')).toBe('u1');
    expect(col(row, 'email')).toBe('student@example.com');
    expect(col(row, 'phone')).toBe('');
    expect(col(row, 'study_level')).toBe('');
  });

  it('reads the Google spelling of the name when our own is absent', () => {
    const row = buildContactRow(user({ user_metadata: { name: 'Google Person' } }), undefined);
    expect(col(row, 'full_name')).toBe('Google Person');
  });

  it('ignores a malformed date of birth in metadata rather than exporting it', () => {
    const row = buildContactRow(user({ user_metadata: { date_of_birth: '09/08/2002' } }), undefined);
    expect(col(row, 'date_of_birth')).toBe('');
  });

  it('writes blanks, not the string "null", for missing values', () => {
    const row = buildContactRow(user({ user_metadata: {} }), undefined);
    expect(row).not.toContain('null');
    expect(row.filter((cell) => cell === '').length).toBeGreaterThan(5);
  });

  it('derives email_verified from the confirmation timestamp', () => {
    expect(col(buildContactRow(user(), undefined), 'email_verified')).toBe('TRUE');
    expect(col(buildContactRow(user({ email_confirmed_at: null }), undefined), 'email_verified')).toBe('FALSE');
  });
});

describe('buildContactSheet', () => {
  const profiles: ProfileLike[] = [{ user_id: 'u2', phone: '+84922222222' }];
  const users = [
    user({ id: 'u1', created_at: '2026-08-01T00:00:00Z' }),
    user({ id: 'u2', created_at: '2026-08-17T00:00:00Z' }),
  ];

  it('leads with the header row', () => {
    expect(buildContactSheet(users, profiles)[0]).toEqual([...CONTACT_SHEET_COLUMNS]);
  });

  it('puts the newest sign-up first', () => {
    const sheet = buildContactSheet(users, profiles);
    expect(col(sheet[1]!, 'user_id')).toBe('u2');
    expect(col(sheet[2]!, 'user_id')).toBe('u1');
  });

  it('joins each profile to its own user and leaves the others blank', () => {
    const sheet = buildContactSheet(users, profiles);
    expect(col(sheet[1]!, 'phone')).toBe('+84922222222');
    expect(col(sheet[2]!, 'phone')).toBe('');
  });

  it('emits one row per user plus the header', () => {
    expect(buildContactSheet(users, profiles)).toHaveLength(users.length + 1);
  });
});
