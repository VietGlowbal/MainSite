import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type WriteResult = { error: { code: string } | null };

const db = vi.hoisted(() => ({
  insert: vi.fn<(row: Record<string, unknown>) => Promise<WriteResult>>(),
  update: vi.fn<(fields: Record<string, unknown>) => { eq: (column: string, value: string) => Promise<WriteResult> }>(),
  eq: vi.fn<(column: string, value: string) => Promise<WriteResult>>(),
}));

vi.mock('@/server/db/admin', () => ({
  createAdminClient: () => ({
    from: () => ({ insert: db.insert, update: db.update }),
  }),
}));

import { recordWaitlistSignup } from '..';

const HOME = {
  email: 'student@example.com',
  firstName: 'Linh Nguyen',
  notes: 'Destination: UK · Budget: 300–500 million VND · Package: Yearly · Source: Home consultation form',
  phone: '+84 912345678',
  dateOfBirth: '2007-05-14',
  source: 'home_consultation',
  consultation: { destination: 'UK', budget: '300-500m', package: 'yearly' },
};

const OK: WriteResult = { error: null };
const MISSING_COLUMN: WriteResult = { error: { code: 'PGRST204' } };
const DUPLICATE: WriteResult = { error: { code: '23505' } };

describe('recordWaitlistSignup', () => {
  beforeEach(() => {
    db.update.mockReturnValue({ eq: db.eq });
    db.eq.mockResolvedValue(OK);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.restoreAllMocks();
  });

  it('writes the consultation answers to their own columns, tagged as a Home lead', async () => {
    db.insert.mockResolvedValue(OK);

    await expect(recordWaitlistSignup(HOME)).resolves.toEqual({ outcome: 'inserted' });

    expect(db.insert).toHaveBeenCalledOnce();
    expect(db.insert).toHaveBeenCalledWith({
      email: 'student@example.com',
      first_name: 'Linh Nguyen',
      notes: HOME.notes,
      phone: '+84 912345678',
      date_of_birth: '2007-05-14',
      destination: 'UK',
      budget: '300-500m',
      package: 'yearly',
      source: 'home_consultation',
    });
  });

  it('retries without the new columns when the migration has not run, keeping the notes line', async () => {
    db.insert.mockResolvedValueOnce(MISSING_COLUMN).mockResolvedValueOnce(OK);

    await expect(recordWaitlistSignup(HOME)).resolves.toEqual({ outcome: 'inserted' });

    expect(db.insert).toHaveBeenCalledTimes(2);
    const retry = db.insert.mock.calls[1]?.[0];
    expect(retry).not.toHaveProperty('destination');
    expect(retry).not.toHaveProperty('budget');
    expect(retry).not.toHaveProperty('package');
    expect(retry).toMatchObject({ notes: HOME.notes, source: 'home_consultation' });
    expect(console.warn).toHaveBeenCalledOnce();
  });

  it('leaves the /coming-soon waitlist exactly as it was', async () => {
    db.insert.mockResolvedValue(OK);

    await recordWaitlistSignup({
      email: 'someone@example.com',
      firstName: 'Minh',
      notes: '',
      phone: '',
      dateOfBirth: '',
    });

    expect(db.insert).toHaveBeenCalledWith({
      email: 'someone@example.com',
      first_name: 'Minh',
      notes: null,
      phone: null,
      date_of_birth: null,
      source: 'website_waitlist',
    });
  });

  it('does not retry a write that never named the new columns', async () => {
    db.insert.mockResolvedValue(MISSING_COLUMN);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      recordWaitlistSignup({ email: 'someone@example.com', firstName: '', notes: '', phone: '', dateOfBirth: '' }),
    ).resolves.toEqual({ outcome: 'error' });
    expect(db.insert).toHaveBeenCalledOnce();
  });

  it('updates a returning email, falling back to the original columns if the new ones are missing', async () => {
    db.insert.mockResolvedValueOnce(DUPLICATE);
    db.eq.mockResolvedValueOnce(MISSING_COLUMN).mockResolvedValueOnce(OK);

    await expect(recordWaitlistSignup(HOME)).resolves.toEqual({ outcome: 'updated' });

    expect(db.update).toHaveBeenCalledTimes(2);
    expect(db.update.mock.calls[0]?.[0]).toMatchObject({ package: 'yearly' });
    expect(db.update.mock.calls[1]?.[0]).not.toHaveProperty('package');
    expect(db.eq).toHaveBeenLastCalledWith('email', 'student@example.com');
  });
});
