import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProfileEvaluation } from '@/shared/evaluation';
import type { PersonalReportV2 } from '../domain/personal-report';

/**
 * Storage for the canonical (v2) Personal Report.
 *
 * `evaluation_engine_version` versions deterministic scoring; `prompt_version`
 * versions semantic extraction/grounding. Both must match before a cached
 * report is considered current.
 */
export type PersonalReportV2Record = {
  reportV2: PersonalReportV2;
  evaluation: ProfileEvaluation | null;
  inputHash: string;
  engineVersion: string | null;
  promptVersion: string | null;
  modelName: string;
  generatedAt: string;
  updatedAt: string;
};

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

export async function getPersonalReportV2Record(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ record: PersonalReportV2Record | null; migrationMissing: boolean }> {
  const { data, error } = await supabase
    .from('student_personal_reports')
    .select(
      'report_v2,report_v2_generated_at,structured_evaluation,evaluation_engine_version,input_hash,prompt_version,model_name,updated_at',
    )
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    const migrationMissing =
      error.code === '42P01' ||
      error.code === 'PGRST205' ||
      error.code === '42703' ||
      /student_personal_reports|report_v2/i.test(error.message ?? '');
    if (!migrationMissing) console.error('[personal-report-v2] read failed', error);
    return { record: null, migrationMissing };
  }
  if (!data?.report_v2) return { record: null, migrationMissing: false };
  if (!isPersonalReportV2(data.report_v2)) {
    console.error('[personal-report-v2] stored report_v2 failed the structural check');
    return { record: null, migrationMissing: false };
  }

  return {
    record: {
      reportV2: data.report_v2,
      evaluation: (data.structured_evaluation as ProfileEvaluation | null) ?? null,
      inputHash: data.input_hash,
      engineVersion: data.evaluation_engine_version,
      promptVersion: data.prompt_version,
      modelName: data.model_name,
      generatedAt: data.report_v2_generated_at ?? data.updated_at,
      updatedAt: data.updated_at,
    },
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

export async function savePersonalReportV2(
  supabase: SupabaseClient,
  args: {
    userId: string;
    reportV2: PersonalReportV2;
    evaluation: ProfileEvaluation;
    inputHash: string;
    engineVersion: string;
    promptVersion: string;
    modelName: string;
  },
): Promise<{ error: { migrationMissing: boolean; message: string } | null }> {
  const now = new Date().toISOString();
  const { error } = await supabase.from('student_personal_reports').upsert(
    {
      user_id: args.userId,
      report_v2: args.reportV2,
      report_v2_generated_at: now,
      structured_evaluation: args.evaluation,
      evaluation_engine_version: args.engineVersion,
      input_hash: args.inputHash,
      prompt_version: args.promptVersion,
      model_name: args.modelName,
      generated_at: now,
      updated_at: now,
    },
    { onConflict: 'user_id' },
  );

  if (!error) return { error: null };

  const migrationMissing =
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    error.code === '42703' ||
    /student_personal_reports|report_v2/i.test(error.message ?? '');
  console.error('[personal-report-v2] upsert failed', error);
  return { error: { migrationMissing, message: error.message } };
}
