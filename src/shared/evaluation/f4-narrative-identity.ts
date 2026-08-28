import { weightedScore } from './weighted-score';
import {
  confidenceFromCoverage,
  makeInsight,
  type EvidenceRef,
  type Insight,
} from './types';

/**
 * F4 — Narrative Identity & Personal Branding Framework.
 *
 * F4 SYNTHESISES ACROSS ACTIVITIES. Every sub-framework below takes a list of
 * `NarrativeActivity` records — not one record at a time like F1 or F3 — and
 * every one of them respects the same evidence-count floor before it will
 * claim a pattern:
 *
 *   0 activities   → cannot run at all (nothing to synthesise)
 *   1 activity     → cannot establish a recurring pattern (one point has no repetition)
 *   2 activities   → can support an EMERGING pattern (a candidate repetition, not yet mature)
 *   3+ activities  → can support a mature, full synthesis
 *
 * This floor is enforced identically in every sub-framework below rather than
 * left to each to remember — see `synthesisReadiness`.
 */

export type NarrativeActivity = {
  id: string;
  title: string;
  /** Canonical fields frozen in the confirmed snapshot and carried for downstream provenance. */
  organisation?: string | null;
  level?: string | null;
  year?: number | null;
  period?: string | null;
  competition?: string | null;
  evidenceKey?: string | null;
  reviewStatus?: string | null;
  sourceType?: string | null;
  sources?: unknown[];
  reflection?: Record<string, unknown> | null;
  reflectionCard?: Record<string, unknown> | null;
  /** The role the student actually played — a behaviour, not a job title. E.g. "organised weekly sessions", not "leader". */
  role: string | null;
  /** What the student did, in their own words or paraphrased from the record. */
  behaviour: string | null;
  /** The problem/domain this activity relates to, e.g. "education access" — a theme, never a competency label like "leadership". */
  domainTheme: string | null;
  /** Why the student says they did this, when they have said so explicitly. Null if not stated — never inferred as fact from repetition alone. */
  statedMotivation: string | null;
  /** What changed because of this activity. */
  outcome: string | null;
  evidenceRefs: EvidenceRef[];
};

export type SynthesisReadiness = {
  activityCount: number;
  /** 'none' | 'insufficient' | 'emerging' | 'mature' — see the module header. */
  level: 'none' | 'insufficient' | 'emerging' | 'mature';
};

export function synthesisReadiness(activities: readonly NarrativeActivity[]): SynthesisReadiness {
  const activityCount = activities.length;
  if (activityCount === 0) return { activityCount, level: 'none' };
  if (activityCount === 1) return { activityCount, level: 'insufficient' };
  if (activityCount === 2) return { activityCount, level: 'emerging' };
  return { activityCount, level: 'mature' };
}

// ── Base F4 metrics ──────────────────────────────────────────────────────────

/**
 * The five base metrics, before the six explicit sub-frameworks:
 *
 *   Pattern consistency   25%
 *   Thematic convergence   20%
 *   Growth arc              20%
 *   Differentiation         20%
 *   Evidence density        15%
 *
 * These summarise the RAW synthesis material the sub-frameworks then use —
 * they are not a duplicate score of F4.1-F4.6, they are the health check on
 * whether there is enough here to run them meaningfully at all.
 */
export type NarrativeMetricKey =
  | 'patternConsistency'
  | 'thematicConvergence'
  | 'growthArc'
  | 'differentiation'
  | 'evidenceDensity';

export const NARRATIVE_METRIC_WEIGHTS: Record<NarrativeMetricKey, number> = {
  patternConsistency: 0.25,
  thematicConvergence: 0.2,
  growthArc: 0.2,
  differentiation: 0.2,
  evidenceDensity: 0.15,
};

function nonEmpty(value: string | null): value is string {
  return Boolean(value && value.trim().length > 0);
}

/** How many activities share a recognisable behaviour verb/pattern. Null below the 2-activity floor. */
function scorePatternConsistency(activities: readonly NarrativeActivity[]): number | null {
  if (activities.length < 2) return null;
  const withBehaviour = activities.filter((activity) => nonEmpty(activity.behaviour));
  if (withBehaviour.length < 2) return null;
  const ratio = withBehaviour.length / activities.length;
  return Math.round(ratio * 100);
}

