import { z } from 'zod';

/**
 * Final Application Check — domain model.
 *
 * The last surface in the Strategy journey: the student has a Personal Report,
 * a Matching Report, a Strategy Report and a Planner, and has actually written
 * the documents. This reviews the application as one package.
 *
 * ─── THE READINESS FIGURE IS COMPUTED, NOT WRITTEN BY A MODEL ────────────────
 *
 * The layout asks for "Overall Readiness: 84%". A model asked to produce that
 * number will produce a plausible one, which is the worst possible outcome: a
 * confident figure with nothing underneath it, attached to the moment a student
 * decides whether to submit. So the percentage is derived here, deterministically,
 * from two things we can actually observe — which components exist, and whether
 * each has been reviewed — minus outstanding critical findings. The model writes
 * the prose; it never writes the score.
 *
 * ─── WHAT THIS MUST NEVER SAY ────────────────────────────────────────────────
 *
 * Readiness measures how complete and internally consistent the application is.
 * It is not a prediction of the outcome, and this report gives no submit-or-do-
 * not-submit advice. That decision belongs to the student and their deadline,
 * not to a percentage. Core principle 7 applies here exactly as it does to the
 * Matching Report's match score.
 */

export const READINESS_DISCLAIMER =
  'This measures how complete and consistent your application is right now. It is not a prediction of the outcome, and it is not advice about whether to submit.';

/** The components a complete application is checked against. */
export const COMPONENT_KEYS = ['cv', 'essay', 'lor', 'supporting'] as const;

export type ComponentKey = (typeof COMPONENT_KEYS)[number];

/**
 * Weights reflect how much each component carries in a typical application
 * review, and how much of it we can actually see. Supporting materials are
 * weighted lowest because their absence is often correct — many programmes ask
 * for none — so a missing one should not dominate the figure.
 */
export const COMPONENT_WEIGHTS: Record<ComponentKey, number> = {
  cv: 0.3,
  essay: 0.35,
  lor: 0.25,
  supporting: 0.1,
};

export const COMPONENT_LABELS: Record<ComponentKey, string> = {
  cv: 'CV',
  essay: 'Essay',
  lor: 'Letter of recommendation',
  supporting: 'Supporting materials',
};

/**
 * `missing` and `not_required` are deliberately different. A programme that
 * asks for no letter is not an application with a hole in it, and scoring the
 * two the same way would tell a student to fix something that is already fine.
 */
export type ComponentStatus = 'missing' | 'not_required' | 'draft' | 'reviewed';

export type ComponentState = {
  key: ComponentKey;
  status: ComponentStatus;
  /** Set when the student uploaded or last edited this component. */
  updatedAt: string | null;
};

/** Recommended action on a document, from the layout's tiering. */
export type ActionTier = 'critical' | 'strategic' | 'polish';

export const ACTION_TIER_LABELS: Record<ActionTier, string> = {
  critical: 'Critical',
  strategic: 'Strategic',
  polish: 'Polish',
};

export const ACTION_TIER_MEANINGS: Record<ActionTier, string> = {
  critical: 'Materially affects how credible or competitive this application is',
  strategic: 'Meaningfully strengthens the application',
  polish: 'A minor refinement',
};

/**
 * One document's review. Every prose field is model-authored from the actual
 * document; `tier` drives ordering and emphasis. A document that could not be
 * reviewed is absent from the list rather than present with empty prose.
 */
export type DocumentReview = {
  key: ComponentKey;
  /** What this document needs to accomplish in the application. */
  purpose: string;
  /** What it currently demonstrates about the applicant. */
  evidence: string;
  /** Its strongest current quality. */
  strength: string;
  /** What is missing or unconvincing. */
  gap: string;
  /** How it contributes to the overall positioning. */
  strategicContribution: string;
  /** The single highest-value change, and how urgent it is. */
  recommendedAction: string;
  tier: ActionTier;
};

/** One theme running through the application, and where it actually shows up. */
export type NarrativePillar = {
  theme: string;
  evidenceStrength: 'strong' | 'moderate' | 'weak';
  consistency: 'strong' | 'moderate' | 'weak';
  /** Which components carry this theme. Empty means it is claimed but unevidenced. */
  coverage: ComponentKey[];
};

export const CONSISTENCY_CHECK_KEYS = [
  'identity',
  'motivation',
  'evidence',
  'factual',
  'direction',
] as const;

export type ConsistencyCheckKey = (typeof CONSISTENCY_CHECK_KEYS)[number];

export const CONSISTENCY_CHECK_LABELS: Record<ConsistencyCheckKey, string> = {
  identity: 'Identity',
  motivation: 'Motivation',
  evidence: 'Evidence',
  factual: 'Factual detail',
  direction: 'Direction',
};

