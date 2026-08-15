import {
  assessMotivationConsistency,
  type MotivationConsistency,
  type NarrativeActivity,
} from './f4-narrative-identity';
import type { EvidenceRef } from './types';

export type ProfileMotivation = {
  id: string;
  label: string;
  value: string;
};

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'because',
  'for',
  'from',
  'i',
  'in',
  'is',
  'it',
  'my',
  'of',
  'on',
  'that',
  'the',
  'this',
  'to',
  'want',
  'with',
  'và',
  'của',
  'tôi',
  'mình',
  'là',
  'vì',
  'cho',
  'để',
  'trong',
]);

function tokens(value: string): Set<string> {
  return new Set(
    value
      .normalize('NFKD')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((token) => token.length >= 3 && !STOP_WORDS.has(token)),
  );
}

function meaningfullyOverlaps(a: string, b: string): boolean {
  const left = tokens(a);
  const right = tokens(b);
  if (left.size === 0 || right.size === 0) return false;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;
  const denominator = Math.min(left.size, right.size);
  return denominator > 0 && shared / denominator >= 0.35;
}

/**
 * Combine explicit, user-level reflection answers with per-activity motivation
 * evidence without turning activity choice itself into a claimed internal
 * motive.
 *
 * A profile motivation is a direct observation because the student explicitly
 * wrote it. It can establish WHAT the student says motivates them; it only
 * becomes an established recurring motivation when an independently described
 * activity motivation is meaningfully aligned with it and the profile has
 * enough activities for mature synthesis.
 */
export function assessMotivationConsistencyWithProfile(
  activities: readonly NarrativeActivity[],
  profileMotivations: readonly ProfileMotivation[],
): MotivationConsistency {
  const base = assessMotivationConsistency(activities);
  const explicit = profileMotivations.filter((item) => item.value.trim().length > 0);
  if (explicit.length === 0) return base;

  const primary = explicit[0] as ProfileMotivation;
  const activityMotivations = activities
    .map((activity) => activity.statedMotivation)
    .filter((value): value is string => Boolean(value?.trim()));
  const alignedActivityCount = activityMotivations.filter((value) =>
    meaningfullyOverlaps(primary.value, value),
  ).length;

  const evidenceRefs: EvidenceRef[] = [
    ...explicit.map((item) => ({ id: item.id, kind: 'profile', label: item.label })),
    ...base.evidenceRefs,
  ];
  const mature = activities.length >= 3;
  const established = mature && alignedActivityCount >= 1;

  const limitations = base.limitations.filter(
    (limitation) => !/student has not stated|not enough activity or explicit statement/i.test(limitation),
  );
  if (!established) {
    limitations.push(
      'The student has stated a motivation directly, but there is not yet enough aligned activity-level reflection to call it a recurring established pattern.',
    );
  }

  return {
    ...base,
    status: established ? 'established' : 'emerging',
    motivationStatus: established ? 'established' : 'emerging',
    confidence: established ? 'high' : 'medium',
    kind: 'observation',
    evidenceRefs,
    limitations,
    missingInputs: established ? [] : ['alignedActivityMotivation'],
    statedMotivation: primary.value,
    recurrenceCount: 1 + alignedActivityCount,
    personallyGrounded: true,
    actionAligned: alignedActivityCount > 0,
  };
}