/** How many activities converge on the same or related domain theme. Null below the 2-activity floor. */
function scoreThematicConvergence(activities: readonly NarrativeActivity[]): number | null {
  if (activities.length < 2) return null;
  const themes = activities
    .map((activity) => activity.domainTheme?.trim().toLowerCase() ?? null)
    .filter(nonEmpty);
  if (themes.length < 2) return null;
  const counts = new Map<string, number>();
  for (const theme of themes) counts.set(theme, (counts.get(theme) ?? 0) + 1);
  const maxShared = Math.max(...counts.values());
  return Math.round((maxShared / activities.length) * 100);
}

/** Whether outcomes/behaviours show escalation over time (needs at least two activities with outcomes to compare). */
function scoreGrowthArc(activities: readonly NarrativeActivity[]): number | null {
  const withOutcome = activities.filter((activity) => nonEmpty(activity.outcome));
  if (withOutcome.length < 2) return null;
  // Deterministic proxy: outcomes that mention a number tend to describe a
  // measurable, escalating result rather than a static description.
  const quantified = withOutcome.filter((activity) => /\d/.test(activity.outcome as string));
  return Math.round((quantified.length / withOutcome.length) * 100);
}

/** How distinct this student's combination of theme + behaviour is from a single generic trait. Needs role AND theme on at least two activities. */
function scoreDifferentiation(activities: readonly NarrativeActivity[]): number | null {
  const withBoth = activities.filter((activity) => nonEmpty(activity.role) && nonEmpty(activity.domainTheme));
  if (withBoth.length < 2) return null;
  const distinctThemes = new Set(withBoth.map((activity) => activity.domainTheme?.trim().toLowerCase()));
  // More than one theme combined with a consistent role is what makes a
  // combination distinctive rather than a single narrow trait.
  return distinctThemes.size > 1 ? 80 : 55;
}

/**
 * Coverage: what share of activities carry evidence references at all. Held
 * to the same 2-activity floor as the other base metrics — a "density"
 * computed over a single activity is not describing a pattern of coverage,
 * it is one data point, and F4's base metrics exist to gauge whether a
 * cross-activity synthesis is meaningful at all.
 */
function scoreEvidenceDensity(activities: readonly NarrativeActivity[]): number | null {
  if (activities.length < 2) return null;
  const withEvidence = activities.filter((activity) => activity.evidenceRefs.length > 0);
  return Math.round((withEvidence.length / activities.length) * 100);
}

export type NarrativeBaseMetrics = Insight & {
  metrics: Record<NarrativeMetricKey, number | null>;
  readiness: SynthesisReadiness;
};

export function scoreNarrativeBase(activities: readonly NarrativeActivity[]): NarrativeBaseMetrics {
  const readiness = synthesisReadiness(activities);
  const metrics: Record<NarrativeMetricKey, number | null> = {
    patternConsistency: scorePatternConsistency(activities),
    thematicConvergence: scoreThematicConvergence(activities),
    growthArc: scoreGrowthArc(activities),
    differentiation: scoreDifferentiation(activities),
    evidenceDensity: scoreEvidenceDensity(activities),
  };

  const weighted = weightedScore(
    (Object.keys(NARRATIVE_METRIC_WEIGHTS) as NarrativeMetricKey[]).map((key) => ({
      key,
      weight: NARRATIVE_METRIC_WEIGHTS[key],
      value: metrics[key],
    })),
  );

  const limitations: string[] = [];
  if (readiness.level === 'none') limitations.push('No activities recorded — nothing to synthesise.');
  if (readiness.level === 'insufficient') {
    limitations.push('Only one activity recorded — a recurring pattern needs at least two.');
  }
  if (readiness.level === 'emerging') {
    limitations.push('Only two activities recorded — patterns below are emerging, not yet established.');
  }
  if (weighted.missingKeys.length > 0) {
    limitations.push(`Not enough material to score: ${weighted.missingKeys.join(', ')}.`);
  }

  return {
    ...makeInsight({
      id: 'f4:base',
      frameworkId: 'F4',
      status: readiness.level,
      score: weighted.score,
      confidence: confidenceFromCoverage(weighted.presentKeys.length, Object.keys(NARRATIVE_METRIC_WEIGHTS).length),
      kind: weighted.score === null ? 'missing' : 'inference',
      limitations,
      missingInputs: weighted.missingKeys,
      evidenceRefs: activities.flatMap((activity) => activity.evidenceRefs),
    }),
    metrics,
    readiness,
  };
}

