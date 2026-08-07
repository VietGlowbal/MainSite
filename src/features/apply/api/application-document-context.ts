import { createClient } from '@/server/db/server';

export type ApplicationDocumentContext = {
  id: string;
  universityId: number | null;
  universityName: string | null;
  courseName: string | null;
  parseStatus: string | null;
  aiSummary: string | null;
  entryRequirementsSummary: string | null;
};

export async function getApplicationDocumentContext(
  applicationId: string,
  userId: string,
): Promise<ApplicationDocumentContext | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('course_applications')
    .select('id, university_id, university_name, course_name, parse_status, ai_summary, courses(entry_requirements_summary)')
    .eq('id', applicationId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return null;

  const course = Array.isArray(data.courses) ? data.courses[0] : data.courses;
  return {
    id: data.id,
    universityId: data.university_id,
    universityName: data.university_name,
    courseName: data.course_name,
    parseStatus: data.parse_status,
    aiSummary: data.ai_summary,
    entryRequirementsSummary: course?.entry_requirements_summary ?? null,
  };
}
