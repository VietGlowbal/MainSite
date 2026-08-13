import { weightedScore } from './weighted-score';
import { confidenceFromCoverage, type Confidence, type Insight } from './types';

/**
 * F3 — Evidence Hierarchy Framework.
 *
 * ─── THE CANONICAL METRICS ───────────────────────────────────────────────────
 *
 *   Tangible impact quantification    40%   (a number: reach, scale, result)
 *   Intangible impact articulation     30%   (a described change with no number
 *                                              behind it — growth, recognition,
 *                                              relationship — still real, still
 *                                              worth crediting)
 *   Evidence traceability               30%   (can this be checked at all)
 *
 *   F3 = 0.40·TangibleImpact + 0.30·IntangibleImpact + 0.30·Traceability
 *
 * An earlier implementation scored evidence purely on `verified` /
 * `attributable` / `stated` tiers and reach (international/national/…).
 * Those concepts are real and useful, but they are NOT the canonical F3
 * metrics — they are retained here as `EvidenceTier` and `EvidenceReach`
 * because they still answer a genuinely different question (verification
 * status, §B below), not because they substitute for the three metrics above.
 *
 * ─── TWO SEPARATE OUTPUTS, NOT ONE SCORE ─────────────────────────────────────
 *
 * The spec explicitly asks for two things:
 *
 *   A. quality of the evidence   — TangibleImpact + IntangibleImpact + Traceability
 *   B. verification status        — verified / attributable / self-reported,
 *                                    i.e. can anyone other than the student
 *                                    confirm this
 *
 * A piece of evidence can be high-quality (a specific, well-described impact)
 * and unverifiable (nothing but the student's word), or low-quality
 * (a bare "was a member of X club") and fully verified (a certificate
 * attached). Collapsing the two into one number would hide which of them a
 * student needs to fix.
 */

export type EvidenceSourceKind =
  | 'applicant_statement'
  | 'structured_achievement'
  | 'uploaded_document'
  | 'test_record'
  | 'external_attribution';

export type EvidenceTier = 'verified' | 'attributable' | 'stated';
export type EvidenceReach = 'international' | 'national' | 'provincial' | 'district' | 'school' | 'unknown';

export type EvidenceItemInput = {
  id: string;
  title: string;
  sourceKind: EvidenceSourceKind;
  /** A number, scale or measurable reach — e.g. "raised $3,000", "served 400 families". Null if nothing quantified was stated. */
  quantifiedOutcome: string | null;
  /** A described change with no number behind it — e.g. "learned to manage conflict under pressure". Null if nothing was articulated. */
  qualitativeOutcome: string | null;
  /** True when a document (certificate, letter, transcript) is attached. */
  hasDocument: boolean;
  /** The awarding/running body, if named — what makes a claim attributable even without a document. */
  attributingOrganisation: string | null;
  /** Free text — reach bands do not generalise across award systems, so this is parsed, not enumerated. */
  level: string | null;
};

export type EvidenceMetricKey = 'tangibleImpact' | 'intangibleImpact' | 'traceability';

export const EVIDENCE_METRIC_WEIGHTS: Record<EvidenceMetricKey, number> = {
  tangibleImpact: 0.4,
  intangibleImpact: 0.3,
  traceability: 0.3,
};

export type EvidenceItem = Insight & {
  itemId: string;
  title: string;
  metrics: Record<EvidenceMetricKey, number | null>;
  /** B. Verification status — can anyone but the student confirm this. */
  tier: EvidenceTier;
  reach: EvidenceReach;
};

export type EvidenceProfile = {
  items: EvidenceItem[];
  /** Items with a real quality score (at least one metric assessed). */
  assessed: EvidenceItem[];
  /** Items that could not be scored on any quality metric. */
  unassessed: EvidenceItem[];
  counts: Record<EvidenceTier, number>;
  strongest: EvidenceItem[];
  needsProof: EvidenceItem[];
  confidence: Confidence;
};

const REACH_ORDER: Record<EvidenceReach, number> = {
  international: 5,
  national: 4,
  provincial: 3,
  district: 2,
  school: 1,
  unknown: 0,
};

const TIER_ORDER: Record<EvidenceTier, number> = { verified: 3, attributable: 2, stated: 1 };

export const EVIDENCE_TIER_LABEL: Record<EvidenceTier, string> = {
  verified: 'Verified',
  attributable: 'Checkable',
  stated: 'Self-reported',
};

export const EVIDENCE_REACH_LABEL: Record<EvidenceReach, string> = {
  international: 'International level',
  national: 'National level',
  provincial: 'Provincial level',
  district: 'District level',
  school: 'School level',
  unknown: 'Unstated level',
};