// ── F4.1 Identity Synthesis ──────────────────────────────────────────────────

/**
 * Recurring role + recurring behaviour + value orientation, described as
 * BEHAVIOUR, never adjectives.
 *
 *   bad:    "Passionate global leader"
 *   better: "A builder who repeatedly turns student needs into practical
 *            initiatives."
 *
 * This module does not generate that sentence — composing natural language
 * from the extracted pattern is the AI's job (src/lib/ai/evaluation), given
 * this module's structured output as its ONLY input, so it cannot invent a
 * role or behaviour this function did not find. What this function decides
 * deterministically is WHETHER a recurring role and behaviour exist at all,
 * and what they are, structurally.
 */
export type IdentitySynthesis = Insight & {
  recurringRole: string | null;
  recurringBehaviour: string | null;
  /** The domain/value the behaviour tends to serve — not a trait adjective. */
  valueOrientation: string | null;
  /** Explicit Personal Reflection signals kept separate from activity inference. */
  reflectionSignals?: Record<string, string>;
};

type ReflectionIdentitySignal = {
  dimension: string;
  value: string;
  status?: 'repeated' | 'isolated';
};

/** Exact-match recurrence — for fields expected to repeat literally, like a role label or a domain theme. */
function mostCommon(values: readonly string[]): string | null {
  if (values.length === 0) return null;
  const counts = new Map<string, number>();
  for (const value of values) {
    const key = value.trim().toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [key, count] of counts) {
    if (count > bestCount) {
      best = key;
      bestCount = count;
    }
  }
  return bestCount >= 2 ? best : null;
}

/**
 * Recurrence by leading verb — for free-text behaviour descriptions, which
 * legitimately vary in phrasing ("built a structured weekly programme",
 * "built a curriculum and recruited 20 members") while still describing the
 * SAME recurring method. Exact-string matching would treat these as
 * unrelated and report no pattern at all, which is wrong — the recurrence is
 * real, it just is not word-for-word. Composing the eventual polished
 * sentence from this verb is the AI layer's job (core principle 9); this
 * function only decides whether a shared verb recurs.
 */
function mostCommonLeadingVerb(values: readonly string[]): string | null {
  if (values.length === 0) return null;
  const counts = new Map<string, number>();
  for (const value of values) {
    const match = value.trim().match(/^[A-Za-z]+/);
    if (!match) continue;
    const word = match[0].toLowerCase();
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [word, count] of counts) {
    if (count > bestCount) {
      best = word;
      bestCount = count;
    }
  }
  return bestCount >= 2 ? best : null;
}

export function synthesizeIdentity(
  activities: readonly NarrativeActivity[],
  reflectionSignals: readonly ReflectionIdentitySignal[] = [],
): IdentitySynthesis {
  const readiness = synthesisReadiness(activities);
  const roles = activities.map((activity) => activity.role).filter(nonEmpty);
  const behaviours = activities.map((activity) => activity.behaviour).filter(nonEmpty);
  const themes = activities.map((activity) => activity.domainTheme).filter(nonEmpty);

  const canSynthesise = readiness.level === 'mature' || readiness.level === 'emerging';
  const recurringRole = canSynthesise ? mostCommon(roles) : null;
  // Behaviour phrasing varies activity to activity; recurrence is detected by
  // leading verb, and the representative phrase shown is the actual text of
  // whichever activity used it, not the bare verb alone — see
  // mostCommonLeadingVerb's header.
  const recurringVerb = canSynthesise ? mostCommonLeadingVerb(behaviours) : null;
  const recurringBehaviour = recurringVerb
    ? behaviours.find((behaviour) => behaviour.toLowerCase().startsWith(recurringVerb)) ?? null
    : null;
  const explicitValues = reflectionSignals
    .filter(
      (signal) =>
        signal.status === 'repeated' &&
        ['interests_motivations', 'values_growth', 'problem_domains'].includes(signal.dimension),
    )
    .map((signal) => signal.value.trim())
    .filter(nonEmpty);
  const valueOrientation =
    (readiness.level === 'mature' ? mostCommon(themes) : null) ??
    (canSynthesise ? explicitValues[0] ?? null : null);

  const found = [recurringRole, recurringBehaviour, valueOrientation].filter(Boolean).length;

  const limitations: string[] = [];
  if (readiness.level === 'insufficient' || readiness.level === 'none') {
    limitations.push('Cannot establish a recurring identity from fewer than two activities.');
  }
  if (readiness.level === 'emerging' && !valueOrientation) {
    limitations.push('Value orientation needs a mature (3+) synthesis to be established.');
  }

  return {
    ...makeInsight({
      id: 'f4.1:identity',
      frameworkId: 'F4.1',
      status:
        readiness.level === 'none' || readiness.level === 'insufficient'
          ? 'insufficient'
          : found === 0
            ? 'no_pattern'
            : readiness.level === 'mature'
              ? 'established'
              : 'emerging',
      confidence: readiness.level === 'mature' ? 'high' : readiness.level === 'emerging' ? 'medium' : 'low',
      kind: found > 0 ? 'inference' : 'missing',
      limitations,
      missingInputs: [
        ...(recurringRole ? [] : ['role']),
        ...(recurringBehaviour ? [] : ['behaviour']),
        ...(valueOrientation ? [] : ['valueOrientation']),
      ],
      evidenceRefs: activities.flatMap((activity) => activity.evidenceRefs),
    }),
    recurringRole,
    recurringBehaviour,
    valueOrientation,
    reflectionSignals: Object.fromEntries(
      reflectionSignals.map((signal) => [signal.dimension, signal.value]),
    ),
  };
}

