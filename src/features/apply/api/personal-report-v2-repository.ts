import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProfileEvaluation } from '@/shared/evaluation';
import type {
  PersonalReportTrigger,
  PersonalReportV2,
  PersonalReportVersionSummary,
} from '../domain/personal-report';

/**
 * One version of the canonical (v2) Personal Report — a row in the
 * append-only `student_personal_report_versions` table (see
 * `supabase-personal-report-versions.sql` for why this replaced the old
 * one-row-per-user `student_personal_reports` model).
 *
 * `evaluation_engine_version` versions deterministic scoring; `prompt_version`
 * versions semantic extraction/grounding. Both must match before a cached
 * report is considered current.
 *
 * The five lineage fields are NULL only on legacy archive rows written before
 * reports became application-scoped (see
 * `supabase-application-personal-report-state.sql`). Application-scoped
 * readers narrow them into {@link ApplicationPersonalReportV2Record} where a
 * missing lineage is treated as "not this application's row" rather than
 * tolerated.
 */
export type PersonalReportV2Record = {
  id: string;
  reportV2: PersonalReportV2;
  evaluation: ProfileEvaluation | null;
  inputHash: string;
  engineVersion: string | null;
  promptVersion: string | null;
  modelName: string;
  trigger: PersonalReportTrigger;
  generatedAt: string;
  createdAt: string;
  applicationId: string | null;
  confirmedSnapshotId: string | null;
  sourceAnalysisVersionId: string | null;
  reportContractVersion: string | null;
  cacheKey: string | null;
};

/** Ownership scope every new application-scoped report read/write must carry. */
export type ApplicationReportScope = {
  userId: string;
  applicationId: string;
};

/** A record proven to belong to one application — all lineage fields present. */
export type ApplicationPersonalReportV2Record = PersonalReportV2Record & {
  applicationId: string;
  confirmedSnapshotId: string;
  sourceAnalysisVersionId: string;
  reportContractVersion: string;
  cacheKey: string;
};

const VERSION_SELECT =
  'id,report_v2,structured_evaluation,evaluation_engine_version,input_hash,prompt_version,model_name,trigger,generated_at,created_at';
const VERSION_SELECT_WITH_LINEAGE = `${VERSION_SELECT},application_id,confirmed_snapshot_id,source_analysis_version_id,report_contract_version,cache_key`;

function isPersonalReportV2(value: unknown): value is PersonalReportV2 {
  if (!value || typeof value !== 'object') return false;
  const keys: (keyof PersonalReportV2)[] = [
    'coreIdentity',
    'drivingForce',
    'signaturePattern',
    'emergingThemes',
    'personalPositioning',
    'proofOfMe',
    'overallEvidenceConfidence',
  ];
  return keys.every((key) => key in (value as Record<string, unknown>));
}

function isMigrationMissing(error: { code?: string; message?: string }): boolean {
  return Boolean(
    error.code === '42P01' ||
      error.code === 'PGRST205' ||
      error.code === '42703' ||
      /student_personal_report_versions|report_v2/i.test(error.message ?? ''),
  );
}

function toRecord(row: Record<string, unknown>): PersonalReportV2Record | null {
  if (!row.report_v2 || !isPersonalReportV2(row.report_v2)) {
    if (row.report_v2) console.error('[personal-report-v2] stored report_v2 failed the structural check');
    return null;
  }
  return {
    id: row.id as string,
    reportV2: row.report_v2,
    evaluation: (row.structured_evaluation as ProfileEvaluation | null) ?? null,
    inputHash: row.input_hash as string,
    engineVersion: (row.evaluation_engine_version as string | null) ?? null,
    promptVersion: (row.prompt_version as string | null) ?? null,
    modelName: row.model_name as string,
    trigger: ((row.trigger as PersonalReportTrigger | null) ?? 'manual') as PersonalReportTrigger,
    generatedAt: (row.generated_at as string | null) ?? (row.created_at as string),
    createdAt: row.created_at as string,
    applicationId: (row.application_id as string | null) ?? null,
    confirmedSnapshotId: (row.confirmed_snapshot_id as string | null) ?? null,
    sourceAnalysisVersionId: (row.source_analysis_version_id as string | null) ?? null,
    reportContractVersion: (row.report_contract_version as string | null) ?? null,
    cacheKey: (row.cache_key as string | null) ?? null,
  };
}

/**
 * Narrows a record read under an application scope into the guaranteed-lineage
 * shape. A row whose `application_id` is missing or points at another
 * application can only appear here through a stale client cache — never
 * through the query, which filters on it — and is rejected rather than
 * tolerated, so an application reader can NEVER fall back to a legacy global
 * row.
 */
