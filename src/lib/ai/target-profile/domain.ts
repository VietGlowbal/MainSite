import { createHash } from 'crypto';
import { z } from 'zod';

/**
 * Target Profile — the reusable, PROGRAMME-level picture of what a programme
 * and its university look for (Task 4). Built ONLY from already-ingested
 * catalogue data (`courses`, `universities`, `course_admission_requirements`,
 * `course_field_values`, `crawl_sources`); never crawled on demand.
 *
 * EVERY requirement carries source references back to the ingested rows it
 * came from, OR an explicit `missingInformation` note saying the ingested
 * sources do not state it. An unsourced, unexplained requirement cannot be
 * produced — the schema refuses it.
 *
 * Deliberately ABSENT: anything applicant-specific, and above all any
 * admission probability / reach-match-safety notion — those belong to
 * Matching, never to a reusable profile artifact.
 */

export const TARGET_PROFILE_SCHEMA_VERSION = 'tp-v2';

const targetFactSchema = z
  .object({
    value: z.string().min(1).max(2_000),
    sourceRefs: z.array(z.string().min(1)).max(20),
  })
  .strict();

const targetFactListSchema = z.array(targetFactSchema).max(30);

const targetLearningEnvironmentSchema = z
  .object({
    teachingModel: targetFactSchema.nullable(),
    experientialLearning: targetFactListSchema,
    classStructure: targetFactSchema.nullable(),
    interdisciplinary: targetFactSchema.nullable(),
    research: targetFactSchema.nullable(),
    entrepreneurship: targetFactSchema.nullable(),
    mentorship: targetFactSchema.nullable(),
    communityProgrammes: targetFactListSchema,
  })
  .strict();

const universityProfileSchema = z
  .object({
    mission: targetFactSchema.nullable(),
    values: targetFactListSchema,
    educationalPhilosophy: targetFactSchema.nullable(),
    studentProfile: targetFactSchema.nullable(),
    learningEnvironment: targetLearningEnvironmentSchema,
    distinctiveOpportunities: targetFactListSchema,
  })
  .strict();

const programmeProfileSchema = z
  .object({
    description: targetFactSchema.nullable(),
    curriculum: targetFactListSchema,
    outcomes: targetFactListSchema,
    preferredCompetencies: targetFactListSchema,
    teachingStyle: targetFactSchema.nullable(),
    careerPathways: targetFactListSchema,
    opportunities: targetFactListSchema,
  })
  .strict();

export type TargetRequirementCategory =
  | 'academic'
  | 'competency'
  | 'selection'
  | 'scholarship'
  | 'application';

export const targetRequirementSchema = z
  .object({
    id: z.string().min(1),
    category: z.enum(['academic', 'competency', 'selection', 'scholarship', 'application']),
    label: z.string().min(1).max(300),
    detail: z.string().max(2000).nullable(),
    status: z.enum(['required', 'optional', 'conditional', 'not_required', 'unknown']).nullable(),
    sourceRefs: z.array(z.string().min(1)).max(20),
    missingInformation: z.string().max(500).nullable(),
  })
  .refine(
    (requirement) => requirement.sourceRefs.length > 0 || Boolean(requirement.missingInformation),
    { message: 'Every requirement needs source references or explicit missing information.' },
  );

export const targetProfileSchema = z.object({
  programme: z.object({
    id: z.string(),
    name: z.string(),
    university: z.string(),
    level: z.string().nullable(),
    subject: z.string().nullable(),
  }),
  universityValues: z.array(z.string().min(1).max(200)).max(20),
  programmeThemes: z.object({
    description: z.string().max(4000).nullable(),
    themes: z.array(z.string().min(1).max(120)).max(20),
  }),
  requirements: z.array(targetRequirementSchema).max(100),
  deadlines: z
    .array(
      z.object({
        label: z.string().min(1).max(200),
        value: z.string().min(1).max(200),
        sourceRefs: z.array(z.string()).max(10),
      }),
    )
    .max(20),
  missingInformation: z.array(z.object({ area: z.string(), note: z.string() })).max(50),
  sources: z
    .array(
      z.object({
        ref: z.string(),
        url: z.string().nullable(),
        title: z.string().nullable(),
        retrievedAt: z.string().nullable(),
      }),
    )
    .max(50),
  universityProfile: universityProfileSchema.optional(),
  programmeProfile: programmeProfileSchema.optional(),
  scholarshipProfile: programmeProfileSchema.nullable().optional(),
});

export type TargetRequirement = z.infer<typeof targetRequirementSchema>;
export type TargetProfile = z.infer<typeof targetProfileSchema>;
export type TargetFact = z.infer<typeof targetFactSchema>;

/** Minimal projection of the ingested catalogue rows the fingerprint covers. */
export type CatalogueProjection = {
  programme:
    | {
        id: string;
        course_name: string | null;
        university_name: string | null;
        degree_level: string | null;
        subject: string | null;
        source_run_id: string | null;
        source_retrieved_at: string | null;
      }
    | Record<string, unknown>
    | null;
  admissionRequirements: Array<Record<string, unknown>>;
  fieldValues: Array<Record<string, unknown>>;
  sources: Array<{
    ref: string;
    url: string | null;
    title: string | null;
    retrievedAt: string | null;
    contentHash: string | null;
  }>;
};

/**
 * Deterministic serialization for hashing: object keys sorted recursively,
 * arrays ordered by a stable key so row ordering can never change the hash.
 */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) {
    const items = value.map(canonical);
    return items.sort((a, b) =>
      stableKey(a).localeCompare(stableKey(b)) || JSON.stringify(a).localeCompare(JSON.stringify(b)),
    );
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonical(item)]),
    );
  }
  return value;
}

function stableKey(item: unknown): string {
  if (item && typeof item === 'object') {
    const record = item as Record<string, unknown>;
    // Composite key so rows sharing one identity field (e.g. same course_id)
    // still order deterministically.
    return ['course_id', 'document_type', 'id', 'ref', 'field_name', 'kind']
      .map((key) => (typeof record[key] === 'string' ? String(record[key]) : ''))
      .filter(Boolean)
      .join('|');
  }
  return JSON.stringify(item);
}

/** Fingerprint of the catalogue sources behind a profile — the cache key. */
export function canonicalSourceFingerprint(projection: CatalogueProjection): string {
  const material = [
    { kind: 'programme', row: projection.programme ? canonicalSourceRow(projection.programme) : null },
    { kind: 'admission_requirements', rows: projection.admissionRequirements.map(canonicalSourceRow) },
    { kind: 'field_values', rows: projection.fieldValues.map(pickIdentity) },
    {
      kind: 'sources',
      rows: projection.sources.map(({ ref, url, title, contentHash }) => ({ ref, url, title, contentHash })),
    },
  ];
  return createSha256(JSON.stringify(canonical(material)));
}

function canonicalSourceRow(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(row).filter(([key]) => !/(^|_)(retrieved|updated|created)_at$/.test(key) && key !== 'source_retrieved_at'),
  );
}

/** Field values are hashed by identity+status, not full payload, so pure re-fetches with identical content still hit cache via updated_at changes only when real. */
function pickIdentity(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row['id'] ?? null,
    field_name: row['field_name'] ?? null,
    value: row['value'] ?? null,
    verification_status: row['verification_status'] ?? null,
  };
}

function createSha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}