// ── F4.2 Motivation Consistency ──────────────────────────────────────────────

export type MotivationStatus = 'established' | 'emerging' | 'hypothesis' | 'insufficient';

export type MotivationConsistency = Insight & {
  motivationStatus: MotivationStatus;
  /** The motivation text itself, ONLY when explicitly stated by the student on at least one activity — never inferred as fact from repeated choice alone. */
  statedMotivation: string | null;
  recurrenceCount: number;
  personallyGrounded: boolean;
  actionAligned: boolean;
};

/**
 * Core rule: "Never infer an internal motivation as fact solely from repeated
 * activity choice." Repetition alone can only ever produce a `hypothesis` —
 * status can reach `established` ONLY when the student explicitly stated a
 * motivation somewhere in the record.
 */
export function assessMotivationConsistency(activities: readonly NarrativeActivity[]): MotivationConsistency {
  const readiness = synthesisReadiness(activities);
  const stated = activities.map((activity) => activity.statedMotivation).filter(nonEmpty);
  /*
   * `recurrenceCount` counts how many DIFFERENT activities the student
   * explicitly stated a motivation for — not how many used identical
   * wording. A student who explains their reason in their own words each
   * time is not less consistent than one who repeats a stock phrase; what
   * matters is that they explained themselves more than once. The
   * representative motivation shown is simply the first one stated.
   */
  const recurrenceCount = stated.length;
  const explicitMotivation = stated[0] ?? null;

  const personallyGrounded = recurrenceCount > 0;
  const themes = activities.map((activity) => activity.domainTheme).filter(nonEmpty);
  const actionAligned = readiness.level !== 'insufficient' && readiness.level !== 'none' && mostCommon(themes) !== null;

  let motivationStatus: MotivationStatus;
  if (readiness.level === 'none' || readiness.level === 'insufficient') {
    motivationStatus = 'insufficient';
  } else if (recurrenceCount === 0) {
    // Nothing stated at all — repetition of activity choice is not allowed to
    // become an "established" or even "emerging" claim about motivation.
    motivationStatus = readiness.level === 'mature' ? 'hypothesis' : 'insufficient';
  } else if (recurrenceCount >= 2 && readiness.level === 'mature') {
    motivationStatus = 'established';
  } else {
    motivationStatus = 'emerging';
  }

  const limitations: string[] = [];
  if (motivationStatus === 'hypothesis') {
    limitations.push('Motivation is inferred from repeated activity choice only — the student has not stated it explicitly. This is a hypothesis, not a fact.');
  }
  if (motivationStatus === 'insufficient') {
    limitations.push('Not enough activity or explicit statement to assess motivation consistency.');
  }

  return {
    ...makeInsight({
      id: 'f4.2:motivation',
      frameworkId: 'F4.2',
      status: motivationStatus,
      confidence: motivationStatus === 'established' ? 'high' : motivationStatus === 'emerging' ? 'medium' : 'low',
      kind: motivationStatus === 'hypothesis' ? 'inference' : recurrenceCount > 0 ? 'observation' : 'missing',
      limitations,
      missingInputs: recurrenceCount === 0 ? ['statedMotivation'] : [],
      evidenceRefs: activities.flatMap((activity) => activity.evidenceRefs),
    }),
    motivationStatus,
    statedMotivation: recurrenceCount > 0 ? explicitMotivation : null,
    recurrenceCount,
    personallyGrounded,
    actionAligned,
  };
}

