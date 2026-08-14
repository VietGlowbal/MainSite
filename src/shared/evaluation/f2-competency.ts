import { weightedScore } from './weighted-score';
import { confidenceFromCoverage, makeInsight, type Confidence, type EvidenceRef, type Insight } from './types';

/**
 * F2 — Admissions Competency Framework.
 *
 * ─── THIS IS NOT A RELABELLING OF THE FIVE MATCHING PILLARS ─────────────────
 *
 * An earlier implementation (`ai-strategy-dashboard/domain/evaluation/
 * competency.ts`) renamed match-insights' five pillars (academic, activities,
 * essays, impact, personal) into "competencies" and changed nothing else.
 * That is a relabelling, not F2. The canonical F2 evaluates DEMONSTRATED
 * COMPETENCIES — named, evidence-grounded skills — not document-quality
 * pillars. "Essays" is not a competency; "coordinated a 12-person fundraising
 * team that raised $3,000" demonstrates leadership, which is.
 *
 * ─── A SKILL MUST BE GROUNDED IN A CONCRETE SITUATION ────────────────────────
 *
 *   weak:      "leadership"
 *   stronger:  evidence showing HOW the applicant coordinated people and
 *              WHAT happened as a result
 *
 * A `CompetencyClaim` — the skill named plus the situation it came from — is
 * this module's unit of input. Recognising which skill a piece of evidence
 * demonstrates and writing the grounding sentence is genuinely semantic
 * (core principle 9), so that extraction lives in
 * `src/lib/ai/evaluation/competency-extraction.ts`. What THIS module does is
 * deterministic: given claims (from the extractor, or from a caller supplying
 * them directly in tests), score how well each is grounded and combine them
 * into the three weighted categories. A claim with no evidenceRefs and no
 * concrete situation text cannot score above the weak floor, regardless of
 * what the model claimed about it — grounding is checked here, not trusted
 * there.
 *
 * ─── THE THREE CATEGORIES AND THE FORMULA ────────────────────────────────────
 *
 *   Hard-skill specificity   30%   (a named, checkable technical/academic skill)
 *   Soft-skill specificity   35%   (interpersonal/behavioural, grounded in a situation)
 *   Meta-skill / self-awareness 35%  (reflection ON a skill — knowing what you're
 *                                     good at and why, not just doing the thing)
 *
 *   F2 = 0.30·HardSkill + 0.35·SoftSkill + 0.35·MetaSkill
 *
 * Each category is itself an average of that category's claim groundedness
 * scores (0-100). A category with no claims at all is N/A and the remaining
 * weights are renormalized (core principle 6) — a student who has entered no
 * evidence of self-awareness does not silently score zero on it; the category
 * is reported unassessed.
 */

export type CompetencyType = 'hard' | 'soft' | 'meta';

export const COMPETENCY_TYPE_WEIGHT: Record<CompetencyType, number> = {
  hard: 0.3,
  soft: 0.35,
  meta: 0.35,
};

/**
 * One claimed competency, grounded (or not) in a specific piece of evidence.
 * This is the extractor's output shape — see the module header — but nothing
 * stops a caller (a test, or a future manual-entry path) from constructing
 * these directly.
 */
export type CompetencyClaim = {
  id: string;
  type: CompetencyType;
  /** The named skill, e.g. "Leadership", "Statistical reasoning", "Self-awareness of communication style". */
  label: string;
  /**
   * The concrete situation this is grounded in, in the applicant's own words
   * or paraphrased from their record — NOT a generic trait description. Null
   * means the claim has no grounding text at all (a bare trait label), which
   * caps its groundedness score regardless of type.
   */
  situation: string | null;
  evidenceRefs: EvidenceRef[];
};

export type CompetencyScore = Insight & {
  claimId: string;
  type: CompetencyType;
  label: string;
  /** 0-100 — how concretely this claim is grounded. Never null; an ungrounded claim scores low, it does not become unassessed. */
  groundedness: number;
};

export type CompetencyCategoryResult = {
  type: CompetencyType;
  /** null when no claims of this type exist — reported as unassessed, not zero. */
  score: number | null;
  claims: CompetencyScore[];
  confidence: Confidence;
};

export type CompetencyProfile = Insight & {
  categories: Record<CompetencyType, CompetencyCategoryResult>;
  claims: CompetencyScore[];
};

