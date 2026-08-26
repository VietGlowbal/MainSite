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
  const programme = (programmeSelect.data ?? null) as CatalogueProjection['programme'];

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

  return {
    complete: Boolean(programme),
    projection: {
      programme,
      admissionRequirements,
      fieldValues,
      sources: runIds
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
        }),
    },
  };
}

export type StoredTargetProfileVersion = {
  id: string;
  sourceFingerprint: string;
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
    .select('id, source_fingerprint, profile, created_at')
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
  },
): Promise<{ versionId: string | null; migrationMissing: boolean }> {
  const { data, error } = await supabase
    .from('programme_target_profile_versions')
    .insert({
      programme_id: args.programmeId,
      scholarship_key: args.scholarshipKey ?? null,
      source_fingerprint: args.sourceFingerprint,
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