// ── F4.3 Behavioral Pattern Extraction ───────────────────────────────────────

export type SignaturePattern = {
  trigger: string;
  response: string;
  method: string;
  valueCreated: string;
};

export type BehavioralPatternResult = Insight & {
  /** Null unless repeated evidence across activities supports a pattern. */
  pattern: SignaturePattern | null;
};

/**
 * A pattern is only ever established from REPEATED evidence — never from one
 * activity. This function does not compose the trigger→response→method→value
 * sentence itself (that is language generation, reserved for the AI layer);
 * it decides structurally whether the four slots can be filled from what
 * recurs across at least two activities, using the same fields F4.1 already
 * extracted (role → response, behaviour → method, domainTheme → value/trigger
 * proxy).
 */
export function extractBehavioralPattern(activities: readonly NarrativeActivity[]): BehavioralPatternResult {
  const readiness = synthesisReadiness(activities);
  if (readiness.level === 'none' || readiness.level === 'insufficient') {
    return {
      ...makeInsight({
        id: 'f4.3:pattern',
        frameworkId: 'F4.3',
        status: 'insufficient',
        confidence: 'low',
        kind: 'missing',
        limitations: ['A behavioural pattern needs repeated evidence across at least two activities.'],
        missingInputs: ['activities'],
      }),
      pattern: null,
    };
  }

  const behaviours = activities.map((activity) => activity.behaviour).filter(nonEmpty);
  const roles = activities.map((activity) => activity.role).filter(nonEmpty);
  const themes = activities.map((activity) => activity.domainTheme).filter(nonEmpty);
  const outcomes = activities.map((activity) => activity.outcome).filter(nonEmpty);

  const methodVerb = mostCommonLeadingVerb(behaviours);
  const method = methodVerb ? behaviours.find((behaviour) => behaviour.toLowerCase().startsWith(methodVerb)) ?? null : null;
  const response = mostCommon(roles);
  const trigger = mostCommon(themes);
  // Outcomes are freely-worded results, not a recurring label — the pattern
  // only needs to show that value IS created repeatedly, not that the same
  // sentence recurs. Any qualifying (2+) outcome stands for "value created".
  const valueCreated = outcomes.length >= 2 ? outcomes[0] ?? null : null;

  const filledSlots = [trigger, response, method, valueCreated].filter(Boolean).length;
  const pattern =
    filledSlots >= 3 && trigger && response && method
      ? { trigger, response, method, valueCreated: valueCreated ?? 'Outcome not yet consistently recorded' }
      : null;

  const limitations: string[] = [];
  if (!pattern) {
    limitations.push('Not enough repeated evidence to fill trigger, response and method consistently.');
  }
  if (pattern && !valueCreated) {
    limitations.push('The value created by this pattern is not yet consistently recorded.');
  }

  return {
    ...makeInsight({
      id: 'f4.3:pattern',
      frameworkId: 'F4.3',
      status: pattern ? (readiness.level === 'mature' ? 'established' : 'emerging') : 'no_pattern',
      confidence: pattern && readiness.level === 'mature' ? 'high' : pattern ? 'medium' : 'low',
      kind: pattern ? 'inference' : 'missing',
      limitations,
      missingInputs: pattern ? [] : ['trigger', 'response', 'method'],
      evidenceRefs: activities.flatMap((activity) => activity.evidenceRefs),
    }),
    pattern,
  };
}

// ── F4.4 Theme Maturity ──────────────────────────────────────────────────────

export type ThemeMaturityStatus = 'established_theme' | 'strong_emerging_theme' | 'early_signal' | 'possible_theme';

