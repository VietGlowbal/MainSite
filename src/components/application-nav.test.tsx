import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  fetchOnboardingState: vi.fn(),
  getPlannerMode: vi.fn(() => 'legacy'),
  nextOnboardingStep: vi.fn(() => 'dashboard'),
  aiStrategyApplicationNav: vi.fn(() => []),
}));

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));
vi.mock('@/features/ai-strategy-dashboard/api', () => ({
  fetchOnboardingState: mocks.fetchOnboardingState,
  getPlannerMode: mocks.getPlannerMode,
}));
vi.mock('@/features/ai-strategy-dashboard/domain', () => ({
  nextOnboardingStep: mocks.nextOnboardingStep,
}));
vi.mock('@/shared/lib/ai-strategy-route-model', () => ({ aiStrategyApplicationNav: mocks.aiStrategyApplicationNav }));
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

  it('keeps the explicitly localized nav outside the legacy DOM translator', async () => {
    const supabase = { auth: { getUser: vi.fn() } };
    mocks.createClient.mockResolvedValue(supabase);
    mocks.fetchOnboardingState.mockResolvedValue({ aiAnalysisComplete: true });
    mocks.nextOnboardingStep.mockReturnValue('dashboard');

    const { container } = render(
      await ApplicationNav({ applicationId: 'app-1', courseName: 'CS', userId: 'user-1' }),
    );

    expect(container.querySelector('[data-no-auto-translate]')).toBeInTheDocument();
  });

  it('unlocks the Planner for canonical Plus/admin users before legacy onboarding finishes', async () => {
    const supabase = { auth: { getUser: vi.fn() } };
    mocks.createClient.mockResolvedValue(supabase);
    mocks.fetchOnboardingState.mockResolvedValue({ aiAnalysisComplete: false, strategyComplete: false });
    mocks.nextOnboardingStep.mockReturnValue('analysis');
    mocks.getPlannerMode.mockResolvedValue('canonical');

    await ApplicationNav({ applicationId: 'app-1', userId: 'user-1' });

    expect(mocks.getPlannerMode).toHaveBeenCalledWith(supabase, 'user-1');
    expect(mocks.aiStrategyApplicationNav).toHaveBeenCalledWith('app-1', {
      analysisReady: false,
      strategyReady: false,
      plannerReady: true,
      candidateConfirmed: undefined,
    });
  });
});