function toApplicationRecord(record: PersonalReportV2Record | null, applicationId: string): ApplicationPersonalReportV2Record | null {
  if (
    !record ||
    !record.applicationId ||
    !record.confirmedSnapshotId ||
    !record.sourceAnalysisVersionId ||
    !record.reportContractVersion ||
    !record.cacheKey
  ) {
    return null;
  }
  if (record.applicationId !== applicationId) return null;
  return record as ApplicationPersonalReportV2Record;
}

/** The most recent version — what the report page shows by default. */
export async function getLatestPersonalReportV2(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ record: PersonalReportV2Record | null; migrationMissing: boolean }> {
  const { data, error } = await supabase
    .from('student_personal_report_versions')
    .select(VERSION_SELECT)
    .eq('user_id', userId)
    .is('application_id', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    const migrationMissing = isMigrationMissing(error);
    if (!migrationMissing) console.error('[personal-report-v2] read failed', error);
    return { record: null, migrationMissing };
  }
  return { record: data ? toRecord(data) : null, migrationMissing: false };
}

/** Every version's id/date/trigger, newest first — enough to populate the version-history dropdown. */
export async function listPersonalReportV2Versions(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ versions: PersonalReportVersionSummary[]; migrationMissing: boolean }> {
  const { data, error } = await supabase
    .from('student_personal_report_versions')
    .select('id,generated_at,trigger')
    .eq('user_id', userId)
    .is('application_id', null)
    .order('created_at', { ascending: false });

  if (error) {
    const migrationMissing = isMigrationMissing(error);
    if (!migrationMissing) console.error('[personal-report-v2] version list failed', error);
    return { versions: [], migrationMissing };
  }
  return {
    versions: (data ?? []).map((row) => ({
      id: row.id as string,
      generatedAt: (row.generated_at as string) ?? '',
      trigger: ((row.trigger as PersonalReportTrigger | null) ?? 'manual') as PersonalReportTrigger,
    })),
    migrationMissing: false,
  };
}

/** One specific past version, ownership-checked by filtering on `userId` — never trust a version id alone. */
export async function getPersonalReportV2Version(
  supabase: SupabaseClient,
  userId: string,
  versionId: string,
): Promise<{ record: PersonalReportV2Record | null; migrationMissing: boolean }> {
  const { data, error } = await supabase
    .from('student_personal_report_versions')
    .select(VERSION_SELECT)
    .eq('id', versionId)
    .eq('user_id', userId)
    .is('application_id', null)
    .maybeSingle();

  if (error) {
    const migrationMissing = isMigrationMissing(error);
    if (!migrationMissing) console.error('[personal-report-v2] version read failed', error);
    return { record: null, migrationMissing };
  }
  return { record: data ? toRecord(data) : null, migrationMissing: false };
}

// ── application-scoped reads ────────────────────────────────────────────────
//
// Every query below filters on BOTH `user_id` and `application_id`. SQL
// equality against a non-null value can never match a NULL, so legacy archive
// rows (`application_id IS NULL`) are structurally excluded from application
// history — no reader here ever falls back to a user-level scan.

/** The most recent version of ONE application's Personal Report. */
export async function getLatestApplicationPersonalReportV2(
  supabase: SupabaseClient,
  scope: ApplicationReportScope,
): Promise<{ record: ApplicationPersonalReportV2Record | null; migrationMissing: boolean }> {
  const { data, error } = await supabase
    .from('student_personal_report_versions')
    .select(VERSION_SELECT_WITH_LINEAGE)
    .eq('user_id', scope.userId)
    .eq('application_id', scope.applicationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    const migrationMissing = isMigrationMissing(error);
    if (!migrationMissing) console.error('[personal-report-v2] application latest read failed', error);
    return { record: null, migrationMissing };
  }
  return {
    record: data ? toApplicationRecord(toRecord(data), scope.applicationId) : null,
    migrationMissing: false,
  };
}