export type ThemeMaturityResult = {
  theme: string;
  status: ThemeMaturityStatus;
  /** How many activities explicitly or implicitly link to this theme. */
  evidenceCount: number;
  explicitLinkCount: number;
};

/**
 * A theme is a problem/domain the student cares about — "Education access",
 * "Technology for inclusion", "Sustainable business" — NEVER a competency
 * like "Leadership" or "Communication". Callers are expected to pass in
 * domain themes, not skill labels; this function does not attempt to
 * distinguish the two itself, because that judgement (is "youth mental
 * health" a theme or is "public speaking" a skill dressed up as one) is
 * exactly the kind of semantic call reserved for the AI extraction layer.
 * What this function does deterministically is grade MATURITY once a
 * candidate theme and its supporting activities are given.
 */
export function assessThemeMaturity(
  theme: string,
  activities: readonly { linked: 'explicit' | 'implicit' | 'none' }[],
): ThemeMaturityResult {
  const explicitLinkCount = activities.filter((activity) => activity.linked === 'explicit').length;
  const evidenceCount = activities.filter((activity) => activity.linked !== 'none').length;

  let status: ThemeMaturityStatus;
  if (evidenceCount >= 3 && explicitLinkCount >= 2) {
    status = 'established_theme';
  } else if (evidenceCount >= 3 || (evidenceCount === 2 && explicitLinkCount >= 1)) {
    status = 'strong_emerging_theme';
  } else if (evidenceCount === 2) {
    status = 'early_signal';
  } else {
    status = 'possible_theme';
  }

  return { theme, status, evidenceCount, explicitLinkCount };
}

export const THEME_MATURITY_LABEL: Record<ThemeMaturityStatus, string> = {
  established_theme: 'Established theme',
  strong_emerging_theme: 'Strong emerging theme',
  early_signal: 'Early signal',
  possible_theme: 'Possible theme',
};

// ── F4.5 Applicant Positioning ───────────────────────────────────────────────

export type PositioningStatus =
  | 'strong_positioning'
  | 'emerging_positioning'
  | 'broad_positioning'
  | 'fragmented_positioning'
  | 'insufficient_data';

export type ApplicantPositioning = Insight & {
  positioningStatus: PositioningStatus;
  identity: string | null;
  signatureStrength: string | null;
  theme: string | null;
  intendedDirection: string | null;
  authentic: boolean;
  differentiated: boolean;
  coherent: boolean;
  directionAligned: boolean;
  credible: boolean;
  /** Whether the positioning intersection had capability and motivation inputs. */
  capabilityInformed?: boolean;
  motivationInformed?: boolean;
};

/**
 * F4.5 = Identity + Signature strength + Theme + Intended direction, assessed
 * for authenticity, differentiation, coherence, direction alignment and
 * credibility. This function composes ONLY from what F4.1/F4.3/F4.4 (or their
 * equivalents supplied directly, e.g. in tests) already established — it adds
 * no new inference of its own about the student.
 */
