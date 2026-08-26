import { defaultOpenAIModel } from '../openai-client';
import { getReportPrompt, REPORT_PROMPT_VERSIONS } from '../runtime/prompt-registry';
import {
  generateStructured,
  StructuredGenerationError,
} from '../runtime/structured-generation';
import { z } from 'zod';
import {
  canonicalSourceFingerprint,
  targetProfileSchema,
  TARGET_PROFILE_SCHEMA_VERSION,
  type CatalogueProjection,
  type TargetProfile,
  type TargetRequirement,
} from './domain';
import {
  createTargetProfileVersion,
  getLatestTargetProfileVersion,
  loadProgrammeCatalogue,
} from './repository';

/**
 * Target Profile resolution (Task 4).
 *
 * Deterministic-first: every already-structured catalogue row maps directly
 * onto a requirement with its provenance. Only genuinely unstructured prose
 * goes to the model — through `generateStructured` with the shared registry
 * prompt — and its output is merged under the same "sources or explicit
 * missing information" rule.
 *
 * STALENESS = fingerprint mismatch between the newest stored version and the
 * CURRENT ingested rows. It is never about retrieval age. On `stale` this
 * resolver regenerates synchronously and reports status 'stale' with the NEW
 * version id; a first-ever generation reports 'ready'; an unchanged
 * fingerprint serves 'cached'. Absent lineage (no programme row) is
 * 'not_ready' and generates nothing.
 *
 * This module performs no network I/O beyond the model call itself — there is
 * no code path that could crawl an arbitrary URL.
 */

export type TargetProfileResolution =
  | { status: 'not_ready'; versionId: null; profile: null; reason: string }
  | { status: 'cached'; versionId: string; profile: TargetProfile }
  | { status: 'stale'; versionId: string; profile: TargetProfile; previousVersionId: string }
  | { status: 'ready'; versionId: string; profile: TargetProfile };

/** Unstructured prose pool handed to the extractor (already source-tagged). */
export type UnstructuredSource = { ref: string; text: string };

export type ExtractedRequirementDraft = {
  category: TargetRequirement['category'];
  label: string;
  detail: string | null;
  sourceRefs: string[];
};

export type RequirementExtractor = (
  sources: readonly UnstructuredSource[],
) => Promise<ExtractedRequirementDraft[]>;

const extractionOutputSchema = z.object({
  requirements: z
    .array(
      z.object({
        category: z.enum(['academic', 'competency', 'selection', 'scholarship', 'application']),
        label: z.string().min(1).max(300),
        detail: z.string().max(2000).nullable(),
        sourceIndex: z.number().int().min(0).max(49),
      }),
    )
    .max(40),
});

/**
 * Default extractor: one structured model call over the unstructured prose.
 * The registry prompt pins extraction-only behaviour and per-source citation.
 */
export const structuredRequirementExtractor: RequirementExtractor = async (sources) => {
  if (sources.length === 0) return [];
  const { systemPrompt } = getReportPrompt('target_profile_extraction');
  try {
    const result = await generateStructured({
      moduleId: 'target_profile_extraction',
      promptVersion: REPORT_PROMPT_VERSIONS.target_profile_extraction,
      schemaVersion: TARGET_PROFILE_SCHEMA_VERSION,
      schema: extractionOutputSchema,
      systemPrompt,
      userPrompt:
        `Extract programme requirements/criteria from the numbered sources below. ` +
        `Cite each item with the index of its source. Sources:\n` +
        sources.map((source, index) => `[${index}] (${source.ref}) ${source.text}`).join('\n'),
      temperature: 0,
      maxTokens: 2400,
    });
    return result.data.requirements.map((item) => ({
      category: item.category,
      label: item.label,
      detail: item.detail,
      sourceRefs: [sources[item.sourceIndex]?.ref ?? ''],
    }));
  } catch (error) {
    if (error instanceof StructuredGenerationError) {
      // Extraction failure degrades to deterministic-only output; never fails
      // the whole request when structure already mapped something.
      console.warn('[target-profile] unstructured extraction failed', error.kind);
      return [];
    }
    throw error;
  }
};

function fieldText(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record['text'] === 'string') return record['text'];
  }
  return null;
}

/** Field names that map deterministically onto profile slots. */
const DEADLINE_FIELDS = /deadline|due_date|closing/i;
const SCHOLARSHIP_FIELDS = /scholarship|bursary|funding|merit/i;
const VALUE_FIELDS = /value|mission|ethos|culture/i;
const THEME_FIELDS = /theme|focus|specialis|description|overview/i;

