import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Append-only persistence for application-scoped analysis versions (Task 5
 * Step 6). Rows record the full lineage: application, snapshot, input hash,
 * module versions, structured outputs, generation metadata.
 *
 * Tolerant of `supabase-application-personal-report-state.sql` not having run
 * yet — degrades to a flagged failure instead of throwing, mirroring every
 * other repository in this feature.
 */

function isMigrationMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === '42P01' ||
    error.code === '42703' ||
    error.code === 'PGRST204' ||
    error.code === 'PGRST205'
  );
}

export type ApplicationProfileAnalysisWrite = {
  userId: string;
  applicationId: string;
  confirmedSnapshotId: string;
  inputHash: string;
  moduleVersions: Record<string, string>;
  structuredOutputs: Record<string, unknown>;
  evidenceBank?: unknown;
  generationMetadata?: Record<string, unknown>;
};

export async function saveApplicationProfileAnalysis(
  supabase: SupabaseClient,
  args: ApplicationProfileAnalysisWrite,
): Promise<{ versionId: string | null; migrationMissing: boolean }> {
  const { data, error } = await supabase
    .from('application_profile_analysis_versions')
    .insert({
      user_id: args.userId,
      application_id: args.applicationId,
      confirmed_snapshot_id: args.confirmedSnapshotId,
      input_hash: args.inputHash,
      module_versions: args.moduleVersions,
      structured_outputs: args.structuredOutputs,
      evidence_bank: args.evidenceBank ?? null,
      generation_metadata: args.generationMetadata ?? null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[application-analysis] profile analysis insert failed', error);
    return { versionId: null, migrationMissing: isMigrationMissing(error) };
  }
  return { versionId: data.id as string, migrationMissing: false };
}

export type StoredApplicationProfileAnalysis = {
  id: string;
  confirmedSnapshotId: string | null;
  inputHash: string;
  moduleVersions: Record<string, string>;
  structuredOutputs: Record<string, unknown>;
  evidenceBank: unknown;
  createdAt: string;
};

export async function getLatestApplicationProfileAnalysis(
  supabase: SupabaseClient,
  scope: { userId: string; applicationId: string },
): Promise<StoredApplicationProfileAnalysis | null> {
  const { data, error } = await supabase
    .from('application_profile_analysis_versions')
    .select(
      'id,confirmed_snapshot_id,input_hash,module_versions,structured_outputs,evidence_bank,created_at',
    )
    .eq('user_id', scope.userId)
    .eq('application_id', scope.applicationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    if (error && !isMigrationMissing(error)) {
      console.error('[application-analysis] latest analysis read failed', error);
    }
    return null;
  }
  return {
    id: data.id as string,
    confirmedSnapshotId: (data.confirmed_snapshot_id as string | null) ?? null,
    inputHash: data.input_hash as string,
    moduleVersions: (data.module_versions as Record<string, string>) ?? {},
    structuredOutputs: (data.structured_outputs as Record<string, unknown>) ?? {},
    evidenceBank: data.evidence_bank ?? null,
    createdAt: data.created_at as string,
  };
}

export async function saveApplicationAcademicAssessment(
  supabase: SupabaseClient,
  args: {
    userId: string;
    applicationId: string;
    confirmedSnapshotId: string;
    inputHash: string;
    assessment: unknown;
    moduleVersions: Record<string, string>;
    generationMetadata?: Record<string, unknown>;
  },
): Promise<{ versionId: string | null; migrationMissing: boolean }> {
  const { data, error } = await supabase
    .from('application_academic_assessment_versions')
    .insert({
      user_id: args.userId,
      application_id: args.applicationId,
      confirmed_snapshot_id: args.confirmedSnapshotId,
      input_hash: args.inputHash,
      assessment: args.assessment,
      module_versions: args.moduleVersions,
      generation_metadata: args.generationMetadata ?? null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[application-analysis] academic assessment insert failed', error);
    return { versionId: null, migrationMissing: isMigrationMissing(error) };
  }
  return { versionId: data.id as string, migrationMissing: false };
}