export type ConsistencyCheck = {
  key: ConsistencyCheckKey;
  verdict: 'consistent' | 'minor_conflict' | 'conflict' | 'not_assessed';
  detail: string;
};

export type NarrativeAudit = {
  /** How the application asks to be remembered, in the student's own terms. */
  coreNarrative: string;
  /** The one line a reader would carry away. */
  whatTheReaderRemembers: string;
  pillars: NarrativePillar[];
  checks: ConsistencyCheck[];
  /** Themes that dominate, and claims that are asserted without support. */
  overweightedThemes: string[];
  unevidencedClaims: string[];
};

export type ReadinessState =
  | 'not_started'
  | 'early'
  | 'taking_shape'
  | 'nearly_there'
  | 'strong';

export const READINESS_STATE_LABELS: Record<ReadinessState, string> = {
  not_started: 'Not started',
  early: 'Early',
  taking_shape: 'Taking shape',
  nearly_there: 'Nearly there',
  strong: 'Strong',
};

export type Readiness = {
  /** 0-100, computed. Never model-authored. */
  percent: number;
  state: ReadinessState;
  /** Components with nothing attached that the programme expects. */
  missing: ComponentKey[];
  /** Components attached but never reviewed. */
  unreviewed: ComponentKey[];
  /** How many critical actions are outstanding across every document. */
  criticalActions: number;
  /** Disclosed when a component was excluded because it is not required. */
  excluded: ComponentKey[];
};

function statusValue(status: ComponentStatus): number | null {
  switch (status) {
    case 'reviewed':
      return 1;
    case 'draft':
      return 0.5;
    case 'missing':
      return 0;
    case 'not_required':
      // Excluded from the average entirely, and its weight redistributed —
      // the same renormalisation rule the evaluation engine uses.
      return null;
  }
}

/**
 * Each outstanding critical finding costs five points, capped at twenty.
 *
 * Uncapped, a thorough review would drive a genuinely well-built application
 * toward zero and read as punishment for having been checked carefully. Capped,
 * the figure still moves enough that clearing criticals is visibly the fastest
 * way to raise it.
 */
export const CRITICAL_ACTION_PENALTY = 5;
export const MAX_CRITICAL_PENALTY = 20;

export function readinessState(percent: number): ReadinessState {
  if (percent <= 0) return 'not_started';
  if (percent < 35) return 'early';
  if (percent < 65) return 'taking_shape';
  if (percent < 85) return 'nearly_there';
  return 'strong';
}

export function computeReadiness(
  components: readonly ComponentState[],
  reviews: readonly DocumentReview[],
): Readiness {
  const byKey = new Map(components.map((component) => [component.key, component]));

  const scored = COMPONENT_KEYS.map((key) => {
    const status = byKey.get(key)?.status ?? 'missing';
    return { key, status, value: statusValue(status) };
  });

  const present = scored.filter((entry) => entry.value !== null);
  const totalWeight = present.reduce((sum, entry) => sum + COMPONENT_WEIGHTS[entry.key], 0);

  const coverage =
    totalWeight <= 0
      ? 0
      : present.reduce(
          (sum, entry) =>
            sum + (entry.value as number) * (COMPONENT_WEIGHTS[entry.key] / totalWeight),
          0,
        );

  const criticalActions = reviews.filter((review) => review.tier === 'critical').length;
  const penalty = Math.min(criticalActions * CRITICAL_ACTION_PENALTY, MAX_CRITICAL_PENALTY);

  const percent = Math.max(0, Math.round(coverage * 100) - penalty);

  return {
    percent,
    state: readinessState(percent),
    missing: scored.filter((entry) => entry.status === 'missing').map((entry) => entry.key),
    unreviewed: scored.filter((entry) => entry.status === 'draft').map((entry) => entry.key),
    criticalActions,
    excluded: scored.filter((entry) => entry.status === 'not_required').map((entry) => entry.key),
  };
}

const TIER_ORDER: Record<ActionTier, number> = { critical: 0, strategic: 1, polish: 2 };

/** Most urgent first, so the section leads with what actually matters. */
export function orderedReviews(reviews: readonly DocumentReview[]): DocumentReview[] {
  return [...reviews].sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier]);
}

/**
 * A pillar the application leans on but cannot support. These are the findings
 * most likely to be challenged by a reader, so they surface separately from the
 * per-document gaps.
 */
export function unsupportedPillars(audit: NarrativeAudit): NarrativePillar[] {
  return audit.pillars.filter(
    (pillar) => pillar.coverage.length === 0 || pillar.evidenceStrength === 'weak',
  );
}