/** Every version summary of ONE application's report history, newest first. */
export async function listApplicationPersonalReportV2Versions(
  supabase: SupabaseClient,
  scope: ApplicationReportScope,
): Promise<{ versions: PersonalReportVersionSummary[]; migrationMissing: boolean }> {
  const { data, error } = await supabase
    .from('student_personal_report_versions')
    .select('id,generated_at,trigger')
    .eq('user_id', scope.userId)
    .eq('application_id', scope.applicationId)
    .order('created_at', { ascending: false });

  if (error) {
    const migrationMissing = isMigrationMissing(error);
    if (!migrationMissing) console.error('[personal-report-v2] application version list failed', error);
    return { versions: [], migrationMissing };
  }
  return {
    versions: (data ?? []).map((row) => ({
      id: row.id as string,
      generatedAt: (row.generated_at as string) ?? '',
      trigger: ((row.trigger as PersonalReportTrigger | null) ?? 'manual') as PersonalReportTrigger,
    })),
    migrationMissing: false,
  };
}

/** One past version of ONE application — ownership checked on all three columns. */
export async function getApplicationPersonalReportV2Version(
  supabase: SupabaseClient,
  scope: ApplicationReportScope,
  versionId: string,
): Promise<{ record: ApplicationPersonalReportV2Record | null; migrationMissing: boolean }> {
  const { data, error } = await supabase
    .from('student_personal_report_versions')
    .select(VERSION_SELECT_WITH_LINEAGE)
    .eq('id', versionId)
    .eq('user_id', scope.userId)
    .eq('application_id', scope.applicationId)
    .maybeSingle();

  if (error) {
    const migrationMissing = isMigrationMissing(error);
    if (!migrationMissing) console.error('[personal-report-v2] application version read failed', error);
    return { record: null, migrationMissing };
  }
  return {
    record: data ? toApplicationRecord(toRecord(data), scope.applicationId) : null,
    migrationMissing: false,
  };
}

/**
 * Cache-key resolution for idempotent generation: the same
 * (snapshot × contracts × inputs) hash always resolves to the SAME row within
 * an application. Backed by `uq_personal_report_application_cache_key`, so a
 * concurrent insert that loses the unique race can look its winner up here
 * instead of writing a duplicate.
 */
export async function findPersonalReportV2ByCacheKey(
  supabase: SupabaseClient,
  scope: ApplicationReportScope,
  cacheKey: string,
): Promise<{ record: ApplicationPersonalReportV2Record | null; migrationMissing: boolean }> {
  const { data, error } = await supabase
    .from('student_personal_report_versions')
    .select(VERSION_SELECT_WITH_LINEAGE)
    .eq('user_id', scope.userId)
    .eq('application_id', scope.applicationId)
    .eq('cache_key', cacheKey)
    .maybeSingle();

  if (error) {
    const migrationMissing = isMigrationMissing(error);
    if (!migrationMissing) console.error('[personal-report-v2] cache-key lookup failed', error);
    return { record: null, migrationMissing };
  }
  return {
    record: data ? toApplicationRecord(toRecord(data), scope.applicationId) : null,
    migrationMissing: false,
  };
}

/**
 * Report-only supplementary answers — see
 * `supabase-personal-report-supplements.sql` for why these are deliberately
 * NOT written back to `student_profiles` or any confirmed snapshot. Read by
 * Personal Report generation only, to fill in specific gaps the report
 * itself asked about (currently just `study_motivation`).
 */
export async function getPersonalReportSupplements(
  supabase: SupabaseClient,
  userId: string,
): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from('personal_report_supplements')
    .select('field_key, answer')
    .eq('user_id', userId);

  if (error) {
    const migrationMissing =
      error.code === '42P01' || error.code === 'PGRST205' || error.code === '42703';
    if (!migrationMissing) console.error('[personal-report-v2] supplement read failed', error);
    return {};
  }

  return Object.fromEntries((data ?? []).map((row) => [row.field_key, row.answer]));
}

/** Application-scoped report supplements; legacy global answers never cross application boundaries. */
export async function getApplicationPersonalReportSupplements(
  supabase: SupabaseClient,
  scope: ApplicationReportScope,
): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from('application_personal_report_supplements')
    .select('field_key, answer')
    .eq('user_id', scope.userId)
    .eq('application_id', scope.applicationId);

  if (error) {
    const migrationMissing =
      error.code === '42P01' || error.code === 'PGRST205' || error.code === '42703';
    if (!migrationMissing) console.error('[personal-report-v2] application supplement read failed', error);
    return {};
  }

  return Object.fromEntries((data ?? []).map((row) => [row.field_key, row.answer]));
}

