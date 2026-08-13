import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProfileEvaluation } from '@/shared/evaluation';
import type { PersonalReportV2 } from '../domain/personal-report';

/**
 * Storage for the canonical (v2) Personal Report.
 *
 * One row per user (`student_personal_reports.user_id` is the primary key —
 * see supabase-ai-strategy-reports.sql), same table the deprecated v1
 * pipeline already writes to. `report_v2`/`report_v2_generated_at` are new,
 * additive columns (supabase-shared-evaluation-engine.sql); `structured_
 * evaluation`/`evaluation_engine_version`/`input_hash` are reused as-is —
 * `shouldRegenerate` (src/shared/evaluation/versioning.ts) is what makes
 * regeneration idempotent against them.
 */

export type PersonalReportV2Record = {
  reportV2: PersonalReportV2;
  evaluation: ProfileEvaluation | null;
  inputHash: string;
  engineVersion: string | null;
  modelName: string;
  generatedAt: string;
  updatedAt: string;
};

/** A minimal structural check — this is server-written JSONB, not user input, so full re-validation buys nothing beyond catching a genuinely corrupt row. */
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
      'report_v2,report_v2_generated_at,structured_evaluation,evaluation_engine_version,input_hash,model_name,updated_at',
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
      modelName: data.model_name,
      generatedAt: data.report_v2_generated_at ?? data.updated_at,
      updatedAt: data.updated_at,
    },
    migrationMissing: false,
  };
}

export async function savePersonalReportV2(
  supabase: SupabaseClient,
  args: {
    userId: string;
    reportV2: PersonalReportV2;
    evaluation: ProfileEvaluation;
    inputHash: string;
    engineVersion: string;
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
