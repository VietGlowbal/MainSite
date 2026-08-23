import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/server/db/admin', () => ({ createAdminClient: vi.fn(() => ({ role: 'admin' })) }));
vi.mock('./get-application-planner', () => ({ getApplicationPlanner: vi.fn() }));
vi.mock('./get-application-assessments', () => ({ getApplicationAssessments: vi.fn() }));
vi.mock('./sync-application-plan', () => ({ syncApplicationPlan: vi.fn() }));

import { getApplicationAssessments } from './get-application-assessments';
import { getApplicationPlanner } from './get-application-planner';
import { ensureApplicationPlan } from './planner-access';
import { syncApplicationPlan } from './sync-application-plan';

const mockedGetApplicationPlanner = vi.mocked(getApplicationPlanner);
const mockedGetApplicationAssessments = vi.mocked(getApplicationAssessments);
const mockedSyncApplicationPlan = vi.mocked(syncApplicationPlan);

function fakeSupabase() {
  const from = (table: string) => {
    const data = table === 'student_profiles'
      ? { plus_status: false, plus_expires_at: null, is_admin: true }
      : table === 'course_applications' ? { id: 'application-1' } : null;
    const query = {
      select: () => query,
      eq: () => query,
      maybeSingle: async () => ({ data, error: null }),
    };
    return query;
  };
  return { from } as never;
}

afterEach(() => vi.resetAllMocks());

describe('ensureApplicationPlan', () => {
  it('reconciles an unchanged legacy canonical plan when declared availability inputs are absent', async () => {
    mockedGetApplicationPlanner.mockResolvedValue({
      plan: {
        id: 'plan-db-1', applicationId: 'application-1', producer: 'core3',
        domainPlanId: 'plan:deterministic:source:hash', readiness: 'requires_enrichment',
      },
      phases: [], lifecycle: 'empty', diagnostics: [],
    } as never);
    mockedGetApplicationAssessments.mockResolvedValue({
      context: { plannerInputs: [], provenance: { contextHash: 'hash' } } as never,
      assessments: [],
    });
    mockedSyncApplicationPlan.mockResolvedValue({ inserted: 3, updated: 0, restored: 0, archived: 0 });

    await expect(ensureApplicationPlan(fakeSupabase(), 'application-1', 'user-1'))
      .resolves.toEqual({ kind: 'ready', created: true });

    expect(mockedSyncApplicationPlan).toHaveBeenCalledWith(expect.anything(), 'application-1', 'user-1');
  });
});
