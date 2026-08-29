import type { SupabaseClient } from '@supabase/supabase-js';
import type { CatalogueProjection, TargetProfile } from './domain';

/**
 * Catalogue reads for Target Profile generation (Task 4). Reads ONLY the
 * already-ingested tables — this module has no ability to fetch a URL, which
 * is what makes "the request never initiates crawling" structurally true.
 *
 * Every select is tolerant of a missing table/column so an un-migrated or
 * partially-ingested catalogue degrades to `not_ready` instead of failing.
 */

export type ProgrammeCatalogueLoad = {
  projection: CatalogueProjection;
  complete: boolean; // false when the programme row itself is absent
};

function isSchemaGap(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === '42P01' ||
    error.code === '42703' ||
    error.code === 'PGRST204' ||
    error.code === 'PGRST205'
  );
}

/** Awaitable list builder result helper — used as the builder's onFulfilled. */
function toRows(result: unknown): Array<Record<string, unknown>> {
  const { data, error } = (result ?? {}) as {
    data?: Array<Record<string, unknown>> | null;
    error?: unknown;
  };
  if (error) {
    if (!isSchemaGap(error as { code?: string })) {
      console.error('[target-profile] catalogue read failed', error);
    }
    return [];
  }
  return data ?? [];
}

function textValue(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value && typeof value === 'object') {
    const text = (value as Record<string, unknown>)['text'];
    if (typeof text === 'string') return text.trim() || null;
    try {
      const json = JSON.stringify(value);
      return json === '{}' ? null : json;
    } catch {
      return null;
    }
  }
  return null;
}

function urlValue(value: unknown): string | null {
  const text = textValue(value);
  if (!text) return null;
  return /^https?:\/\//i.test(text) ? text : `https://${text}`;
}

