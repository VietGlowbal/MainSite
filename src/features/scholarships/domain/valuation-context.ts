import type { DurationValue } from './duration';
import type { TuitionSource } from './valuation';

/** Bump when candidate valuation context meaning or selection changes. */
export const SCHOLARSHIP_VALUATION_CONTEXT_VERSION = 'scholarship-valuation-context-v2';

export type ScholarshipValuationProvenance = {
  sourceType: 'scholarship-catalogue' | 'programme' | 'university' | 'application';
  recordId: string | null;
  sourceUrl: string | null;
  retrievedAt: string | null;
};

export type ScholarshipValuationProgrammeContext = {
  id: string;
  name: string | null;
  universityId: number | null;
  duration: DurationValue | null;
  tuitionSource: TuitionSource | null;
  provenance: ScholarshipValuationProvenance;
};

export type ScholarshipValuationUniversityContext = {
  id: number;
  name: string | null;
  city: string | null;
  country: string | null;
  provenance: ScholarshipValuationProvenance;
};

/** Public, candidate-owned context. It contains no student identity. */
export type ScholarshipValuationContext = {
  scholarshipId: number;
  programme: ScholarshipValuationProgrammeContext | null;
  university: ScholarshipValuationUniversityContext | null;
  city: string | null;
  country: string | null;
  programmeKey: string | null;
  universityKey: string | null;
  cityKey: string | null;
  countryKey: string | null;
  duration: DurationValue | null;
  tuitionReferenceKey: string | null;
  provenance: readonly ScholarshipValuationProvenance[];
};

export type ScholarshipValuationUniversityInput = {
  id: number;
  name?: string | null;
  city?: string | null;
  country?: string | null;
  sourceUrl?: string | null;
  retrievedAt?: string | null;
};

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

function candidateContext(
  scholarshipId: number,
  scholarshipCountry: string | null,
  university: ScholarshipValuationUniversityInput | null,
): ScholarshipValuationContext {
  const country = clean(university?.country) ?? clean(scholarshipCountry);
  const city = clean(university?.city);
  const universityContext = university
    ? {
        id: university.id,
        name: clean(university.name),
        city,
        country,
        provenance: {
          sourceType: 'university' as const,
          recordId: String(university.id),
          sourceUrl: clean(university.sourceUrl),
          retrievedAt: clean(university.retrievedAt),
        },
      }
    : null;
  const provenance: ScholarshipValuationProvenance[] = [
    {
      sourceType: 'scholarship-catalogue',
      recordId: String(scholarshipId),
      sourceUrl: null,
      retrievedAt: null,
    },
    ...(universityContext ? [universityContext.provenance] : []),
  ];

  return {
    scholarshipId,
    programme: null,
    university: universityContext,
    city,
    country,
    programmeKey: null,
    universityKey: universityContext ? String(universityContext.id) : null,
    cityKey: city,
    countryKey: country,
    duration: null,
    tuitionReferenceKey: null,
    provenance,
  };
}

/**
 * Build deterministic alternatives from the scholarship's own relations.
 * Linked universities are alternatives, never additive cost components.
 */
export function buildScholarshipValuationContexts(args: {
  scholarshipId: number;
  scholarshipCountry: string | null;
  universities: readonly ScholarshipValuationUniversityInput[];
}): readonly ScholarshipValuationContext[] {
  const unique = [...new Map(
    args.universities
      .filter((university) => Number.isFinite(university.id))
      .map((university) => [university.id, university] as const),
  ).values()].sort((left, right) => left.id - right.id);

  if (unique.length === 0) {
    return [candidateContext(args.scholarshipId, args.scholarshipCountry, null)];
  }
  return unique.map((university) => candidateContext(
    args.scholarshipId,
    args.scholarshipCountry,
    university,
  ));
}

function sameCandidateEntity(
  candidate: ScholarshipValuationContext,
  refinement: {
    programme: ScholarshipValuationProgrammeContext | null;
    university: ScholarshipValuationUniversityContext | null;
  },
): boolean {
  const selectedProgrammeUniversity = refinement.programme?.universityId ?? null;
  const selectedUniversityId = refinement.university?.id ?? selectedProgrammeUniversity;
  if (selectedUniversityId != null && candidate.university?.id === selectedUniversityId) return true;
  return refinement.programme?.id != null && candidate.programme?.id === refinement.programme.id;
}

/**
 * Apply a user's selected context only after the candidate's own relation
 * proves that the selection applies to this scholarship.
 */
export function refineScholarshipValuationContext(
  candidate: ScholarshipValuationContext,
  refinement: {
    programme: ScholarshipValuationProgrammeContext | null;
    university: ScholarshipValuationUniversityContext | null;
  },
): ScholarshipValuationContext {
  if (!sameCandidateEntity(candidate, refinement)) return candidate;
  const programme = refinement.programme ?? candidate.programme;
  const university = refinement.university ?? candidate.university;
  const city = clean(university?.city) ?? candidate.city;
  const country = clean(university?.country) ?? candidate.country;
  return {
    ...candidate,
    programme,
    university,
    city,
    country,
    programmeKey: programme?.id ?? candidate.programmeKey,
    universityKey: university ? String(university.id) : candidate.universityKey,
    cityKey: city,
    countryKey: country,
    duration: programme?.duration ?? candidate.duration,
    tuitionReferenceKey: programme?.id ?? candidate.tuitionReferenceKey,
    provenance: [
      ...candidate.provenance,
      ...(programme ? [programme.provenance] : []),
      ...(university ? [university.provenance] : []),
    ].filter((entry, index, entries) => entries.findIndex((candidateEntry) =>
      candidateEntry.sourceType === entry.sourceType && candidateEntry.recordId === entry.recordId,
    ) === index),
  };
}

export function selectScholarshipValuationContext(
  contexts: readonly ScholarshipValuationContext[],
  refinement?: {
    programme: ScholarshipValuationProgrammeContext | null;
    university: ScholarshipValuationUniversityContext | null;
  } | null,
): ScholarshipValuationContext | null {
  const ordered = [...contexts].sort((left, right) =>
    (left.university?.id ?? Number.MAX_SAFE_INTEGER) - (right.university?.id ?? Number.MAX_SAFE_INTEGER) ||
    (left.programme?.id ?? '').localeCompare(right.programme?.id ?? ''),
  );
  if (refinement) {
    const applicable = ordered.find((candidate) => sameCandidateEntity(candidate, refinement));
    if (applicable) return refineScholarshipValuationContext(applicable, refinement);
  }
  return ordered[0] ?? null;
}
