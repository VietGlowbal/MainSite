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
};

const VERSION_SELECT =
  'id,report_v2,structured_evaluation,evaluation_engine_version,input_hash,prompt_version,model_name,trigger,generated_at,created_at';

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
  };
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
    .maybeSingle();

  if (error) {
    const migrationMissing = isMigrationMissing(error);
    if (!migrationMissing) console.error('[personal-report-v2] version read failed', error);
    return { record: null, migrationMissing };
  }
  return { record: data ? toRecord(data) : null, migrationMissing: false };
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
  },
): Promise<{ record: { id: string; generatedAt: string } | null; error: { migrationMissing: boolean; message: string } | null }> {
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
    })
    .select('id,generated_at')
    .single();

  if (error) {
    console.error('[personal-report-v2] version insert failed', error);
    return { record: null, error: { migrationMissing: isMigrationMissing(error), message: error.message } };
  }
  return { record: { id: data.id as string, generatedAt: data.generated_at as string }, error: null };
}
