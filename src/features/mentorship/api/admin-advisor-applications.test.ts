import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  isAdmin: vi.fn(),
  createAdminClient: vi.fn(),
}));

vi.mock('@/server/db/server', () => ({
  createClient: vi.fn(async () => ({ auth: { getUser: mocks.getUser } })),
}));
vi.mock('@/server/db/admin', () => ({
  createAdminClient: mocks.createAdminClient,
}));
vi.mock('@/server/auth/auth-helpers', () => ({
  isAdmin: mocks.isAdmin,
}));

import {
  decideAdvisorApplication,
  listAdvisorApplicationsForAdmin,
} from './admin-advisor-applications';

describe('admin advisor application repository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'admin-1' } },
      error: null,
    });
    mocks.isAdmin.mockResolvedValue(true);
  });

  it('does not construct the trusted client for a non-admin', async () => {
    mocks.isAdmin.mockResolvedValue(false);

    await expect(listAdvisorApplicationsForAdmin()).resolves.toEqual({
      ok: false,
      error: 'Forbidden',
      status: 403,
    });
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it('loads pending applications with an explicit server-side projection', async () => {
    const application = {
      id: '11111111-1111-4111-8111-111111111111',
      display_name: 'Advisor Applicant',
      subject: 'Economics',
      degree_level: 'masters',
      bio: 'Application biography',
      help_topics: ['Essays'],
      languages: ['English'],
      session_price_vnd: 500000,
      session_duration_mins: 60,
      status: 'pending',
      created_at: '2026-08-27T00:00:00.000Z',
      university: { id: 1, name: 'Example University', country: 'GB' },
    };
    const order = vi.fn().mockResolvedValue({ data: [application], error: null });
    const inStatus = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ in: inStatus }));
    const from = vi.fn(() => ({ select }));
    mocks.createAdminClient.mockReturnValue({ from });

    await expect(listAdvisorApplicationsForAdmin()).resolves.toEqual({
      ok: true,
      applications: [application],
    });
    expect(from).toHaveBeenCalledWith('achiever_profiles');
    expect(select).toHaveBeenCalledWith(expect.not.stringContaining('*'));
    expect(inStatus).toHaveBeenCalledWith('status', ['pending', 'approved', 'rejected']);
  });

  it('updates a pending application through the trusted client', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: '11111111-1111-4111-8111-111111111111',
        status: 'approved',
        verified_at: '2026-08-27T00:00:00.000Z',
      },
      error: null,
    });
    const select = vi.fn(() => ({ maybeSingle }));
    const pendingEq = vi.fn(() => ({ select }));
    const idEq = vi.fn(() => ({ eq: pendingEq }));
    const update = vi.fn(() => ({ eq: idEq }));
    const from = vi.fn(() => ({ update }));
    mocks.createAdminClient.mockReturnValue({ from });

    const result = await decideAdvisorApplication(
      '11111111-1111-4111-8111-111111111111',
      'approved',
    );

    expect(result).toMatchObject({
      ok: true,
      application: { status: 'approved' },
    });
    expect(update).toHaveBeenCalledWith({
      status: 'approved',
      verified_at: expect.any(String),
    });
    expect(idEq).toHaveBeenCalledWith('id', '11111111-1111-4111-8111-111111111111');
    expect(pendingEq).toHaveBeenCalledWith('status', 'pending');
  });

  it('does not overwrite an application that another admin already processed', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const select = vi.fn(() => ({ maybeSingle }));
    const pendingEq = vi.fn(() => ({ select }));
    const idEq = vi.fn(() => ({ eq: pendingEq }));
    const update = vi.fn(() => ({ eq: idEq }));
    mocks.createAdminClient.mockReturnValue({ from: () => ({ update }) });

    await expect(
      decideAdvisorApplication('11111111-1111-4111-8111-111111111111', 'rejected'),
    ).resolves.toEqual({
      ok: false,
      error: 'This application is no longer pending. Refresh and try again.',
      status: 409,
    });
  });
});