export async function loadProgrammeCatalogue(
  supabase: SupabaseClient,
  programmeId: string,
): Promise<ProgrammeCatalogueLoad> {
  const programmeSelect = await supabase
    .from('courses')
    .select(
      'id, course_name, university_name, degree_level, subject, source_run_id, source_retrieved_at',
    )
    .eq('id', programmeId)
    .maybeSingle();

  if (programmeSelect.error && !isSchemaGap(programmeSelect.error)) {
    console.error('[target-profile] programme read failed', programmeSelect.error);
  }
  let programme = (programmeSelect.data ?? null) as CatalogueProjection['programme'];
  if (programme) {
    // The narrow read keeps this path compatible with older schemas. The full
    // row supplies the public catalogue columns that were already imported but
    // were previously invisible to Target Profile generation.
    const detailSelect = await supabase
      .from('courses')
      .select('*')
      .eq('id', programmeId)
      .maybeSingle();
    if (detailSelect.data) programme = detailSelect.data as CatalogueProjection['programme'];
    else if (detailSelect.error && !isSchemaGap(detailSelect.error)) {
      console.error('[target-profile] programme detail read failed', detailSelect.error);
    }
  }

  const [admissionRequirements, fieldValues] = await Promise.all([
    supabase
      .from('course_admission_requirements')
      .select(
        'course_id, document_type, requirement_status, required_count, application_stage, display_mode, source_run_id, source_retrieved_at, updated_at',
      )
      .eq('course_id', programmeId)
      .then(toRows),
    supabase
      .from('course_field_values')
      .select(
        'id, field_name, value, verification_status, retrieved_at, confidence, audience, academic_cycle, source_run_id',
      )
      .eq('course_id', programmeId)
      .then(toRows),
  ]);

  // Sources backing those rows — bounded read of crawl provenance.
  const runIds = Array.from(
    new Set(
      [
        ...admissionRequirements.map((row) => row.source_run_id),
        ...fieldValues.map((row) => row.source_run_id),
        (programme as Record<string, unknown> | null)?.['source_run_id'],
      ].filter((id): id is string => typeof id === 'string'),
    ),
  ).slice(0, 20);

  const sourceRows = runIds.length
    ? await supabase
        .from('crawl_sources')
        .select('run_id, url, title, retrieved_at, content_hash, page_type')
        .in('run_id', runIds)
        .then(toRows)
    : [];

  // One representative source per run keeps `sources` bounded.
  const byRun = new Map<string, Record<string, unknown>>();
  for (const row of sourceRows) {
    const runId = row.run_id as string;
    if (!byRun.has(runId)) byRun.set(runId, row);
  }

  const sources: CatalogueProjection['sources'] = runIds
    .filter((runId) => byRun.has(runId))
    .map((runId) => {
      const row = byRun.get(runId)!;
      return {
        ref: runId,
        url: (row.url as string | null) ?? null,
        title: (row.title as string | null) ?? null,
        retrievedAt: (row.retrieved_at as string | null) ?? null,
        contentHash: (row.content_hash as string | null) ?? null,
      };
    });

  const programmeRow = programme as Record<string, unknown> | null;
  const universityId = programmeRow?.['university_id'];
  const universitySelect = universityId != null
    ? await supabase
        .from('universities')
        .select('*')
        .eq('id', universityId)
        .maybeSingle()
    : null;
  if (universitySelect?.error && !isSchemaGap(universitySelect.error)) {
    console.error('[target-profile] university read failed', universitySelect.error);
  }
  const university = (universitySelect?.data ?? null) as Record<string, unknown> | null;

  const programmeRef = `catalogue:course:${programmeId}`;
  const universityRef = universityId != null ? `catalogue:university:${String(universityId)}` : null;
  const addSource = (ref: string, row: Record<string, unknown> | null, fallbackTitle: string) => {
    if (!row || sources.some((source) => source.ref === ref)) return;
    sources.push({
      ref,
      url: urlValue(row['canonical_url']) ?? urlValue(row['course_url']) ?? urlValue(row['official_url']) ?? urlValue(row['primary_domain']),
      title: textValue(row['course_name']) ?? textValue(row['name']) ?? fallbackTitle,
      retrievedAt: textValue(row['source_retrieved_at']) ?? textValue(row['updated_at']) ?? null,
      contentHash: null,
    });
  };
  addSource(programmeRef, programmeRow, 'Course catalogue record');
  if (universityRef) addSource(universityRef, university, 'University catalogue record');

  const allAdmissionRequirements = [...admissionRequirements];
  const allFieldValues = [...fieldValues];
  const addRequirement = (ref: string, fieldName: string, value: unknown, category: 'academic' | 'application' | 'scholarship' = 'academic') => {
    const detail = textValue(value);
    if (!detail || allAdmissionRequirements.some((row) => row.document_type === fieldName && row.source_run_id === ref)) return;
    allAdmissionRequirements.push({
      course_id: programmeId,
      document_type: fieldName,
      requirement_status: 'unknown',
      required_count: null,
      application_stage: null,
      display_mode: 'catalogue',
      source_run_id: ref,
      source_retrieved_at: null,
      updated_at: null,
      category,
      detail,
    });
  };
  const addField = (ref: string, fieldName: string, value: unknown, retrievedAt: string | null) => {
    const text = textValue(value);
    if (!text || allFieldValues.some((row) => row.field_name === fieldName && row.source_run_id === ref)) return;
    allFieldValues.push({
      id: `${ref}:${fieldName}`,
      field_name: fieldName,
      value: text,
      verification_status: 'CATALOGUE',
      retrieved_at: retrievedAt,
      confidence: 1,
      audience: 'public',
      academic_cycle: null,
      source_run_id: ref,
    });
  };

  if (programmeRow) {
    const courseRetrievedAt = textValue(programmeRow['source_retrieved_at']) ?? textValue(programmeRow['updated_at']);
    addRequirement(programmeRef, 'academic_entry_requirement', programmeRow['entry_requirements_summary']);
    addRequirement(programmeRef, 'entry_requirement_details', programmeRow['entry_requirements']);
    addRequirement(programmeRef, 'english_requirement', programmeRow['english_requirements_summary']);
    addField(programmeRef, 'programme_description', programmeRow['description'] ?? programmeRow['course_description'], courseRetrievedAt);
    addField(programmeRef, 'programme_curriculum', programmeRow['curriculum'] ?? programmeRow['modules'], courseRetrievedAt);
    addField(programmeRef, 'programme_outcomes', programmeRow['outcomes'] ?? programmeRow['learning_outcomes'], courseRetrievedAt);
    addField(programmeRef, 'programme_opportunities', programmeRow['career_opportunities'] ?? programmeRow['career_pathways'], courseRetrievedAt);
    addField(programmeRef, 'teaching_style', programmeRow['teaching_style'], courseRetrievedAt);
    addField(programmeRef, 'study_mode', programmeRow['study_mode'], courseRetrievedAt);
    addRequirement(programmeRef, 'application_method', programmeRow['application_method'], 'application');
  }

  if (university && universityRef) {
    const universityRetrievedAt = textValue(university['updated_at']);
    addRequirement(universityRef, 'university_gpa_range', university['gpa_range']);
    addRequirement(universityRef, 'university_english_requirement', university['english_requirement']);
    addRequirement(universityRef, 'standardized_test', university['standardized_test'], 'application');
    addRequirement(universityRef, 'special_test', university['special_test'], 'application');
    addRequirement(universityRef, 'scholarship_information', university['scholarship'], 'scholarship');
    addField(universityRef, 'university_mission', university['mission'], universityRetrievedAt);
    addField(universityRef, 'university_values', university['values'], universityRetrievedAt);
    addField(universityRef, 'specific_insight', university['specific_insight'], universityRetrievedAt);
    addField(universityRef, 'best_for', university['best_for'], universityRetrievedAt);
    addField(universityRef, 'teaching_style', university['teaching_style'], universityRetrievedAt);
    addField(universityRef, 'international_environment', university['international_environment'], universityRetrievedAt);
    addField(universityRef, 'industry_connections', university['industry_connections'], universityRetrievedAt);
    addField(universityRef, 'internship_coop', university['internship_coop'], universityRetrievedAt);
    addField(universityRef, 'strengths', university['strengths'], universityRetrievedAt);
    addField(universityRef, 'weaknesses', university['weaknesses'], universityRetrievedAt);
    addField(universityRef, 'university_notes', university['notes'], universityRetrievedAt);
  }

  return {
    complete: Boolean(programme),
    projection: {
      programme,
      admissionRequirements: allAdmissionRequirements,
      fieldValues: allFieldValues,
      sources,
    },
  };
}

