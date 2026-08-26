import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getApplicationPlanner } from './get-application-planner';
import { getApplicationAssessments } from './get-application-assessments';
import { getPlannerMode } from './planner-mode';
import { refreshApplicationPlan } from './refresh-application-plan';
import {
  assertCanonicalPlannerAccess,
  CanonicalPlannerAccessError,
  ensureApplicationPlan,
  getCanonicalApplicationPlanner,
} from './planner-access';

vi.mock('./planner-mode', () => ({ getPlannerMode: vi.fn() }));
vi.mock('./get-application-planner', () => ({ getApplicationPlanner: vi.fn() }));
vi.mock('./get-application-assessments', () => ({ getApplicationAssessments: vi.fn() }));
vi.mock('./refresh-application-plan', () => ({ refreshApplicationPlan: vi.fn() }));

const mode = vi.mocked(getPlannerMode);
const readPlanner = vi.mocked(getApplicationPlanner);
const readAssessments = vi.mocked(getApplicationAssessments);
const refresh = vi.mocked(refreshApplicationPlan);

function fakeSupabase(owned = true) {
  const from = (table: string) => {
    const builder = {
      select: () => builder,
      eq: () => builder,
      maybeSingle: async () => table === 'course_applications' && owned
        ? { data: { id: 'app-1' }, error: null }
        : { data: null, error: null },
    };
    return builder;
  };
  return { from } as never;
}

describe('canonical Planner access boundary', () => {
  beforeEach(() => {
    mode.mockReset();
    readPlanner.mockReset();
    readAssessments.mockReset();
    refresh.mockReset();
    readPlanner.mockResolvedValue({ plan: null, phases: [], lifecycle: 'empty', diagnostics: [] });
    refresh.mockResolvedValue({ refreshed: true, skipped: false });
  });

  afterEach(() => vi.resetAllMocks());

  it('denies a free owner before reading canonical data', async () => {
    mode.mockResolvedValue('legacy');
    await expect(assertCanonicalPlannerAccess(fakeSupabase(), 'app-1', 'user-1'))
      .rejects.toMatchObject({ code: 'not_entitled' });
    expect(readPlanner).not.toHaveBeenCalled();
  });

  it('allows an entitled Plus owner', async () => {
    mode.mockResolvedValue('canonical');
    await expect(getCanonicalApplicationPlanner(fakeSupabase(), 'app-1', 'user-1'))
      .resolves.toEqual(expect.objectContaining({ lifecycle: 'empty' }));
    expect(readPlanner).toHaveBeenCalledWith(expect.anything(), 'app-1', 'user-1');
  });

  it('allows an admin through the same canonical boundary', async () => {
    mode.mockResolvedValue('canonical');
    await expect(assertCanonicalPlannerAccess(fakeSupabase(), 'app-1', 'admin-1'))
      .resolves.toBeUndefined();
  });

  it('denies a foreign application even when the user is entitled', async () => {
    mode.mockResolvedValue('canonical');
    await expect(assertCanonicalPlannerAccess(fakeSupabase(false), 'app-1', 'user-1'))
      .rejects.toEqual(expect.any(CanonicalPlannerAccessError));
    await expect(assertCanonicalPlannerAccess(fakeSupabase(false), 'app-1', 'user-1'))
      .rejects.toMatchObject({ code: 'not_found' });
  });

  it('reconciles an unchanged legacy canonical plan when declared availability inputs are absent', async () => {
    mode.mockResolvedValue('canonical');
    readPlanner.mockResolvedValue({
      plan: {
        id: 'plan-db-1', applicationId: 'application-1', producer: 'core3',
        domainPlanId: 'plan:deterministic:source:hash', readiness: 'requires_enrichment',
      },
      phases: [], lifecycle: 'empty', diagnostics: [],
    } as never);
    readAssessments.mockResolvedValue({
      context: { plannerInputs: [], interventionCandidates: [], programmeRequirements: [], identifiedGaps: [], deadlines: [], userConstraints: [], provenance: { contextHash: 'hash' } } as never,
      assessments: [],
    });

    await expect(ensureApplicationPlan(fakeSupabase(), 'application-1', 'user-1'))
      .resolves.toEqual({ kind: 'ready', created: true });
    expect(refresh).toHaveBeenCalledWith(expect.anything(), 'application-1', 'user-1', 'source_change');
  });
});
