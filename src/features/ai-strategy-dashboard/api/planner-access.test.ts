import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getApplicationPlanner } from './get-application-planner';
import { getPlannerMode } from './planner-mode';
import { assertCanonicalPlannerAccess, CanonicalPlannerAccessError, getCanonicalApplicationPlanner } from './planner-access';

vi.mock('./planner-mode', () => ({ getPlannerMode: vi.fn() }));
vi.mock('./get-application-planner', () => ({ getApplicationPlanner: vi.fn() }));

const mode = vi.mocked(getPlannerMode);
const readPlanner = vi.mocked(getApplicationPlanner);

function fakeSupabase(owned: boolean) {
  const from = (table: string) => {
    const builder = {
      select: () => builder,
      eq: () => builder,
      maybeSingle: async () => table === 'course_applications' && owned ? { data: { id: 'app-1' }, error: null } : { data: null, error: null },
    };
    return builder;
  };
  return { from } as never;
}

describe('canonical Planner access boundary', () => {
  beforeEach(() => {
    mode.mockReset();
    readPlanner.mockReset();
    readPlanner.mockResolvedValue({ plan: null, phases: [], lifecycle: 'empty', diagnostics: [] });
  });

  it('denies a free owner before reading canonical data', async () => {
    mode.mockResolvedValue('legacy');
    await expect(assertCanonicalPlannerAccess(fakeSupabase(true), 'app-1', 'user-1')).rejects.toMatchObject({ code: 'not_entitled' });
    expect(readPlanner).not.toHaveBeenCalled();
  });

  it('allows an entitled Plus owner', async () => {
    mode.mockResolvedValue('canonical');
    await expect(getCanonicalApplicationPlanner(fakeSupabase(true), 'app-1', 'user-1')).resolves.toEqual(expect.objectContaining({ lifecycle: 'empty' }));
    expect(readPlanner).toHaveBeenCalledWith(expect.anything(), 'app-1', 'user-1');
  });

  it('allows an admin through the same canonical boundary', async () => {
    mode.mockResolvedValue('canonical');
    await expect(assertCanonicalPlannerAccess(fakeSupabase(true), 'app-1', 'admin-1')).resolves.toBeUndefined();
  });

  it('denies a foreign application even when the user is entitled', async () => {
    mode.mockResolvedValue('canonical');
    await expect(assertCanonicalPlannerAccess(fakeSupabase(false), 'app-1', 'user-1')).rejects.toEqual(expect.any(CanonicalPlannerAccessError));
    await expect(assertCanonicalPlannerAccess(fakeSupabase(false), 'app-1', 'user-1')).rejects.toMatchObject({ code: 'not_found' });
  });
});
