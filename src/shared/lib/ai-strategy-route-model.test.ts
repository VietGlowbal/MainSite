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
    });
    const byKey = Object.fromEntries(items.map((item) => [item.key, item]));

    expect(byKey.personalReport?.href).toBe('/ai-strategy/personal-report');
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
    });
    expect(items.find((item) => item.key === 'scholarships')?.locked).toBe(true);
    expect(items.find((item) => item.key === 'finalCheck')?.locked).toBe(true);
  });

  it('recognises canonical and legacy redirected paths for active-state compatibility', () => {
    const items = aiStrategyApplicationNav('app-123', {
      analysisReady: true,
      strategyReady: true,
      plannerReady: true,
    });
    expect(activeAiStrategyApplicationKey('/ai-strategy/app-123/matching-report', items)).toBe('matchingReport');
    expect(activeAiStrategyApplicationKey('/ai-strategy/app-123/strategy/analysis/fit', items)).toBe('matchingReport');
    expect(activeAiStrategyApplicationKey('/ai-strategy/app-123/planner', items)).toBe('planner');
  });
});
