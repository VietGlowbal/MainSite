import { weightedScore } from './weighted-score';
import { confidenceFromCoverage, type Confidence, type Insight } from './types';

/**
 * F1 — CMCAITF Reflective-Evidence Framework.
 *
 * CMCAITF: Context, Motivation, Challenge, Action, Impact, Transformation,
 * Future — the seven structured fields a fully-reflected activity write-up
 * would have. The current product does not capture all seven for every
 * activity/achievement (the Achievements form asks for a title, category and
 * one free-text `detail`, not seven separate prompts) — this module does NOT
 * fake the missing six from that one field. Where a CMCAITF field was not
 * captured, it is `null`, and the metrics that would need it are scored from
 * whatever fields ARE present, with N/A metrics excluded and the rest
 * renormalized (`weightedScore`, core principle 6).
 *
 * ─── THE FIVE METRICS AND THE FORMULA ────────────────────────────────────────
 *
 *   Specificity            25%
 *   Completeness            20%
 *   Causal Clarity           20%
 *   Personal Voice/Ownership 15%
 *   Transformation Depth     20%
 *
 *   F1 = 0.25·Specificity + 0.20·Completeness + 0.20·CausalClarity
 *      + 0.15·PersonalVoice + 0.20·TransformationDepth
 *
 * Every metric is 1–5 (rescaled to 0–100 for the formula, so F1 sits on the
 * same 0–100 scale as every other framework in this engine) and is either
 * scored from CMCAITF fields the record actually has, or reported `null`
 * ("unassessed") when there is nothing to score it from. A record with only a
 * title and one free-text paragraph gets a `limited` status and fewer scored
 * metrics — never a fabricated 3/5 to fill a gap.
 *
 * ─── WHY THIS IS DETERMINISTIC, NOT A MODEL CALL ─────────────────────────────
 *
 * Specificity, Completeness and the others below are measurable properties of
 * TEXT (does it name a concrete action, does it fill Context/Action/Impact,
 * does it use first person and active verbs, does it describe a before/after
 * state) — the same class of signal F6 already grades deterministically. A
 * model is reserved for the one thing that is genuinely semantic: extracting
 * which sentence of a free-text `detail` field maps to which CMCAITF slot,
 * which lives in `src/lib/ai/evaluation/cmcaitf-extraction.ts`, not here. This
 * module scores whatever CMCAITF shape it is handed, regardless of whether
 * that shape came from structured form fields or from the extractor.
 */

export type CmcaitfFields = {
  /** The setting — where, when, what situation. */
  context: string | null;
  /** Why the student did this — their own stated reason. */
  motivation: string | null;
  /** What made it hard. */
  challenge: string | null;
  /** What the student actually did — concrete, first-person. */
  action: string | null;
  /** What resulted — for others, for the situation. */
  impact: string | null;
  /** How the student changed as a result. */
  transformation: string | null;
  /** How this connects to what they want to do next. */
  future: string | null;
};

export const EMPTY_CMCAITF: CmcaitfFields = {
  context: null,
  motivation: null,
  challenge: null,
  action: null,
  impact: null,
  transformation: null,
  future: null,
};

/** One activity/achievement's reflection, as much of it as the record actually has. */
export type ReflectionRecord = {
  id: string;
  title: string;
  cmcaitf: CmcaitfFields;
  /** True when `cmcaitf` came from a real per-field capture, not a single free-text blob split by a model. */
  structuredCapture: boolean;
};

export type ReflectionMetricKey =
  | 'specificity'
  | 'completeness'
  | 'causalClarity'
  | 'personalVoice'
  | 'transformationDepth';

export const REFLECTION_METRIC_WEIGHTS: Record<ReflectionMetricKey, number> = {
  specificity: 0.25,
  completeness: 0.2,
  causalClarity: 0.2,
  personalVoice: 0.15,
  transformationDepth: 0.2,
};

