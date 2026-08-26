import type { EvidenceBank, EvidenceClaim } from './domain';

/**
 * Deterministic retrieval over the Evidence Bank (Task 7). No vector search —
 * lookups run on the claim's canonical tags and provenance lists.
 */

export function lookupBySource(bank: EvidenceBank, sourceId: string): EvidenceClaim[] {
  return bank.claims.filter((claim) => claim.sourceRefs.includes(sourceId));
}

export function lookupByCompetency(bank: EvidenceBank, competency: string): EvidenceClaim[] {
  const needle = competency.toLowerCase();
  return bank.claims.filter((claim) =>
    claim.tags.competencies.some((tag) => tag.toLowerCase().includes(needle)),
  );
}

export function lookupByCriterion(bank: EvidenceBank, criterionTag: string): EvidenceClaim[] {
  const needle = criterionTag.toLowerCase();
  return bank.claims.filter((claim) =>
    claim.tags.criteria.some((tag) => tag.toLowerCase() === needle),
  );
}

/** Claims usable as verified support for a given criterion (never AI-only). */
export function verifiedSupportForCriterion(
  bank: EvidenceBank,
  criterionTag: string,
): EvidenceClaim[] {
  return lookupByCriterion(bank, criterionTag).filter(
    (claim) => claim.status === 'verified' && claim.interpretationRefs.length === 0,
  );
}