export type StoredTargetProfileVersion = {
  id: string;
  sourceFingerprint: string;
  schemaVersion: string;
  extractionPromptVersion: string;
  profile: TargetProfile;
  createdAt: string;
};

export async function getLatestTargetProfileVersion(
  supabase: SupabaseClient,
  args: { userId: string; programmeId: string; scholarshipKey?: string },
): Promise<StoredTargetProfileVersion | null> {
  // Programme-scoped cache: rows are shared across users (the profile is
  // extracted from catalogue data only and contains no personal data), so the
  // read deliberately does NOT filter by user. `userId` is kept in the
  // signature for logging/provenance symmetry with createTargetProfileVersion.
  void args.userId;
  let query = supabase
    .from('programme_target_profile_versions')
    .select('id, source_fingerprint, schema_version, extraction_prompt_version, profile, created_at')
    .eq('programme_id', args.programmeId);
  query = args.scholarshipKey
    ? query.eq('scholarship_key', args.scholarshipKey)
    : query.is('scholarship_key', null);
  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    // Surface schema gaps loudly (warn) so a column/table mismatch can never
    // silently masquerade as a cold cache again; genuine read failures error.
    if (isSchemaGap(error)) {
      console.warn('[target-profile] version lookup hit a schema gap', error.code, error.message);
    } else {
      console.error('[target-profile] version lookup failed', error);
    }
    return null;
  }
  if (!data?.profile) return null;
  return {
    id: data.id as string,
    sourceFingerprint: data.source_fingerprint as string,
    schemaVersion: data.schema_version as string,
    extractionPromptVersion: data.extraction_prompt_version as string,
    profile: data.profile as TargetProfile,
    createdAt: data.created_at as string,
  };
}

export async function createTargetProfileVersion(
  supabase: SupabaseClient,
  args: {
    userId: string;
    programmeId: string;
    scholarshipKey?: string;
    sourceFingerprint: string;
    profile: TargetProfile;
    modelName: string;
    promptVersion: string;
    schemaVersion: string;
  },
): Promise<{ versionId: string | null; migrationMissing: boolean }> {
  const { data, error } = await supabase
    .from('programme_target_profile_versions')
    .insert({
      programme_id: args.programmeId,
      scholarship_key: args.scholarshipKey ?? null,
      source_fingerprint: args.sourceFingerprint,
      schema_version: args.schemaVersion,
      extraction_prompt_version: args.promptVersion,
      profile: args.profile,
      status: 'ready',
      model_name: args.modelName,
      prompt_version: args.promptVersion,
      created_by: args.userId,
    })
    .select('id')
    .single();

  if (error) {
    const migrationMissing = isSchemaGap(error);
    console.error('[target-profile] version insert failed', error);
    return { versionId: null, migrationMissing };
  }
  return { versionId: data.id as string, migrationMissing: false };
}