/** A number, named organisation/person, or quantified outcome — the marker that separates "led a team" from "coordinated 12 volunteers to run a 3-day food drive that served 400 families". */
function hasConcreteDetail(text: string): boolean {
  return /\d/.test(text) || /[.!?]\s+[A-Z]|(?:^|\s)(?!I\b)[A-Z][a-z]{2,}/.test(text.slice(1));
}

const MIN_SITUATION_LENGTH = 40;

/**
 * Groundedness, 0-100. Deterministic — this is the check that stops a model's
 * confident claim from being trusted at face value (core principle 4: no
 * assumption is allowed IN SCORING, and "the model said this is well
 * evidenced" is an assumption unless verified here).
 *
 *   no situation text at all                       → 20  (bare trait label)
 *   situation text, but short/no concrete detail    → 45
 *   situation text with concrete detail              → 70
 *   situation text with concrete detail + evidenceRef → 90
 */
function scoreGroundedness(claim: CompetencyClaim): number {
  if (!claim.situation || claim.situation.trim().length === 0) return 20;
  const situation = claim.situation.trim();
  const concrete = situation.length >= MIN_SITUATION_LENGTH && hasConcreteDetail(situation);
  if (!concrete) return 45;
  return claim.evidenceRefs.length > 0 ? 90 : 70;
}

export function scoreCompetencyClaim(claim: CompetencyClaim): CompetencyScore {
  const groundedness = scoreGroundedness(claim);
  const limitations: string[] = [];
  if (!claim.situation) {
    limitations.push(`"${claim.label}" has no supporting situation — it is a bare trait label.`);
  } else if (claim.evidenceRefs.length === 0) {
    limitations.push(`"${claim.label}" is grounded in a described situation but has no linked evidence record.`);
  }

  return {
    id: `f2:${claim.id}`,
    frameworkId: 'F2',
    claimId: claim.id,
    type: claim.type,
    label: claim.label,
    status: groundedness >= 70 ? 'grounded' : groundedness >= 45 ? 'partially_grounded' : 'ungrounded',
    score: groundedness,
    groundedness,
    confidence: claim.evidenceRefs.length > 0 ? 'high' : claim.situation ? 'medium' : 'low',
    kind: claim.evidenceRefs.length > 0 ? 'observation' : 'inference',
    evidenceRefs: claim.evidenceRefs,
    limitations,
    missingInputs: claim.situation ? [] : ['situation'],
  };
}

function buildCategory(type: CompetencyType, claims: readonly CompetencyClaim[]): CompetencyCategoryResult {
  const scored = claims.filter((claim) => claim.type === type).map(scoreCompetencyClaim);
  if (scored.length === 0) {
    return { type, score: null, claims: [], confidence: 'low' };
  }
  const average = scored.reduce((sum, claim) => sum + claim.groundedness, 0) / scored.length;
  const groundedCount = scored.filter((claim) => claim.status !== 'ungrounded').length;

  return {
    type,
    score: average,
    claims: scored,
    confidence: confidenceFromCoverage(groundedCount, scored.length),
  };
}

export function buildCompetencyProfile(claims: readonly CompetencyClaim[]): CompetencyProfile {
  const categories = {
    hard: buildCategory('hard', claims),
    soft: buildCategory('soft', claims),
    meta: buildCategory('meta', claims),
  } as Record<CompetencyType, CompetencyCategoryResult>;

  const weighted = weightedScore(
    (Object.keys(COMPETENCY_TYPE_WEIGHT) as CompetencyType[]).map((type) => ({
      key: type,
      weight: COMPETENCY_TYPE_WEIGHT[type],
      value: categories[type].score,
    })),
  );

  const allClaims = [categories.hard.claims, categories.soft.claims, categories.meta.claims].flat();
  const limitations: string[] = [];
  if (weighted.missingKeys.length > 0) {
    limitations.push(`No evidence yet for: ${weighted.missingKeys.join(', ')}.`);
  }

  const base = makeInsight({
    id: 'f2:profile',
    frameworkId: 'F2',
    status: weighted.score === null ? 'unassessed' : weighted.renormalized ? 'partial' : 'full',
    score: weighted.score,
    confidence: confidenceFromCoverage(weighted.presentKeys.length, Object.keys(COMPETENCY_TYPE_WEIGHT).length),
    kind: weighted.score === null ? 'missing' : 'inference',
    limitations,
    missingInputs: weighted.missingKeys,
  });

  return {
    ...base,
    categories,
    claims: allClaims,
  };
}
