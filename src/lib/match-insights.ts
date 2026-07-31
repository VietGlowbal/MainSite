// ============================================================================
// COURSE MATCH INSIGHTS — shared config, types, and scoring helpers
// ----------------------------------------------------------------------------
// A course-match score made of five weighted pillars, scored by AI against the
// user's profile + CV + essay and the course's spec/entry requirements. Each
// pillar carries a *current* score and a *realistic max* (the ceiling if the
// user acts on the recommended improvements). Used by the AI scorer, the
// match-insights API routes, and the apply-page UI so they all agree.
// ============================================================================

export type PillarKey = 'academic' | 'activities' | 'essays' | 'impact' | 'personal';

export type PillarDef = {
  key: PillarKey;
  label: string;
  /** Weight as a fraction (sums to 1 across pillars). */
  weight: number;
  blurb: string;
};

// Weights per the product spec. Kept here (not in the prompt or UI) so they can
// be tuned in one place without a migration.
export const MATCH_PILLARS: PillarDef[] = [
  {
    key: 'academic',
    label: 'Academic',
    weight: 0.2,
    blurb: 'How your past & predicted academic record fits the course and its entry requirements.',
  },
  {
    key: 'activities',
    label: 'Activities',
    weight: 0.15,
    blurb: 'How your extracurriculars and skills add transferable depth for this course.',
  },
  {
    key: 'essays',
    label: 'Essays',
    weight: 0.35,
    blurb: 'How clearly your statement tells a story that admissions for this course would value.',
  },
  {
    key: 'impact',
    label: 'Impact',
    weight: 0.2,
    blurb: 'The growth you’ve shown and how well you present as someone this course will help flourish.',
  },
  {
    key: 'personal',
    label: 'Personal',
    weight: 0.1,
    blurb: 'Your personal story and how this course supports it (background, circumstances, fit).',
  },
];

export const PILLAR_ORDER: PillarKey[] = MATCH_PILLARS.map((p) => p.key);

export const PILLAR_BY_KEY: Record<PillarKey, PillarDef> = Object.fromEntries(
  MATCH_PILLARS.map((p) => [p.key, p]),
) as Record<PillarKey, PillarDef>;

export const MATCH_PROMPT_VERSION = 'match-insights-v2-vi';

export type ImprovementActionType =
  | 'upload_document'
  | 'internal_route'
  | 'external_url'
  | 'book_mentor'
  | 'none';

export type ImprovementAction = {
  id: string;
  pillar: PillarKey;
  /** Short imperative, e.g. "Sharpen your essay's opening". */
  label: string;
  /** How / why it helps. */
  detail: string;
  /** Points this would add to the pillar's current score (0–100 pillar scale). */
  estimatedUplift: number;
  actionType: ImprovementActionType;
  actionTarget?: string;
};

export type PillarBreakdown = {
  /** 0–100. */
  current: number;
  /** 0–100 realistic ceiling if improvements are actioned. Always ≥ current. */
  max: number;
  /** False when we lacked the inputs to score this pillar (e.g. no essay yet). */
  assessed: boolean;
  verdict?: string;
  summary: string;
  evidenceQuotes: string[];
  strengths: string[];
  gaps: string[];
  improvements: ImprovementAction[];
};

export type MatchInputsPresent = {
  profile: boolean;
  cv: boolean;
  essay: boolean;
  activities: boolean;
};

export type MatchInsights = {
  pillars: Record<PillarKey, PillarBreakdown>;
  /** 0–100 — how much real input data backed the analysis. */
  confidence: number;
  inputsPresent: MatchInputsPresent;
};

// ── Scoring helpers ─────────────────────────────────────────────────────────

function clamp(n: number, lo = 0, hi = 100): number {
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Weighted overall score over the *assessed* pillars only, re-normalising the
 * weights so unscored pillars (e.g. a missing essay) don't drag the total to
 * zero — they're surfaced separately as "not assessed yet".
 */
export function weightedScore(
  pillars: Record<PillarKey, PillarBreakdown>,
  field: 'current' | 'max',
): number {
  let weightSum = 0;
  let acc = 0;
  for (const def of MATCH_PILLARS) {
    const p = pillars[def.key];
    if (!p || !p.assessed) continue;
    weightSum += def.weight;
    acc += def.weight * clamp(p[field]);
  }
  if (weightSum === 0) return 0;
  return Math.round(acc / weightSum);
}

export function matchLabel(score: number): string {
  if (score >= 85) return 'Strong match';
  if (score >= 70) return 'Good match';
  if (score >= 50) return 'Fair match';
  if (score > 0) return 'Building match';
  return 'Not assessed yet';
}

export function maxMatchLabel(score: number): string {
  if (score >= 85) return 'Strong match achievable';
  if (score >= 70) return 'Good match achievable';
  if (score > 0) return 'Higher match achievable';
  return '—';
}

/** Fraction of the weighted total that an unassessed pillar represents (for "unlock X%"). */
export function pillarWeightPercent(key: PillarKey): number {
  return Math.round((PILLAR_BY_KEY[key]?.weight ?? 0) * 100);
}

/**
 * Apply per-pillar uplifts (e.g. from completed improvement tasks) to produce a
 * *projected* set of pillar scores — each current bumped toward its max, capped
 * at max. Returns a new object; inputs are not mutated.
 */
export function projectPillars(
  pillars: Record<PillarKey, PillarBreakdown>,
  upliftByPillar: Partial<Record<PillarKey, number>>,
): Record<PillarKey, PillarBreakdown> {
  const out = {} as Record<PillarKey, PillarBreakdown>;
  for (const def of MATCH_PILLARS) {
    const p = pillars[def.key];
    if (!p) continue;
    const uplift = upliftByPillar[def.key] ?? 0;
    out[def.key] = uplift > 0 ? { ...p, current: clamp(Math.min(p.max, p.current + uplift)) } : p;
  }
  return out;
}

/** Confidence derived from which inputs were available (fallback when AI omits it). */
export function confidenceFromInputs(inputs: MatchInputsPresent): number {
  // Essay + CV are the heaviest signals; profile + activities round it out.
  const weights = { essay: 40, cv: 30, profile: 20, activities: 10 };
  let score = 0;
  if (inputs.essay) score += weights.essay;
  if (inputs.cv) score += weights.cv;
  if (inputs.profile) score += weights.profile;
  if (inputs.activities) score += weights.activities;
  return clamp(score);
}

export function clampScore(n: unknown): number {
  return clamp(typeof n === 'number' ? n : Number(n));
}
