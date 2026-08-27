import type { ClaimCategory, EvidenceBank, EvidenceClaim } from '@/shared/evidence/domain';
import { lookupByCompetency, lookupByCriterion } from '@/shared/evidence/retrieval';
import type {
  CriterionMatchResult,
  MatchingCriterion,
  MatchingEvidence,
} from './domain';
import { normalizeCriterionText } from './criteria';

const DEFAULT_TOP_K = 6;
const MAX_TOP_K = 10;

const RANK_BONUS = {
  exactCriterionTag: 40,
  exactCompetencyTag: 30,
  categoryCompatible: 20,
  verified: 10,
  unverified: 2,
  conflicting: -15,
  reportOnly: -25,
} as const;

const CATEGORY_COMPATIBILITY: Record<MatchingCriterion['category'], readonly ClaimCategory[]> = {
  academic_requirement: ['academic'],
  academic_preparation: ['academic'],
  competency: ['competency', 'experience'],
  selection_criterion: ['academic', 'competency', 'experience', 'identity', 'direction'],
  programme_value: ['competency', 'direction', 'experience'],
  motivation: ['direction', 'experience'],
  experience: ['competency', 'experience'],
  scholarship: ['academic', 'competency', 'experience', 'identity', 'direction'],
};

function normalizedTag(value: string): string {
  return value.trim().toLowerCase();
}

function tokenSet(value: string): Set<string> {
  return new Set(normalizeCriterionText(value).split(' ').filter(Boolean));
}

function evidenceTokens(claim: MatchingEvidence): Set<string> {
  return tokenSet(
    [claim.statement, ...claim.competencies, ...claim.criteria].join(' '),
  );
}

function isDirectClaim(claim: EvidenceClaim): boolean {
  return (
    claim.status === 'verified' &&
    claim.sourceRefs.length > 0 &&
    claim.interpretationRefs.length === 0
  );
}

/** Adapt canonical Evidence Bank claims without introducing a second applicant model. */
export function toMatchingEvidence(bank: EvidenceBank): MatchingEvidence[] {
  return bank.claims.map((claim) => ({
    id: claim.id,
    category: claim.category,
    statement: claim.statement,
    sourceRefs: [...claim.sourceRefs],
    interpretationRefs: [...claim.interpretationRefs],
    status: claim.status,
    competencies: [...claim.tags.competencies],
    criteria: [...claim.tags.criteria],
    direct: isDirectClaim(claim),
    rankScore: 0,
  }));
}

function compatibleClaims(criterion: MatchingCriterion, claims: MatchingEvidence[]): MatchingEvidence[] {
  const categories = CATEGORY_COMPATIBILITY[criterion.category];
  return claims.filter((claim) => categories.includes(claim.category as ClaimCategory));
}

function criterionTagCandidates(criterion: MatchingCriterion): string[] {
  const sourceIdentity = criterion.metadata.targetRequirementId ?? criterion.id.split(':').at(-1) ?? criterion.id;
  return Array.from(
    new Set([
      criterion.id,
      `criterion:${criterion.id}`,
      sourceIdentity,
      `criterion:${sourceIdentity}`,
    ]),
  );
}

function clampTopK(value: number | undefined): number {
  if (value === undefined || Number.isNaN(value)) return DEFAULT_TOP_K;
  if (!Number.isFinite(value)) return value > 0 ? MAX_TOP_K : 1;
  return Math.min(MAX_TOP_K, Math.max(1, Math.trunc(value)));
}

function tokenOverlap(criterion: MatchingCriterion, claim: MatchingEvidence): number {
  const criterionTokens = tokenSet(
    [criterion.label, criterion.description, ...criterion.expectedSignals].join(' '),
  );
  if (criterionTokens.size === 0) return 0;
  const overlap = Array.from(criterionTokens).filter((token) => evidenceTokens(claim).has(token)).length;
  return overlap / Math.max(1, criterionTokens.size);
}

