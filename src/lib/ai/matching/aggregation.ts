import type { AcademicProfile } from '@/lib/ai/applicant-state/domain';
import {
  assessAcademicRequirements,
  type AcademicRequirementSpec,
} from '@/lib/ai/academic-analysis';
import type { EvidenceBank } from '@/shared/evidence/domain';
import type {
  FitSignal,
  HardRequirementMatch,
  MatchingCriterion,
  MatchingGap,
  MatchingStrength,
  PositioningOpportunity,
} from './domain';
import { normalizeCriterionText } from './criteria';

/**
 * Task 4 — Hard requirements and deterministic aggregation.
 *
 * Purely deterministic: no LLM is consulted here. Numeric academic gates are
 * delegated to the existing Academic Analyzer (`assessAcademicRequirements`),
 * and required-document gates are answered against the Evidence Bank. The
 * aggregation helpers turn (criteria, FitSignals, HardRequirementMatch[]) into
 * the strengths / gaps / positioning / coverage the report composer consumes.
 *
 * The output NEVER describes an admission probability; `evidenceCoverage` is a
 * weighted measure of current alignment evidence, not a chance of admission.
 */

export const ALIGNMENT_VALUE: Record<FitSignal['alignment'], number> = {
  strong: 1,
  moderate: 0.65,
  weak: 0.25,
  missing: 0,
};

/** Deficit used to rank gaps: how far a non-strong alignment falls short. */
const ALIGNMENT_DEFICIT: Record<FitSignal['alignment'], number> = {
  missing: 1,
  weak: 0.75,
  moderate: 0.5,
  strong: 0,
};

const IMPORTANCE_WEIGHT: Record<MatchingCriterion['importance'], number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const DOCUMENT_KEYWORDS =
  /portfolio|writing sample|transcript|reference letter|recommendation|essay|statement|cv\b|document/i;

type MetricFamily = AcademicRequirementSpec['metric'];