/** Bilingual (English/Vietnamese) because `level` is free text typed by a Vietnamese student. */
export function parseReach(level: string | null): EvidenceReach {
  if (!level) return 'unknown';
  const text = level
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd');

  if (/(international|quoc te|toan cau|global|world)/.test(text)) return 'international';
  if (/(national|quoc gia|toan quoc)/.test(text)) return 'national';
  if (/(provinc|tinh|thanh pho|city|regional|khu vuc)/.test(text)) return 'provincial';
  if (/(district|quan|huyen)/.test(text)) return 'district';
  if (/(school|truong|lop|class)/.test(text)) return 'school';
  return 'unknown';
}

/** B. Verification status. A document always wins; a named external body without a document is checkable-in-principle; otherwise it is the student's word alone. */
export function tierFor(input: EvidenceItemInput): EvidenceTier {
  if (input.hasDocument || input.sourceKind === 'uploaded_document' || input.sourceKind === 'test_record') {
    return 'verified';
  }
  if (input.attributingOrganisation?.trim() || input.sourceKind === 'external_attribution') {
    return 'attributable';
  }
  return 'stated';
}

function rank(tier: EvidenceTier, reach: EvidenceReach): number {
  return TIER_ORDER[tier] * 100 + REACH_ORDER[reach];
}

/** A. Quality metric 1 — 0-100 or null. Rewards a real number/scale over none. */
function scoreTangibleImpact(input: EvidenceItemInput): number | null {
  if (!input.quantifiedOutcome) return null;
  const text = input.quantifiedOutcome.trim();
  if (text.length === 0) return null;
  const hasNumber = /\d/.test(text);
  return hasNumber ? 85 : 50;
}

/** A. Quality metric 2 — 0-100 or null. Credits a described change even with no number behind it. */
function scoreIntangibleImpact(input: EvidenceItemInput): number | null {
  if (!input.qualitativeOutcome) return null;
  const text = input.qualitativeOutcome.trim();
  if (text.length === 0) return null;
  return text.length >= 40 ? 75 : 45;
}

/** A. Quality metric 3 — 0-100. Traceability is always assessable (it derives from tier), unlike the other two. */
function scoreTraceability(tier: EvidenceTier): number {
  if (tier === 'verified') return 100;
  if (tier === 'attributable') return 60;
  return 20;
}

export function scoreEvidenceItem(input: EvidenceItemInput): EvidenceItem {
  const tier = tierFor(input);
  const reach = parseReach(input.level);

  const metrics: Record<EvidenceMetricKey, number | null> = {
    tangibleImpact: scoreTangibleImpact(input),
    intangibleImpact: scoreIntangibleImpact(input),
    traceability: scoreTraceability(tier),
  };

  const weighted = weightedScore(
    (Object.keys(EVIDENCE_METRIC_WEIGHTS) as EvidenceMetricKey[]).map((key) => ({
      key,
      weight: EVIDENCE_METRIC_WEIGHTS[key],
      value: metrics[key],
    })),
  );

  const limitations: string[] = [];
  if (metrics.tangibleImpact === null && metrics.intangibleImpact === null) {
    limitations.push('No outcome described — neither a number nor a change was stated.');
  }
  if (tier === 'stated') {
    limitations.push('Resting on the applicant\'s word alone; a document or named organisation would move this up a tier.');
  }

  return {
    id: `f3:${input.id}`,
    frameworkId: 'F3',
    itemId: input.id,
    title: input.title,
    status: weighted.score === null ? 'unassessed' : 'assessed',
    score: weighted.score,
    confidence: tier === 'verified' ? 'high' : tier === 'attributable' ? 'medium' : 'low',
    kind: tier === 'verified' ? 'observation' : tier === 'attributable' ? 'observation' : 'inference',
    evidenceRefs: [{ id: input.id, kind: input.sourceKind, label: input.title }],
    limitations,
    missingInputs: weighted.missingKeys.map((key) => `outcome.${key}`),
    metrics,
    tier,
    reach,
    // Used only for ordering within the profile — not part of the canonical
    // scoring formula, kept alongside rank() for the strongest-first sort.
  };
}

export function buildEvidenceProfile(inputs: readonly EvidenceItemInput[]): EvidenceProfile {
  const items = inputs
    .map(scoreEvidenceItem)
    .sort(
      (a, b) =>
        rank(b.tier, b.reach) - rank(a.tier, a.reach) || a.title.localeCompare(b.title),
    );

  const counts: Record<EvidenceTier, number> = { verified: 0, attributable: 0, stated: 0 };
  for (const item of items) counts[item.tier] += 1;

  return {
    items,
    assessed: items.filter((item) => item.score !== null),
    unassessed: items.filter((item) => item.score === null),
    counts,
    strongest: items.filter((item) => item.tier !== 'stated').slice(0, 5),
    needsProof: items.filter((item) => item.tier === 'stated'),
    confidence: confidenceFromCoverage(counts.verified + counts.attributable, items.length),
  };
}