export async function saveApplicationPersonalReportSupplement(
  supabase: SupabaseClient,
  args: { userId: string; applicationId: string; fieldKey: string; answer: string },
): Promise<{ error: { migrationMissing: boolean; message: string } | null }> {
  const { error } = await supabase.from('application_personal_report_supplements').upsert(
    {
      user_id: args.userId,
      application_id: args.applicationId,
      field_key: args.fieldKey,
      answer: args.answer,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,application_id,field_key' },
  );

  if (!error) return { error: null };

  const migrationMissing = isMigrationMissing(error);
  console.error('[personal-report-v2] application supplement upsert failed', error);
  return { error: { migrationMissing, message: error.message } };
}

export async function savePersonalReportSupplement(
  supabase: SupabaseClient,
  args: { userId: string; fieldKey: string; answer: string },
): Promise<{ error: { migrationMissing: boolean; message: string } | null }> {
  const { error } = await supabase.from('personal_report_supplements').upsert(
    {
      user_id: args.userId,
      field_key: args.fieldKey,
      answer: args.answer,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,field_key' },
  );

  if (!error) return { error: null };

  const migrationMissing =
    error.code === '42P01' || error.code === 'PGRST205' || error.code === '42703';
  console.error('[personal-report-v2] supplement upsert failed', error);
  return { error: { migrationMissing, message: error.message } };
}

/**
 * Appends a new version — never upserts. Every regeneration is its own row,
 * which is what makes the version-history dropdown possible; see
 * `supabase-personal-report-versions.sql`'s file comment for why this
 * replaced the old one-row upsert.
 *
 * Application-scoped generation MUST pass the full lineage
 * (`applicationId`, `confirmedSnapshotId`, `sourceAnalysisVersionId`,
 * `reportContractVersion`, `cacheKey`) — see
 * `supabase-application-personal-report-state.sql`. When a concurrent request
 * already inserted the same cache key (unique index
 * `uq_personal_report_application_cache_key`), this resolves to THAT row and
 * reports success instead of writing a duplicate.
 */
export async function createPersonalReportV2Version(
  supabase: SupabaseClient,
  args: {
    userId: string;
    reportV2: PersonalReportV2;
    evaluation: ProfileEvaluation;
    inputHash: string;
    engineVersion: string;
    promptVersion: string;
    modelName: string;
    trigger: PersonalReportTrigger;
    /** Application lineage — omit only on legacy global archive writes. */
    applicationId?: string;
    confirmedSnapshotId?: string;
    sourceAnalysisVersionId?: string;
    reportContractVersion?: string;
    cacheKey?: string;
  },
): Promise<{ record: { id: string; generatedAt: string } | null; error: { migrationMissing: boolean; message: string } | null }> {
  if (
    args.applicationId &&
    (!args.confirmedSnapshotId ||
      !args.sourceAnalysisVersionId ||
      !args.reportContractVersion ||
      !args.cacheKey)
  ) {
    return {
      record: null,
      error: {
        migrationMissing: false,
        message: 'Application report lineage is incomplete.',
      },
    };
  }
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('student_personal_report_versions')
    .insert({
      user_id: args.userId,
      report_v2: args.reportV2,
      structured_evaluation: args.evaluation,
      evaluation_engine_version: args.engineVersion,
      input_hash: args.inputHash,
      prompt_version: args.promptVersion,
      model_name: args.modelName,
      trigger: args.trigger,
      generated_at: now,
      created_at: now,
      ...(args.applicationId ? { application_id: args.applicationId } : {}),
      ...(args.confirmedSnapshotId ? { confirmed_snapshot_id: args.confirmedSnapshotId } : {}),
      ...(args.sourceAnalysisVersionId ? { source_analysis_version_id: args.sourceAnalysisVersionId } : {}),
      ...(args.reportContractVersion ? { report_contract_version: args.reportContractVersion } : {}),
      ...(args.cacheKey ? { cache_key: args.cacheKey } : {}),
    })
    .select('id,generated_at')
    .single();

  if (!error) {
    return { record: { id: data.id as string, generatedAt: data.generated_at as string }, error: null };
  }

  // A concurrent non-force generation with the same inputs won the cache-key
  // race: resolve to its row rather than surfacing a failure (or duplicating).
  if (
    error.code === '23505' &&
    /uq_personal_report_application_cache_key/i.test(error.message) &&
    args.applicationId &&
    args.cacheKey
  ) {
    const existing = await findPersonalReportV2ByCacheKey(
      supabase,
      { userId: args.userId, applicationId: args.applicationId },
      args.cacheKey,
    );
    if (existing.record) {
      return {
        record: { id: existing.record.id, generatedAt: existing.record.generatedAt },
        error: null,
      };
    }
  }

  console.error('[personal-report-v2] version insert failed', error);
  return { record: null, error: { migrationMissing: isMigrationMissing(error), message: error.message } };
}