export type ReflectionScore = Insight & {
  activityId: string;
  /** 1-5 per metric, rescaled internally for the formula; null means unassessed for this record. */
  metrics: Record<ReflectionMetricKey, number | null>;
  filledFields: (keyof CmcaitfFields)[];
  missingFields: (keyof CmcaitfFields)[];
};

export type ReflectionProfile = {
  scores: ReflectionScore[];
  /** Records with enough CMCAITF coverage to produce at least one scored metric. */
  assessed: ReflectionScore[];
  /** Records with too little captured to score anything — reported, not silently dropped. */
  unassessed: ReflectionScore[];
  confidence: Confidence;
};

const FILLED_MIN_LENGTH = 20;

function isFilled(value: string | null): boolean {
  return Boolean(value && value.trim().length >= FILLED_MIN_LENGTH);
}

function filledFieldsOf(fields: CmcaitfFields): (keyof CmcaitfFields)[] {
  return (Object.keys(fields) as (keyof CmcaitfFields)[]).filter((key) => isFilled(fields[key]));
}

/** A concrete detail: a number, a named place/person, or a quantifiable change. */
function hasConcreteDetail(text: string): boolean {
  return /\d/.test(text) || /[.!?]\s+[A-Z]|(?:^|\s)(?!I\b)[A-Z][a-z]{2,}/.test(text.slice(1));
}

const FIRST_PERSON_PATTERN = /\bI\s+(?!think|feel|believe)\w+ed\b|\bI\s+(?:led|ran|built|made|took|felt|chose|decided)\b/i;
const CAUSAL_CONNECTIVE_PATTERN = /\b(because|so that|which led to|as a result|this meant|which meant|resulted in|due to)\b/i;

/**
 * 1-5 or null. Rewards Context+Action+Impact for naming something concrete —
 * a number, a place, a named collaborator — over generic description.
 */
function scoreSpecificity(fields: CmcaitfFields): number | null {
  const relevant = [fields.context, fields.action, fields.impact].filter(isFilled) as string[];
  if (relevant.length === 0) return null;
  const concreteCount = relevant.filter(hasConcreteDetail).length;
  const ratio = concreteCount / relevant.length;
  if (ratio >= 0.75) return 5;
  if (ratio >= 0.5) return 4;
  if (ratio > 0) return 3;
  return 2;
}

/** 1-5 or null. How many of the seven CMCAITF slots are actually filled. */
function scoreCompleteness(fields: CmcaitfFields): number | null {
  const filled = filledFieldsOf(fields).length;
  if (filled === 0) return null;
  if (filled >= 6) return 5;
  if (filled >= 5) return 4;
  if (filled >= 3) return 3;
  if (filled >= 2) return 2;
  return 1;
}

/**
 * 1-5 or null. Needs Action AND (Challenge or Impact) to say anything about
 * cause and effect at all — a record with only Context filled cannot be
 * scored on causal clarity, because there is no described cause to link to
 * an effect.
 */
function scoreCausalClarity(fields: CmcaitfFields): number | null {
  const hasAction = isFilled(fields.action);
  const hasEffect = isFilled(fields.challenge) || isFilled(fields.impact);
  if (!hasAction || !hasEffect) return null;

  const combined = [fields.action, fields.challenge, fields.impact].filter(isFilled).join(' ');
  const hasConnective = CAUSAL_CONNECTIVE_PATTERN.test(combined);
  const bothPresent = isFilled(fields.action) && isFilled(fields.impact);

  if (hasConnective && bothPresent) return 5;
  if (bothPresent) return 4;
  if (hasConnective) return 3;
  return 2;
}

/** 1-5 or null. First-person, active-voice ownership of the action described. */
function scorePersonalVoice(fields: CmcaitfFields): number | null {
  const relevant = [fields.action, fields.motivation].filter(isFilled) as string[];
  if (relevant.length === 0) return null;
  const combined = relevant.join(' ');
  const firstPerson = FIRST_PERSON_PATTERN.test(combined);
  const hasMotivation = isFilled(fields.motivation);
  if (firstPerson && hasMotivation) return 5;
  if (firstPerson || hasMotivation) return 4;
  return 2;
}

