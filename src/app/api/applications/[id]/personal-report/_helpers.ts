import type { SupabaseClient } from '@supabase/supabase-js';

export type OwnedPersonalReportApplication = {
  id: string;
  candidate_confirmed_at: string | null;
};

export async function loadOwnedPersonalReportApplication(
  supabase: SupabaseClient,
  userId: string,
  applicationId: string,
): Promise<{
  data: OwnedPersonalReportApplication | null;
  error: { code?: string; message?: string } | null;
}> {
  const { data, error } = await supabase
    .from('course_applications')
    .select('id,candidate_confirmed_at')
    .eq('id', applicationId)
    .eq('user_id', userId)
    .maybeSingle();
  return { data: data as OwnedPersonalReportApplication | null, error };
}

export function isPersonalReportMigrationMissing(error: { code?: string; message?: string } | null | undefined) {
  return Boolean(
    error &&
      (['42P01', '42703', 'PGRST204', 'PGRST205'].includes(error.code ?? '') ||
        /application_personal_report|application_profile_analysis|confirmed_candidate_snapshots|student_personal_report_versions/i.test(
          error.message ?? '',
        )),
  );
}

export async function loadLatestApplicationSnapshot(
  supabase: SupabaseClient,
  userId: string,
  applicationId: string,
): Promise<{
  data: { id: string; confirmed_at: string | null } | null;
  error: { code?: string; message?: string } | null;
}> {
  const { data, error } = await supabase
    .from('confirmed_candidate_snapshots')
    .select('id,confirmed_at')
    .eq('user_id', userId)
    .eq('application_id', applicationId)
    .order('confirmed_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return { data: data as { id: string; confirmed_at: string | null } | null, error };
}
