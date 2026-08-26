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

/**
 * Content Block — the genUI vocabulary for a recommendation's detail page.
 *
 * Deliberately a CLOSED, three-member union rather than free-form generated
 * markup: the model picks one of three known-good shapes and fills in that
 * shape's fields, it never invents layout. This is the same discipline
 * `actionType` already applies to "what happens when you click the primary
 * button" — here it's "what does the body of the page look like".
 *
 * `null` when the task is completed elsewhere entirely (`actionType` is
 * `internal_route`/`external_url`/`book_mentor` — the Statement Writer, the
 * CV builder, an advisor booking) — there is nothing to fill in on this page,
 * only a brief and a link to the tool that does the work.
 *
 * Versioning (`v`): OPTIONAL on every variant, and `1` is currently its only
 * legal value. An ABSENT `v` IS a v1 block — legacy rows stay readable and
 * generators are not required to emit it, so there is no migration and no
 * bulk rewrite (plan §6.2). Any other value (a future/unknown version, e.g.
 * `v: 2`) must fail read-back validation — see `parseContentBlock` in
 * `src/features/ai-strategy-dashboard/domain/recommendation.ts` — so an
 * unknown shape degrades to no block instead of being rendered wrong.
 */
export const CONTENT_BLOCK_TYPES = ['structured_table', 'long_text', 'checklist', 'single_select'] as const;
export type ContentBlockType = (typeof CONTENT_BLOCK_TYPES)[number];

export type ContentBlockColumnType = 'text' | 'number' | 'date' | 'select';

export type ContentBlockColumn = {
  /** Stable key for this column's cells — becomes a key in each row of `ContentBlockValue['rows']`. */
  key: string;
  label: string;
  type: ContentBlockColumnType;
  /** Only meaningful when `type` is `'select'`. */
  options?: string[];
};

export type ContentBlock =
  /** Repeatable rows — courses, activities, projects, awards: anything that's a LIST of similar entries. */
  | { type: 'structured_table'; columns: ContentBlockColumn[]; v?: 1 }
  /** A single narrative answer — motivation, impact, personal story: anything that doesn't decompose into rows. */
  | { type: 'long_text'; prompt: string; minWords?: number; semanticKey?: string; v?: 1 }
  /** Discrete steps to complete rather than content to write, e.g. "request official transcripts". */
  | { type: 'checklist'; items: string[]; v?: 1 }
  /** A deterministic planning decision; `semanticKey` is never inferred from UI text. */
  | { type: 'single_select'; prompt: string; options: { value: string; label: string }[]; semanticKey: string; v?: 1 };

/**
 * The student's saved answer for a `ContentBlock`, shaped to match it.
 * `null` until the student has saved anything.
 */
export type ContentBlockValue =
  | { type: 'structured_table'; rows: Record<string, string>[] }
  | { type: 'long_text'; text: string }
  /** The subset of `ContentBlock['items']` (by exact text) the student has ticked. */
  | { type: 'checklist'; checkedItems: string[] }
  | { type: 'single_select'; value: string };

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
  /** See `ContentBlock`'s doc comment — the detail page's genUI body, or null when a tool handles it. */
  contentBlock: ContentBlock | null;
  /** The "What to submit" checklist on the detail page. */
  submitChecklist: string[];
  /** The "Tips" accordion on the detail page. */
  tips: string[];
  /** Starter chips for the AI Coach panel, e.g. "What results should I include?". */
  suggestedQuestions: string[];
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
