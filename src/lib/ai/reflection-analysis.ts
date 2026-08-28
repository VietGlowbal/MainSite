import {
  REFLECTION_ANSWER_DIMENSIONS,
  type ReflectionAnswerDimension,
  type ReflectionAnswerKey,
  type ReflectionAnswerSignal,
} from '@/shared/evaluation/engine';
import type { DirectionSignals, IdentitySignals } from './applicant-state/domain';

/**
 * Cross-answer Personal Reflection analysis (Task 6 Step 4).
 *
 * The seven answers (q1–q7) each map onto ONE Identity/Direction dimension:
 *   q1 interests/motivations, q2 values/growth, q3 problem domains,
 *   q4 capabilities/ownership, q5 academic direction,
 *   q6 career/future direction, q7 preferred university environment.
 *
 * STRENGTH RULE: a signal is only `repeated` when at least two INDEPENDENT
 * sources support it — the answer itself plus corroborating free text from
 * the student's activities/achievements. One lone answer is an `isolated`
 * hint, never an established identity claim.
 */

export { REFLECTION_ANSWER_DIMENSIONS };
export type { ReflectionAnswerDimension, ReflectionAnswerKey, ReflectionAnswerSignal };

const STOPWORDS = new Set([
  'this', 'that', 'with', 'from', 'they', 'them', 'their', 'there', 'have', 'has',
  'want', 'like', 'about', 'into', 'over', 'when', 'what', 'which', 'while',
  'been', 'were', 'will', 'would', 'could', 'should', 'because', 'really',
]);

function significantTokens(text: string): Set<string> {
  return new Set(
    text
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((token) => token.length > 3 && !STOPWORDS.has(token)),
  );
}

function corroborationCount(answer: string, evidenceTexts: readonly string[]): number {
  const tokens = significantTokens(answer);
  if (tokens.size === 0) return 0;
  let count = 0;
  for (const text of evidenceTexts) {
    const sourceTokens = significantTokens(text);
    let overlap = 0;
    for (const token of tokens) if (sourceTokens.has(token)) overlap += 1;
    // A modest keyword overlap counts as independent corroboration.
    if (overlap >= 2) count += 1;
  }
  return count;
}

/** Maps answered questions onto their dimension-tagged signals. */
export function deriveReflectionSignals(
  answers: Record<string, string | undefined> | null | undefined,
): ReflectionAnswerSignal[] {
  if (!answers) return [];
  return (Object.keys(REFLECTION_ANSWER_DIMENSIONS) as ReflectionAnswerKey[]).flatMap((key) => {
    const value = typeof answers[key] === 'string' ? answers[key]!.trim() : '';
    if (!value) return [];
    return [{ key, dimension: REFLECTION_ANSWER_DIMENSIONS[key], value, status: 'isolated' as const }];
  });
}

/**
 * Full cross-answer analysis. `evidenceTexts` are the student's activity/
 * achievement free texts — anything outside these seven answers that can
 * independently corroborate a claim.
 */
export function analyzeReflectionAnswers(
  answers: Record<string, string | undefined> | null | undefined,
  evidenceTexts: readonly string[] = [],
): {
  signals: ReflectionAnswerSignal[];
  identitySignals?: IdentitySignals;
  directionSignals?: DirectionSignals;
} {
  const signals = deriveReflectionSignals(answers).map((signal) => ({
    ...signal,
    // Answer itself = source one; each corroborating free text adds another.
    status: (corroborationCount(signal.value, evidenceTexts) >= 1
      ? 'repeated'
      : 'isolated') as ReflectionAnswerSignal['status'],
  }));

  const valuesFor = (...keys: ReflectionAnswerKey[]) =>
    signals.filter((signal) => keys.includes(signal.key)).map((signal) => signal.value);

  const byDimension = (dimension: ReflectionAnswerDimension) =>
    signals.find((signal) => signal.dimension === dimension)?.value ?? null;

  return {
    signals,
    identitySignals: {
      interestsMotivations: valuesFor('q1'),
      valuesGrowth: valuesFor('q2'),
      problemDomains: valuesFor('q3'),
      capabilityOwnership: valuesFor('q4'),
    },
    directionSignals: {
      academicDirection: byDimension('academic_direction'),
      careerDirection: byDimension('career_direction'),
      preferredEnvironment: byDimension('environment_preference'),
    },
  };
}