function compareLexical(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function criterionText(criterion: MatchingCriterion): string {
  return [
    criterion.label,
    criterion.description,
    criterion.sourceText ?? '',
    criterion.metadata.missingInformation ?? '',
  ].join(' ');
}

function detectMetric(text: string): { metric: MetricFamily; scale?: number } | null {
  if (/\bielts\b/i.test(text)) return { metric: 'ielts' };
  if (/\btoefl\b/i.test(text)) return { metric: 'toefl' };
  if (/\bsat\b/i.test(text)) return { metric: 'sat' };
  if (/\bact\b/i.test(text)) return { metric: 'act' };
  if (/\bgpa\b/i.test(text)) return { metric: 'gpa', scale: 4.0 };
  if (/\bib\s*(?:points)?\b|\bdiploma programme\b/i.test(text)) return { metric: 'ib_points', scale: 45 };
  if (/(?:percentage|percent|%)/i.test(text)) return { metric: 'percentage', scale: 100 };
  return null;
}

function extractThreshold(
  text: string,
  metric: MetricFamily,
): { value: number; kind: 'min' | 'max' } | null {
  const max = text.match(/(?:maximum|max\.|at most|no more than|<=|≤)\s*[:.]?\s*(\d+(?:\.\d+)?)/i);
  if (max) return { value: Number(max[1]), kind: 'max' };

  const min = text.match(/(?:minimum|min\.?|at least|threshold|>=|≥|>)\s*[:.]?\s*(\d+(?:\.\d+)?)/i);
  if (min) return { value: Number(min[1]), kind: 'min' };

  if (metric === 'percentage') {
    const pct = text.match(/(\d+(?:\.\d+)?)\s*%/i);
    if (pct) return { value: Number(pct[1]), kind: 'min' };
  }

  const metricWord = metric === 'ib_points' ? 'ib' : metric;
  const adjacent = text.match(new RegExp(`\\b${metricWord}\\b[^\\d]{0,15}(\\d+(?:\\.\\d+)?)`, 'i'));
  if (adjacent) return { value: Number(adjacent[1]), kind: 'min' };
  return null;
}

/** Parse a hard criterion into an AcademicRequirementSpec, or null when it is not a comparable numeric gate. */
function toAcademicRequirementSpec(criterion: MatchingCriterion): AcademicRequirementSpec | null {
  const text = criterionText(criterion);
  const metric = detectMetric(text);
  if (!metric) return null;
  const threshold = extractThreshold(text, metric.metric);
  if (!threshold) return null;
  return {
    id: criterion.id,
    label: criterion.label,
    metric: metric.metric,
    minValue: threshold.kind === 'min' ? threshold.value : null,
    maxValue: threshold.kind === 'max' ? threshold.value : null,
    scale: metric.scale ?? null,
    sourceRefs: [...criterion.sourceRefs],
  };
}

function isDocumentRequirement(criterion: MatchingCriterion): boolean {
  const text = criterionText(criterion);
  // Strong numeric signal wins: "SAT 1200" is a numeric gate, not a document.
  if (detectMetric(text)) return false;
  if (criterion.category === 'selection_criterion') return true;
  return DOCUMENT_KEYWORDS.test(text);
}

function tokenSet(value: string): Set<string> {
  return new Set(normalizeCriterionText(value).split(' ').filter(Boolean));
}

function documentEvidenceForCriterion(
  criterion: MatchingCriterion,
  evidenceBank: EvidenceBank,
): string[] {
  const documentSourceIds = new Set(
    Object.values(evidenceBank.sources)
      .filter((source) => source.type === 'document')
      .map((source) => source.id),
  );
  const criterionTokens = tokenSet(criterionText(criterion));
  const matching = evidenceBank.claims.filter((claim) => {
    if (claim.status !== 'verified') return false;
    if (!claim.sourceRefs.some((id) => documentSourceIds.has(id))) return false;
    if (claim.tags.criteria.includes(criterion.id)) return true;
    const claimTokens = tokenSet([claim.statement, ...claim.tags.competencies].join(' '));
    for (const token of claimTokens) {
      if (criterionTokens.has(token)) return true;
    }
    return false;
  });
  return matching.map((claim) => claim.id).sort(compareLexical);
}

function evidenceForRecord(evidenceBank: EvidenceBank, recordId: string | null): string[] {
  if (!recordId) return [];
  const ids = new Set(
    evidenceBank.claims
      .filter((claim) => claim.sourceRefs.includes(recordId) || claim.id === recordId)
      .map((claim) => claim.id),
  );
  return [...ids].sort(compareLexical);
}

function insufficientMatch(criterion: MatchingCriterion, explanation: string): HardRequirementMatch {
  return {
    criterionId: criterion.id,
    status: 'insufficient_information',
    applicantValue: null,
    requiredValue: null,
    evidenceIds: [],
    explanation,
  };
}

function evaluateDocumentRequirement(
  criterion: MatchingCriterion,
  evidenceBank: EvidenceBank,
): HardRequirementMatch {
  const evidenceIds = documentEvidenceForCriterion(criterion, evidenceBank);
  if (evidenceIds.length > 0) {
    return {
      criterionId: criterion.id,
      status: 'meets',
      applicantValue: null,
      requiredValue: null,
      evidenceIds,
      explanation: `A verified document source supports the "${criterion.label}" requirement.`,
    };
  }
  return insufficientMatch(
    criterion,
    `No verified document source confirms the "${criterion.label}" requirement; this is not treated as a definitive failure.`,
  );
}

/**
 * Evaluate every hard, non-scholarship criterion deterministically.
 *
 * - Numeric academic gates are converted to `AcademicRequirementSpec[]` and
 *   handed to the Academic Analyzer; the verdict is mapped verbatim.
 * - Required-document gates are answered against the Evidence Bank. A missing
 *   document is `insufficient_information`, never `does_not_meet`.
 */
export function evaluateHardRequirements(args: {
  criteria: MatchingCriterion[];
  academicProfile: AcademicProfile | null;
  evidenceBank: EvidenceBank;
}): HardRequirementMatch[] {
  const { criteria, academicProfile, evidenceBank } = args;
  const records = academicProfile?.records ?? [];
  const hardCriteria = criteria.filter(
    (criterion) => criterion.requirementType === 'hard' && criterion.category !== 'scholarship',
  );

  return hardCriteria.map((criterion) => {
    if (isDocumentRequirement(criterion)) {
      return evaluateDocumentRequirement(criterion, evidenceBank);
    }
    const spec = toAcademicRequirementSpec(criterion);
    if (!spec) {
      return insufficientMatch(
        criterion,
        `The requirement "${criterion.label}" does not state a comparable numeric threshold, so it cannot be confirmed.`,
      );
    }
    const [assessment] = assessAcademicRequirements({ records, requirements: [spec] });
    const matchedRecordId = assessment?.matchedRecordId ?? null;
    const evidenceIds = evidenceForRecord(evidenceBank, matchedRecordId);
    const record = records.find((item) => item.id === matchedRecordId);
    return {
      criterionId: criterion.id,
      status: assessment?.verdict ?? 'insufficient_information',
      applicantValue: record ? (record.value ?? record.raw) : null,
      requiredValue: spec.minValue ?? spec.maxValue ?? null,
      evidenceIds,
      explanation:
        assessment?.rationale ??
        `No academic record could be compared against the "${criterion.label}" requirement.`,
    };
  });
}

export function calculateEvidenceCoverage(
  criteria: MatchingCriterion[],
  signals: FitSignal[],
): number {
  const applicableCriteria = criteria.filter((c) => c.category !== 'scholarship');
  if (applicableCriteria.length === 0) return 0;

  let totalWeight = 0;
  let weightedScore = 0;

  const signalMap = new Map(signals.map((s) => [s.criterionId, s]));

  for (const criterion of applicableCriteria) {
    const weight = IMPORTANCE_WEIGHT[criterion.importance];
    totalWeight += weight;

    const signal = signalMap.get(criterion.id);
    const alignment = signal?.alignment ?? 'missing';
    weightedScore += ALIGNMENT_VALUE[alignment] * weight;
  }

  if (totalWeight === 0) return 0;
  return Math.round((weightedScore / totalWeight) * 100);
}

function getAllEvidenceIds(signal: FitSignal): string[] {
  return [
    ...new Set([
      ...signal.directEvidenceIds,
      ...signal.supportingEvidenceIds,
      ...signal.applicantEvidenceIds,
    ]),
  ].sort();
}

export function deriveStrengths(
  criteria: MatchingCriterion[],
  signals: FitSignal[],
): MatchingStrength[] {
  const strengths: MatchingStrength[] = [];
  const criterionMap = new Map(criteria.map((c) => [c.id, c]));

  for (const signal of signals) {
    if (signal.alignment !== 'strong') continue;
    if (signal.evidenceQuality === 'weak' || signal.evidenceQuality === 'none') continue;
    
    const allEvIds = getAllEvidenceIds(signal);
    if (allEvIds.length === 0) continue;

    const criterion = criterionMap.get(signal.criterionId);
    if (!criterion || criterion.importance === 'low') continue;

    const level =
      criterion.importance === 'critical' || criterion.importance === 'high' ? 'high' : 'medium';

    strengths.push({
      id: `strength-${criterion.id}`,
      title: criterion.label,
      description: signal.reasoning || criterion.description,
      criterionIds: [criterion.id],
      evidenceIds: allEvIds,
      strength: level,
      whyItMatters: criterion.description || signal.reasoning,
      positioningUse: signal.opportunity,
    });
  }

  strengths.sort((a, b) => {
    const critA = criterionMap.get(a.criterionIds[0])!;
    const critB = criterionMap.get(b.criterionIds[0])!;
    const weightA = IMPORTANCE_WEIGHT[critA.importance];
    const weightB = IMPORTANCE_WEIGHT[critB.importance];
    if (weightA !== weightB) return weightB - weightA;
    return a.id.localeCompare(b.id);
  });

  return strengths;
}

export function deriveGaps(
  criteria: MatchingCriterion[],
  hardRequirements: HardRequirementMatch[],
  signals: FitSignal[],
): MatchingGap[] {
  const gaps: MatchingGap[] = [];
  const criterionMap = new Map(criteria.map((c) => [c.id, c]));

  for (const hr of hardRequirements) {
    if (hr.status === 'does_not_meet') {
      const criterion = criterionMap.get(hr.criterionId);
      if (!criterion) continue;
      const weight = IMPORTANCE_WEIGHT[criterion.importance] || 1;
      const priority = Math.round(weight * ALIGNMENT_DEFICIT['missing'] * 2 * 1.2);

      gaps.push({
        id: `gap-hard-${criterion.id}`,
        type: 'hard_requirement',
        title: criterion.label,
        description: hr.explanation,
        criterionIds: [criterion.id],
        currentEvidenceIds: hr.evidenceIds,
        severity: 'critical',
        fixability: 'low',
        evidenceNeeded: [],
        whyItMatters: criterion.description || hr.explanation,
        priority,
      });
    }
  }

  for (const signal of signals) {
    const criterion = criterionMap.get(signal.criterionId);
    if (!criterion) continue;

    const allEvIds = getAllEvidenceIds(signal);
    const hasEvidence = allEvIds.length > 0;
    const importance = criterion.importance;
    const isHighImportance = importance === 'critical' || importance === 'high';
    const isPoorQuality = signal.evidenceQuality === 'weak' || signal.evidenceQuality === 'none';

    let type: MatchingGap['type'] | null = null;
    let severity: MatchingGap['severity'] = 'medium';
    let fixability: MatchingGap['fixability'] = 'medium';

    if (signal.alignment === 'missing' && isHighImportance) {
      type = 'missing_evidence';
      severity = 'high';
      fixability = 'high';
    } else if (
      (signal.alignment === 'weak' || signal.alignment === 'moderate') &&
      hasEvidence &&
      isPoorQuality
    ) {
      type = 'weak_evidence';
      severity = 'medium';
      fixability = 'high';
    } else if (signal.alignment === 'weak' && signal.directEvidenceIds.length > 0) {
      type = 'capability_gap';
      severity = 'medium';
      fixability = 'medium';
    } else if (signal.alignment === 'moderate' && hasEvidence && !isPoorQuality) {
      type = 'positioning_gap';
      severity = 'medium';
      fixability = 'high';
    }

    if (type) {
      const weight = IMPORTANCE_WEIGHT[importance];
      const deficit = ALIGNMENT_DEFICIT[signal.alignment];
      const hardMultiplier = criterion.requirementType === 'hard' ? 2 : 1;
      const fixMultiplier =
        fixability === 'high' ? 0.8 : fixability === 'medium' ? 1.0 : 1.2;
      const priority = Math.round(weight * deficit * hardMultiplier * fixMultiplier);

      gaps.push({
        id: `gap-${criterion.id}`,
        type,
        title: criterion.label,
        description: signal.reasoning,
        criterionIds: [criterion.id],
        currentEvidenceIds: allEvIds,
        severity,
        fixability,
        evidenceNeeded: signal.missingEvidence,
        whyItMatters: criterion.description || signal.reasoning,
        priority,
      });
    }
  }

  gaps.sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority;
    return a.id.localeCompare(b.id);
  });

  return gaps;
}