export function assessApplicantPositioning(args: {
  identity: IdentitySynthesis;
  pattern: BehavioralPatternResult;
  theme: ThemeMaturityResult | null;
  intendedDirection: string | null;
  /** Whether the identity/pattern/theme all point toward the same thing rather than pulling in different directions. */
  coherent: boolean;
  /** Optional intersection inputs. Omitted for legacy callers/tests; supplied by the profile engine. */
  capabilityEvidenceRefs?: readonly EvidenceRef[];
  motivationEvidenceRefs?: readonly EvidenceRef[];
  themeEvidenceRefs?: readonly EvidenceRef[];
}): ApplicantPositioning {
  const {
    identity,
    pattern,
    theme,
    intendedDirection,
    coherent,
    capabilityEvidenceRefs,
    motivationEvidenceRefs,
    themeEvidenceRefs,
  } = args;

  const identityLabel = identity.recurringBehaviour ?? identity.recurringRole;
  const signatureStrength = pattern.pattern ? pattern.pattern.method : null;
  const themeLabel = theme?.theme ?? null;

  const authentic = Boolean(identityLabel) && identity.kind !== 'missing';
  const differentiated = Boolean(signatureStrength) && Boolean(themeLabel);
  const directionAligned = Boolean(intendedDirection) && Boolean(themeLabel);
  const capabilityInformed = capabilityEvidenceRefs === undefined || capabilityEvidenceRefs.length > 0;
  const motivationInformed = motivationEvidenceRefs === undefined || motivationEvidenceRefs.length > 0;
  const credible =
    identity.evidenceRefs.length > 0 &&
    pattern.evidenceRefs.length > 0 &&
    (theme?.evidenceCount ?? 0) > 0 &&
    capabilityInformed &&
    motivationInformed;

  const strongCount = [authentic, differentiated, coherent, directionAligned, credible].filter(Boolean).length;

  let positioningStatus: PositioningStatus;
  if (!identityLabel && !signatureStrength && !themeLabel) {
    positioningStatus = 'insufficient_data';
  } else if (strongCount >= 4) {
    positioningStatus = 'strong_positioning';
  } else if (strongCount >= 3) {
    positioningStatus = 'emerging_positioning';
  } else if (differentiated || coherent) {
    positioningStatus = 'broad_positioning';
  } else {
    positioningStatus = 'fragmented_positioning';
  }

  const limitations: string[] = [];
  if (!coherent) limitations.push('Identity, signature pattern and theme do not yet point toward the same direction.');
  if (!credible) limitations.push('Not every element of this positioning is backed by linked evidence.');
  if (!intendedDirection) limitations.push('No stated intended direction to check alignment against.');
  if (!capabilityInformed) limitations.push('No grounded capability evidence is available for the positioning intersection.');
  if (!motivationInformed) limitations.push('No motivation evidence is available for the positioning intersection.');

  return {
    ...makeInsight({
      id: 'f4.5:positioning',
      frameworkId: 'F4.5',
      status: positioningStatus,
      confidence: strongCount >= 4 ? 'high' : strongCount >= 2 ? 'medium' : 'low',
      kind: positioningStatus === 'insufficient_data' ? 'missing' : 'inference',
      limitations,
      missingInputs: [
        ...(identityLabel ? [] : ['identity']),
        ...(signatureStrength ? [] : ['signatureStrength']),
        ...(themeLabel ? [] : ['theme']),
        ...(intendedDirection ? [] : ['intendedDirection']),
      ],
      evidenceRefs: [
        ...identity.evidenceRefs,
        ...pattern.evidenceRefs,
        ...(themeEvidenceRefs ?? []),
        ...(capabilityEvidenceRefs ?? []),
        ...(motivationEvidenceRefs ?? []),
      ],
    }),
    positioningStatus,
    identity: identityLabel,
    signatureStrength,
    theme: themeLabel,
    intendedDirection,
    authentic,
    differentiated,
    coherent,
    directionAligned,
    credible,
    capabilityInformed,
    motivationInformed,
  };
}

// ── F4.6 Evidence-to-Identity Mapping ────────────────────────────────────────

export type EvidenceStrength = 'strong' | 'moderate' | 'limited';

export type IdentityProof = {
  activityId: string;
  title: string;
  role: string | null;
  personalContribution: string | null;
  outcome: string | null;
  competenciesDemonstrated: string[];
  evidenceStrength: EvidenceStrength;
  evidenceRefs: EvidenceRef[];
};

/**
 * Every major identity claim should map back to supporting evidence. This
 * builds that map — one proof per activity, never a proof with no linked
 * evidence record at all (`evidenceRefs` empty forces `limited`).
 */
export function buildEvidenceToIdentityMap(
  activities: readonly NarrativeActivity[],
  competenciesByActivity: ReadonlyMap<string, string[]>,
): IdentityProof[] {
  return activities.map((activity) => {
    const competencies = competenciesByActivity.get(activity.id) ?? [];
    const hasOutcome = nonEmpty(activity.outcome);
    const hasEvidence = activity.evidenceRefs.length > 0;

    let evidenceStrength: EvidenceStrength;
    if (hasEvidence && hasOutcome && competencies.length > 0) {
      evidenceStrength = 'strong';
    } else if (hasEvidence && (hasOutcome || competencies.length > 0)) {
      evidenceStrength = 'moderate';
    } else {
      evidenceStrength = 'limited';
    }

    return {
      activityId: activity.id,
      title: activity.title,
      role: activity.role,
      personalContribution: activity.behaviour,
      outcome: activity.outcome,
      competenciesDemonstrated: competencies,
      evidenceStrength,
      evidenceRefs: activity.evidenceRefs,
    };
  });
}