/** Whether there is enough attached to review at all. */
export function canRunFinalCheck(components: readonly ComponentState[]): boolean {
  const usable = components.filter(
    (component) => component.status === 'draft' || component.status === 'reviewed',
  );
  return usable.length >= 2;
}

// ─── PERSISTENCE / AI CONTRACT ───────────────────────────────────────────────

/**
 * The model's half of the report. It writes prose and tiers findings; it never
 * writes the readiness percentage — that is computed by `computeReadiness`.
 *
 * Parsed on read as well as write. `application_final_checks` rows are JSONB,
 * and a malformed row must degrade to "no check yet" rather than crash the
 * page — the same discipline `recommendation.ts` applies to the genUI blocks
 * after known-issues.md §0d.
 */

const componentKeySchema = z.enum(COMPONENT_KEYS);

export const documentReviewSchema = z.object({
  key: componentKeySchema,
  purpose: z.string().min(1).max(600),
  evidence: z.string().min(1).max(900),
  strength: z.string().min(1).max(600),
  gap: z.string().min(1).max(600),
  strategicContribution: z.string().min(1).max(900),
  recommendedAction: z.string().min(1).max(600),
  tier: z.enum(['critical', 'strategic', 'polish']),
});

export const narrativePillarSchema = z.object({
  theme: z.string().min(1).max(120),
  evidenceStrength: z.enum(['strong', 'moderate', 'weak']),
  consistency: z.enum(['strong', 'moderate', 'weak']),
  coverage: z.array(componentKeySchema).max(4),
});

export const consistencyCheckSchema = z.object({
  key: z.enum(CONSISTENCY_CHECK_KEYS),
  verdict: z.enum(['consistent', 'minor_conflict', 'conflict', 'not_assessed']),
  detail: z.string().min(1).max(600),
});

export const narrativeAuditSchema = z.object({
  coreNarrative: z.string().min(1).max(1200),
  whatTheReaderRemembers: z.string().min(1).max(300),
  pillars: z.array(narrativePillarSchema).max(5),
  checks: z.array(consistencyCheckSchema).max(5),
  overweightedThemes: z.array(z.string().min(1).max(200)).max(5),
  unevidencedClaims: z.array(z.string().min(1).max(300)).max(5),
});

export const componentStateSchema = z.object({
  key: componentKeySchema,
  status: z.enum(['missing', 'not_required', 'draft', 'reviewed']),
  updatedAt: z.string().nullable(),
});

/** What the model returns. Note the absence of any readiness field. */
export const finalCheckGenerationSchema = z.object({
  documentReviews: z.array(documentReviewSchema).max(6),
  narrativeAudit: narrativeAuditSchema.nullable(),
  limitations: z.array(z.string().min(1).max(400)).max(8),
});

export type FinalCheckGeneration = z.infer<typeof finalCheckGenerationSchema>;

/** A stored check, as the page reads it. */
export type FinalCheckRecord = {
  id: string;
  readiness: Readiness;
  components: ComponentState[];
  documentReviews: DocumentReview[];
  narrativeAudit: NarrativeAudit | null;
  limitations: string[];
  createdAt: string;
  promptVersion: string;
};

/**
 * Parse a stored row into a record, or null if anything is malformed.
 *
 * Readiness is RECOMPUTED from the stored components and reviews rather than
 * read from the column. The column exists for querying; recomputing here means
 * a change to the formula applies to historical rows too, and the number on
 * screen can never drift from the components shown beside it.
 */
export function parseFinalCheckRow(row: {
  id: string;
  components: unknown;
  document_reviews: unknown;
  narrative_audit: unknown;
  limitations: unknown;
  created_at: string;
  prompt_version: string;
}): FinalCheckRecord | null {
  const components = z.array(componentStateSchema).safeParse(row.components);
  const reviews = z.array(documentReviewSchema).safeParse(row.document_reviews);
  if (!components.success || !reviews.success) return null;

  const audit = row.narrative_audit === null ? null : narrativeAuditSchema.safeParse(row.narrative_audit);
  const limitations = z.array(z.string()).safeParse(row.limitations);

  return {
    id: row.id,
    readiness: computeReadiness(components.data, reviews.data),
    components: components.data,
    documentReviews: reviews.data,
    // A malformed audit degrades to "not available" rather than failing the
    // whole report — the document reviews are still worth showing.
    narrativeAudit: audit && audit.success ? audit.data : null,
    limitations: limitations.success ? limitations.data : [],
    createdAt: row.created_at,
    promptVersion: row.prompt_version,
  };
}
