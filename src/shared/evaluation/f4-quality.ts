import {
  synthesisReadiness,
  type NarrativeActivity,
  type NarrativeBaseMetrics,
  type NarrativeMetricKey,
} from './f4-narrative-identity';
import { weightedScore } from './weighted-score';
import { confidenceFromCoverage, makeInsight } from './types';

/**
 * A stricter implementation of the five F4 base metrics.
 *
 * The first engine pass used convenient proxies that were too optimistic:
 * - Pattern consistency counted activities that merely HAD a behaviour.
 * - Growth arc counted numeric outcomes, which is impact, not growth over time.
 * - Evidence density counted self-references that every activity receives.
 *
 * This version refuses to score dimensions when the data model cannot
 * genuinely support them. Missing metrics stay null and weightedScore()
 * renormalizes the remaining weights, exactly as the framework requires.
 */
const WEIGHTS: Record<NarrativeMetricKey, number> = {
  patternConsistency: 0.25,
  thematicConvergence: 0.2,
  growthArc: 0.2,
  differentiation: 0.2,
  evidenceDensity: 0.15,
};

function normalize(value: string): string {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function leadingAction(value: string): string | null {
  const first = normalize(value).split(' ')[0];
  return first && first.length >= 2 ? first : null;
}

function recurringRatio(values: readonly string[], total: number): number | null {
  if (total < 2 || values.length < 2) return null;
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  const max = Math.max(...counts.values());
  if (max < 2) return 0;
  return Math.round((max / total) * 100);
}

function patternConsistency(activities: readonly NarrativeActivity[]): number | null {
  const actions = activities
    .map((activity) => (activity.behaviour ? leadingAction(activity.behaviour) : null))
    .filter((value): value is string => Boolean(value));
  return recurringRatio(actions, activities.length);
}

function thematicConvergence(activities: readonly NarrativeActivity[]): number | null {
  const themes = activities
    .map((activity) => (activity.domainTheme ? normalize(activity.domainTheme) : null))
    .filter((value): value is string => Boolean(value));
  return recurringRatio(themes, activities.length);
}

function differentiation(activities: readonly NarrativeActivity[]): number | null {
  if (activities.length < 2) return null;
  const actions = activities
    .map((activity) => (activity.behaviour ? leadingAction(activity.behaviour) : null))
    .filter((value): value is string => Boolean(value));
  const themes = activities
    .map((activity) => (activity.domainTheme ? normalize(activity.domainTheme) : null))
    .filter((value): value is string => Boolean(value));
  const recurringAction = recurringRatio(actions, activities.length);
  if (recurringAction === null || recurringAction <= 0 || themes.length < 2) return null;
  const distinctThemes = new Set(themes).size;
  if (distinctThemes >= 2 && recurringAction >= 60) return 80;
  if (recurringAction >= 50) return 55;
  return 35;
}

export function scoreNarrativeBaseFaithful(
  activities: readonly NarrativeActivity[],
): NarrativeBaseMetrics {
  const readiness = synthesisReadiness(activities);
  const metrics: Record<NarrativeMetricKey, number | null> = {
    patternConsistency: patternConsistency(activities),
    thematicConvergence: thematicConvergence(activities),
    // A growth arc requires chronology plus comparable responsibility/scope.
    // NarrativeActivity does not currently carry reliable chronology, so an
    // honest N/A is better than the old "contains a number" proxy.
    growthArc: null,
    differentiation: differentiation(activities),
    // NarrativeActivity.evidenceRefs are provenance pointers, including the
    // activity's own row. They are NOT proof that evidence is independently
    // traceable; F3 owns that judgement, so F4 must not double-count it here.
    evidenceDensity: null,
  };

  const weighted = weightedScore(
    (Object.keys(WEIGHTS) as NarrativeMetricKey[]).map((key) => ({
      key,
      weight: WEIGHTS[key],
      value: metrics[key],
    })),
  );

  const limitations: string[] = [];
  if (readiness.level === 'none') limitations.push('No activities recorded — nothing to synthesise.');
  if (readiness.level === 'insufficient') {
    limitations.push('Only one activity recorded — a recurring pattern needs at least two.');
  }
  if (readiness.level === 'emerging') {
    limitations.push('Only two activities recorded — patterns are emerging, not established.');
  }
  limitations.push('Growth arc is not scored until reliable activity chronology is captured.');
  limitations.push('Evidence density is assessed in F3; self-references are not counted as independent proof in F4.');
  if (weighted.missingKeys.length > 0) {
    limitations.push(`Not enough material to score: ${weighted.missingKeys.join(', ')}.`);
  }

  return {
    ...makeInsight({
      id: 'f4:base',
      frameworkId: 'F4',
      status: readiness.level,
      score: weighted.score,
      confidence: confidenceFromCoverage(weighted.presentKeys.length, Object.keys(WEIGHTS).length),
      kind: weighted.score === null ? 'missing' : 'inference',
      limitations,
      missingInputs: weighted.missingKeys,
      evidenceRefs: activities.flatMap((activity) => activity.evidenceRefs),
    }),
    metrics,
    readiness,
  };
}
