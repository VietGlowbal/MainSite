import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveApplicationReturn } from './_application-return';

const mocks = vi.hoisted(() => ({
  verifiedApplicationId: vi.fn(),
  loadApplicationSummary: vi.fn(),
}));

vi.mock('@/features/apply/api', () => ({
  verifiedApplicationId: mocks.verifiedApplicationId,
  loadApplicationSummary: mocks.loadApplicationSummary,
}));

/**
 * Guards issue #1 from the spec — "application context must never be lost":
 * a profile editor opened from inside an application must resolve a real
 * `returnTo` + application label, a forged/foreign application id must not
 * leak a label, and an ordinary (non-application) profile visit must behave
 * exactly as it always has (no returnTo, no label, no crash).
 */
describe('resolveApplicationReturn', () => {
  const supabase = {} as never;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns no context for a normal profile visit with no return param', async () => {
    const result = await resolveApplicationReturn(supabase, 'user-1', undefined);
    expect(result).toEqual({ returnTo: undefined, applicationLabel: undefined });
    expect(mocks.verifiedApplicationId).not.toHaveBeenCalled();
  });

  it('rejects an unsafe return param (open-redirect guard) and drops all context', async () => {
    const result = await resolveApplicationReturn(supabase, 'user-1', '//evil.com');
    expect(result).toEqual({ returnTo: undefined, applicationLabel: undefined });
    expect(mocks.verifiedApplicationId).not.toHaveBeenCalled();
  });

  it('resolves the returnTo and application label when the application genuinely belongs to this student', async () => {
    mocks.verifiedApplicationId.mockResolvedValueOnce('app-1');
    mocks.loadApplicationSummary.mockResolvedValueOnce({ label: 'Cambridge · Computer Science' });

    const result = await resolveApplicationReturn(
      supabase,
      'user-1',
      '/ai-strategy/app-1/strategy/analysis',
    );

    expect(result).toEqual({
      returnTo: '/ai-strategy/app-1/strategy/analysis',
      applicationLabel: 'Cambridge · Computer Science',
    });
  });

  it('still returns a safe returnTo, but no label, for a path with no verifiable application', async () => {
    mocks.verifiedApplicationId.mockResolvedValueOnce(undefined);

    const result = await resolveApplicationReturn(supabase, 'user-1', '/ai-strategy/reflection');

    expect(result).toEqual({ returnTo: '/ai-strategy/reflection', applicationLabel: undefined });
    expect(mocks.loadApplicationSummary).not.toHaveBeenCalled();
  });

  it('drops the label (but keeps returnTo) for an application id that does not belong to this student', async () => {
    mocks.verifiedApplicationId.mockResolvedValueOnce(undefined);

    const result = await resolveApplicationReturn(
      supabase,
      'user-1',
      '/ai-strategy/someone-elses-app/strategy/analysis',
    );

    expect(result).toEqual({
      returnTo: '/ai-strategy/someone-elses-app/strategy/analysis',
      applicationLabel: undefined,
    });
    expect(mocks.loadApplicationSummary).not.toHaveBeenCalled();
  });
});
