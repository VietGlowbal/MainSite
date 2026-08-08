import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  fetchOnboardingState: vi.fn(),
  nextOnboardingStep: vi.fn(() => 'dashboard'),
  applicationSubNav: vi.fn(() => []),
}));

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));
vi.mock('@/features/ai-strategy-dashboard/api', () => ({
  fetchOnboardingState: mocks.fetchOnboardingState,
}));
vi.mock('@/features/ai-strategy-dashboard/domain', () => ({
  nextOnboardingStep: mocks.nextOnboardingStep,
}));
vi.mock('@/shared/lib/app-routes', () => ({ applicationSubNav: mocks.applicationSubNav }));
vi.mock('@/shared/ui/breadcrumbs', () => ({ Breadcrumbs: vi.fn(() => null) }));
vi.mock('./application-sub-nav', () => ({ ApplicationSubNav: vi.fn(() => null) }));

import { ApplicationNav } from './application-nav';

describe('ApplicationNav', () => {
  beforeEach(() => vi.resetAllMocks());

  it('reuses an authenticated user id instead of reading auth again', async () => {
    const getUser = vi.fn();
    const supabase = { auth: { getUser } };
    mocks.createClient.mockResolvedValue(supabase);
    mocks.fetchOnboardingState.mockResolvedValue({ aiAnalysisComplete: true });
    mocks.nextOnboardingStep.mockReturnValue('dashboard');

    await ApplicationNav({ applicationId: 'app-1', courseName: 'Course', userId: 'user-1' });

    expect(getUser).not.toHaveBeenCalled();
    expect(mocks.fetchOnboardingState).toHaveBeenCalledWith(supabase, 'user-1', 'app-1');
  });
});