export async function resolveTargetProfile(args: {
  supabase: import('@supabase/supabase-js').SupabaseClient;
  userId: string;
  programmeId: string;
  scholarshipKey?: string;
  /** Injectable for tests; defaults to the structured AI extractor. */
  extractor?: RequirementExtractor;
}): Promise<TargetProfileResolution> {
  const extractor = args.extractor ?? structuredRequirementExtractor;
  const { projection, complete } = await loadProgrammeCatalogue(args.supabase, args.programmeId);
  if (!complete || !projection.programme) {
    return {
      status: 'not_ready',
      versionId: null,
      profile: null,
      reason: 'Programme not found in the ingested catalogue.',
    };
  }

  const fingerprint = canonicalSourceFingerprint(projection);
  const cached = await getLatestTargetProfileVersion(args.supabase, {
    userId: args.userId,
    programmeId: args.programmeId,
    scholarshipKey: args.scholarshipKey,
  });
  if (cached && cached.sourceFingerprint === fingerprint) {
    return { status: 'cached', versionId: cached.id, profile: cached.profile };
  }

  // ── build the profile ─────────────────────────────────────────────────────
  const programmeRow = projection.programme as Record<string, unknown>;
  const requirements: TargetRequirement[] = [];
  const deadlines: TargetProfile['deadlines'] = [];
  const missingInformation: TargetProfile['missingInformation'] = [];
  const universityValues: string[] = [];
  let description: string | null = null;
  const themes: string[] = [];
  const unstructured: UnstructuredSource[] = [];

  for (const row of projection.admissionRequirements) {
    const documentType = String(row['document_type'] ?? 'requirement');
    const runRef = typeof row['source_run_id'] === 'string' ? row['source_run_id'] : '';
    requirements.push({
      id: `adm:${documentType}`,
      category: /english|ielts|toefl|test|gpa|transcript|academic/i.test(documentType)
        ? 'academic'
        : 'application',
      label: documentType.replace(/_/g, ' '),
      detail: row['required_count'] != null ? `${row['required_count']} document(s)` : null,
      status: (row['requirement_status'] as TargetRequirement['status']) ?? 'unknown',
      sourceRefs: runRef ? [runRef] : [],
      missingInformation: runRef ? null : 'No ingest provenance recorded for this requirement.',
    });
  }

  for (const row of projection.fieldValues) {
    const fieldName = String(row['field_name'] ?? '');
    const text = fieldText(row['value']);
    const runRef = typeof row['source_run_id'] === 'string' ? row['source_run_id'] : '';
    if (!text) continue;

    if (DEADLINE_FIELDS.test(fieldName)) {
      deadlines.push({ label: fieldName.replace(/_/g, ' '), value: text.slice(0, 200), sourceRefs: runRef ? [runRef] : [] });
      continue;
    }
    if (SCHOLARSHIP_FIELDS.test(fieldName)) {
      requirements.push({
        id: `sch:${row['id'] ?? fieldName}`,
        category: 'scholarship',
        label: fieldName.replace(/_/g, ' '),
        detail: text.slice(0, 500),
        status: 'unknown',
        sourceRefs: runRef ? [runRef] : [],
        missingInformation: runRef ? null : 'Scholarship note lacks ingest provenance.',
      });
      continue;
    }
    if (VALUE_FIELDS.test(fieldName)) {
      universityValues.push(text.slice(0, 200));
      continue;
    }
    if (THEME_FIELDS.test(fieldName)) {
      if (/description|overview/.test(fieldName)) description = description ?? text.slice(0, 4000);
      else themes.push(text.slice(0, 120));
      continue;
    }
    // Everything else stays prose for the extractor, WITH its provenance.
    unstructured.push({ ref: runRef || `fv:${String(row['id'] ?? fieldName)}`, text: text.slice(0, 4000) });
  }

  const extracted = await extractor(unstructured);
  for (const draft of extracted) {
    requirements.push({
      id: `ext:${draft.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60)}`,
      category: draft.category,
      label: draft.label,
      detail: draft.detail,
      status: null,
      sourceRefs: draft.sourceRefs.filter(Boolean),
      missingInformation: draft.sourceRefs.filter(Boolean).length ? null : 'Extraction cited no ingested source.',
    });
  }

  const profile: TargetProfile = targetProfileSchema.parse({
    programme: {
      id: String(programmeRow['id']),
      name: String(programmeRow['course_name'] ?? ''),
      university: String(programmeRow['university_name'] ?? ''),
      level: (programmeRow['degree_level'] as string | null) ?? null,
      subject: (programmeRow['subject'] as string | null) ?? null,
    },
    universityValues: Array.from(new Set(universityValues)).slice(0, 20),
    programmeThemes: { description, themes: Array.from(new Set(themes)).slice(0, 20) },
    requirements,
    deadlines,
    missingInformation,
    sources: projection.sources.map((source) => ({
      ref: source.ref,
      url: source.url,
      title: source.title,
      retrievedAt: source.retrievedAt,
    })),
  });

  const { versionId } = await createTargetProfileVersion(args.supabase, {
    userId: args.userId,
    programmeId: args.programmeId,
    scholarshipKey: args.scholarshipKey,
    sourceFingerprint: fingerprint,
    profile,
    modelName: defaultOpenAIModel(),
    promptVersion: REPORT_PROMPT_VERSIONS.target_profile_extraction,
  });

  if (!versionId) {
    return {
      status: 'not_ready',
      versionId: null,
      profile: null,
      reason: 'Target profile persistence is not available yet.',
    };
  }

  return cached
    ? { status: 'stale', versionId, profile, previousVersionId: cached.id }
    : { status: 'ready', versionId, profile };
}