export function derivePositioningOpportunities(
  criteria: MatchingCriterion[],
  signals: FitSignal[],
): PositioningOpportunity[] {
  const opportunities: PositioningOpportunity[] = [];
  const criterionMap = new Map(criteria.map((c) => [c.id, c]));

  for (const signal of signals) {
    if (!signal.opportunity) continue;
    if (signal.alignment === 'missing') continue;

    const allEvIds = getAllEvidenceIds(signal);
    if (allEvIds.length === 0) continue;

    const criterion = criterionMap.get(signal.criterionId);
    if (!criterion) continue;

    opportunities.push({
      id: `positioning-${criterion.id}`,
      title: criterion.label,
      criterionIds: [criterion.id],
      evidenceIds: allEvIds,
      currentInterpretation: signal.reasoning,
      recommendedPositioning: signal.opportunity,
      rationale: signal.reasoning,
      confidence: signal.confidence,
    });
  }

  opportunities.sort((a, b) => {
    if (a.confidence !== b.confidence) return b.confidence - a.confidence;
    return a.id.localeCompare(b.id);
  });

  return opportunities;
}

export function buildDependencyIndex(
  signals: FitSignal[],
): Record<string, string[]> {
  const index: Record<string, Set<string>> = {};

  for (const signal of signals) {
    const allEvIds = getAllEvidenceIds(signal);
    for (const evId of allEvIds) {
      if (!index[evId]) index[evId] = new Set();
      index[evId].add(signal.criterionId);
    }
  }

  const result: Record<string, string[]> = {};
  for (const [evId, criteriaSet] of Object.entries(index)) {
    result[evId] = Array.from(criteriaSet).sort((a, b) => a.localeCompare(b));
  }

  return result;
}