/**
 * 1-5 or null. Needs Transformation itself, ideally paired with Future — a
 * record that only says WHAT happened without saying how the student changed
 * cannot be scored here at all, which is the point: transformation cannot be
 * inferred from action alone.
 */
function scoreTransformationDepth(fields: CmcaitfFields): number | null {
  if (!isFilled(fields.transformation)) return null;
  const hasFuture = isFilled(fields.future);
  const concrete = hasConcreteDetail(fields.transformation as string);
  if (concrete && hasFuture) return 5;
  if (concrete || hasFuture) return 4;
  return 3;
}

const METRIC_SCORERS: Record<ReflectionMetricKey, (fields: CmcaitfFields) => number | null> = {
  specificity: scoreSpecificity,
  completeness: scoreCompleteness,
  causalClarity: scoreCausalClarity,
  personalVoice: scorePersonalVoice,
  transformationDepth: scoreTransformationDepth,
};

/** Rescale a 1-5 metric to 0-100 so the formula's weights apply on the same scale as the rest of the engine. */
function to100(fiveScale: number): number {
  return ((fiveScale - 1) / 4) * 100;
}

export function scoreReflection(record: ReflectionRecord): ReflectionScore {
  const metrics = {
    specificity: METRIC_SCORERS.specificity(record.cmcaitf),
    completeness: METRIC_SCORERS.completeness(record.cmcaitf),
    causalClarity: METRIC_SCORERS.causalClarity(record.cmcaitf),
    personalVoice: METRIC_SCORERS.personalVoice(record.cmcaitf),
    transformationDepth: METRIC_SCORERS.transformationDepth(record.cmcaitf),
  } as Record<ReflectionMetricKey, number | null>;

  const weighted = weightedScore(
    (Object.keys(REFLECTION_METRIC_WEIGHTS) as ReflectionMetricKey[]).map((key) => ({
      key,
      weight: REFLECTION_METRIC_WEIGHTS[key],
      value: metrics[key] === null ? null : to100(metrics[key] as number),
    })),
  );

  const filledFields = filledFieldsOf(record.cmcaitf);
  const missingFields = (Object.keys(record.cmcaitf) as (keyof CmcaitfFields)[]).filter(
    (key) => !filledFields.includes(key),
  );

  const limitations: string[] = [];
  if (weighted.missingKeys.length > 0) {
    limitations.push(
      `Not enough reflection detail to score: ${weighted.missingKeys.join(', ')}.`,
    );
  }
  if (!record.structuredCapture) {
    limitations.push('CMCAITF fields were inferred from free text, not captured as separate answers.');
  }

  return {
    id: `f1:${record.id}`,
    frameworkId: 'F1',
    activityId: record.id,
    status:
      weighted.score === null
        ? 'unassessed'
        : weighted.presentKeys.length === Object.keys(REFLECTION_METRIC_WEIGHTS).length
          ? 'full'
          : 'limited',
    score: weighted.score,
    confidence: confidenceFromCoverage(
      weighted.presentKeys.length,
      Object.keys(REFLECTION_METRIC_WEIGHTS).length,
    ),
    kind: weighted.score === null ? 'missing' : 'observation',
    evidenceRefs: [{ id: record.id, kind: 'activity', label: record.title }],
    limitations,
    missingInputs: missingFields.map((field) => `cmcaitf.${field}`),
    metrics,
    filledFields,
    missingFields,
  };
}

export function buildReflectionProfile(records: readonly ReflectionRecord[]): ReflectionProfile {
  const scores = records.map(scoreReflection);
  const assessed = scores.filter((score) => score.score !== null);
  const unassessed = scores.filter((score) => score.score === null);

  return {
    scores,
    assessed,
    unassessed,
    confidence: confidenceFromCoverage(assessed.length, scores.length),
  };
}