function statusScore(status: MatchingEvidence['status']): number {
  switch (status) {
    case 'verified':
      return RANK_BONUS.verified;
    case 'unverified':
      return RANK_BONUS.unverified;
    case 'conflicting':
      return RANK_BONUS.conflicting;
    case 'report_only':
      return RANK_BONUS.reportOnly;
  }
}

/** Retrieve a small, deterministic evidence set for one criterion. */
export function retrieveEvidenceForCriterion(args: {
  criterion: MatchingCriterion;
  evidenceBank: EvidenceBank;
  topK?: number;
}): MatchingEvidence[] {
  const { criterion, evidenceBank } = args;
  const adapted = toMatchingEvidence(evidenceBank);
  const criterionTagIds = new Set<string>();
  for (const tag of criterionTagCandidates(criterion)) {
    for (const claim of lookupByCriterion(evidenceBank, tag)) criterionTagIds.add(claim.id);
  }

  const competencyTagIds = new Set<string>();
  const expectedSignals = criterion.expectedSignals.filter(Boolean);
  for (const signal of expectedSignals) {
    for (const claim of lookupByCompetency(evidenceBank, signal)) competencyTagIds.add(claim.id);
  }

  const exactCriterionTags = new Set(criterionTagCandidates(criterion).map(normalizedTag));
  const exactCompetencyTags = new Set(expectedSignals.map(normalizedTag));
  const tagMatchedIds = new Set([...criterionTagIds, ...competencyTagIds]);
  const candidates = compatibleClaims(criterion, adapted).filter(
    (claim) => tagMatchedIds.has(claim.id) || tokenOverlap(criterion, claim) > 0,
  );
  const ranked = candidates.map((claim) => {
    const exactCriterion =
      criterionTagIds.has(claim.id) || claim.criteria.some((tag) => exactCriterionTags.has(normalizedTag(tag)));
    const exactCompetency =
      competencyTagIds.has(claim.id) &&
      claim.competencies.some((tag) => exactCompetencyTags.has(normalizedTag(tag)));
    const rankScore =
      (exactCriterion ? RANK_BONUS.exactCriterionTag : 0) +
      (exactCompetency ? RANK_BONUS.exactCompetencyTag : 0) +
      RANK_BONUS.categoryCompatible +
      tokenOverlap(criterion, claim) * 15 +
      statusScore(claim.status);
    return { ...claim, rankScore };
  });

  return ranked
    .sort((left, right) => right.rankScore - left.rankScore || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0))
    .slice(0, clampTopK(args.topK));
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
}

/** Constrain model-selected evidence references to the retrieved prompt batch. */
export function validateEvidenceReferences(
  result: CriterionMatchResult,
  suppliedEvidence: MatchingEvidence[],
): CriterionMatchResult {
  const suppliedById = new Map(suppliedEvidence.map((evidence) => [evidence.id, evidence]));
  const referencedIds = [
    ...result.evidenceIds,
    ...result.directEvidenceIds,
    ...result.supportingEvidenceIds,
  ];
  for (const id of referencedIds) {
    if (!suppliedById.has(id)) throw new Error(`Unknown evidence ID: ${id}`);
  }

  const evidenceIds = dedupe(result.evidenceIds);
  const evidenceIdSet = new Set(evidenceIds);
  const directEvidenceIds = dedupe(result.directEvidenceIds).filter(
    (id) => evidenceIdSet.has(id) && suppliedById.get(id)?.direct === true,
  );
  const supportingEvidenceIds = dedupe(result.supportingEvidenceIds).filter((id) => evidenceIdSet.has(id));

  let alignment = result.alignment;
  if (alignment === 'missing') {
    return {
      ...result,
      evidenceIds,
      directEvidenceIds: [],
      supportingEvidenceIds: [],
    };
  }
  if (alignment === 'strong' && directEvidenceIds.length === 0) alignment = 'moderate';
  if (alignment === 'moderate' && evidenceIds.length === 0) alignment = 'weak';

  return {
    ...result,
    evidenceIds,
    directEvidenceIds,
    supportingEvidenceIds,
    alignment,
  };
}
