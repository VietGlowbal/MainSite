import { describe, expect, it } from 'vitest';
import {
  activeAiStrategyApplicationKey,
  aiStrategyApplicationNav,
} from './ai-strategy-route-model';

describe('aiStrategyApplicationNav', () => {
  it('keeps Personal Report user-level while application reports preserve applicationId', () => {
    const items = aiStrategyApplicationNav('app-123', {
      analysisReady: true,
      strategyReady: true,
      plannerReady: true,
      candidateConfirmed: true,
    });
    const byKey = Object.fromEntries(items.map((item) => [item.key, item]));

    expect(byKey.personalReport?.href).toBe(
      '/ai-strategy/personal-report?return=%2Fai-strategy%2Fapp-123%2Fstrategy%2Fanalysis',
    );
    expect(byKey.matchingReport?.href).toBe('/ai-strategy/app-123/matching-report');
    expect(byKey.strategyReport?.href).toBe('/ai-strategy/app-123/strategy-report');
    expect(byKey.planner?.href).toBe('/ai-strategy/app-123/planner');
    expect(byKey.scholarships?.href).toBe('/ai-strategy/app-123/scholarships');
    expect(byKey.finalCheck?.href).toBe('/ai-strategy/app-123/final-check');
  });

  it('locks application outputs until the same onboarding state says they are ready', () => {
    const items = aiStrategyApplicationNav('app-123', {
      analysisReady: false,
      strategyReady: false,
      plannerReady: false,
      candidateConfirmed: false,
    });
    expect(items.find((item) => item.key === 'personalReport')?.locked).toBeUndefined();
    expect(items.find((item) => item.key === 'matchingReport')?.locked).toBe(true);
    expect(items.find((item) => item.key === 'strategyReport')?.locked).toBe(true);
    expect(items.find((item) => item.key === 'planner')?.locked).toBe(true);
  });

  it('keeps unimplemented future tools present in the canonical model but locked', () => {
    const items = aiStrategyApplicationNav('app-123', {
      analysisReady: true,
      strategyReady: true,
      plannerReady: true,
      candidateConfirmed: true,
    });
    expect(items.find((item) => item.key === 'scholarships')?.locked).toBe(true);
    expect(items.find((item) => item.key === 'finalCheck')?.locked).toBe(true);
  });

  it('recognises canonical and legacy redirected paths for active-state compatibility', () => {
    const items = aiStrategyApplicationNav('app-123', {
      analysisReady: true,
      strategyReady: true,
      plannerReady: true,
      candidateConfirmed: true,
    });
    expect(activeAiStrategyApplicationKey('/ai-strategy/app-123/matching-report', items)).toBe('matchingReport');
    expect(activeAiStrategyApplicationKey('/ai-strategy/app-123/strategy/analysis/fit', items)).toBe('matchingReport');
    expect(activeAiStrategyApplicationKey('/ai-strategy/app-123/planner', items)).toBe('planner');
  });

  it('highlights Personal Report regardless of which application the ?return= points at', () => {
    const items = aiStrategyApplicationNav('app-123', {
      analysisReady: true,
      strategyReady: true,
      plannerReady: true,
      candidateConfirmed: true,
    });
    // The visited page's own return= (a different application, or none at
    // all) must not stop this from matching the nav item's own return=.
    expect(activeAiStrategyApplicationKey('/ai-strategy/personal-report', items)).toBe('personalReport');
    expect(
      activeAiStrategyApplicationKey('/ai-strategy/personal-report?return=%2Fai-strategy%2Fother-app', items),
    ).toBe('personalReport');
  });

  it('shows Reflections instead of Overview once reports exist, gated on candidateConfirmed', () => {
    const notYetConfirmed = aiStrategyApplicationNav('app-123', {
      analysisReady: true,
      strategyReady: false,
      plannerReady: false,
      candidateConfirmed: false,
    });
    expect(notYetConfirmed.find((item) => item.key === 'overview')).toBeUndefined();
    expect(notYetConfirmed.find((item) => item.key === 'reflections')?.locked).toBe(true);

    const confirmed = aiStrategyApplicationNav('app-123', {
      analysisReady: true,
      strategyReady: false,
      plannerReady: false,
      candidateConfirmed: true,
    });
    const reflections = confirmed.find((item) => item.key === 'reflections');
    expect(reflections?.locked).toBeUndefined();
    expect(reflections?.href).toBe(
      '/ai-strategy/reflection/confirm?return=%2Fai-strategy%2Fapp-123%2Fstrategy%2Fanalysis',
    );

    const beforeReports = aiStrategyApplicationNav('app-123', {
      analysisReady: false,
      strategyReady: false,
      plannerReady: false,
      candidateConfirmed: false,
    });
    expect(beforeReports.find((item) => item.key === 'overview')?.href).toBe('/apply/app-123');
    expect(beforeReports.find((item) => item.key === 'reflections')).toBeUndefined();
  });

  it('highlights Reflections for all three Candidate Information pages', () => {
    const items = aiStrategyApplicationNav('app-123', {
      analysisReady: true,
      strategyReady: true,
      plannerReady: true,
      candidateConfirmed: true,
    });
    expect(activeAiStrategyApplicationKey('/ai-strategy/reflection', items)).toBe('reflections');
    expect(activeAiStrategyApplicationKey('/ai-strategy/reflection/achievements', items)).toBe(
      'reflections',
    );
    expect(
      activeAiStrategyApplicationKey('/ai-strategy/reflection/confirm?return=%2Fai-strategy%2Fa', items),
    ).toBe('reflections');
  });
});
