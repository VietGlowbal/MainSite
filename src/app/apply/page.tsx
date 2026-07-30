import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getUniversityQueries } from '@/features/universities/api';
import { officialWebsite } from '@/features/universities/domain';
import { createClient } from '@/lib/supabase/server';
import type { CourseApplication } from '@/lib/apply-types';
import { ApplyListClient } from './apply-list-client';

/**
 * /apply — "My application", Figma 337:18767 ("Trang my apply") on the
 * "UI Final - Dev" canvas.
 *
 * That frame supersedes 224:14068 / 224:14957 on the older "Tính năng" canvas:
 * both of those are named "Trang lưu" and sit under a "My applications" banner,
 * and this one is the migrated redraw. Build against the migrated frame — the
 * saved list learned the hard way that the two canvases diverge (its own frames
 * gained two dialogs on migration).
 *
 * /apply is not /my-universities. This is the applications tracker; the saved
 * list is the shortlist of universities. They are separate destinations.
 *
 * The dashboard this replaced also rendered an overview stat card, an upcoming
 * deadlines card, mentor and profile promos, a trial banner and a shortlist
 * section. None are in the frame, so the reads that fed them are gone with them
 * (they are in git history at apply-dashboard.tsx). The shortlist read
 * `user_universities`, which does not exist on the database — see
 * docs/known-issues.md — so it rendered empty regardless.
 */

export const metadata: Metadata = {
  title: 'My application | GlowBal',
  description:
    'The courses you are applying to, how far along each one is, and what is due next.',
};

async function fetchApplications(userId: string): Promise<CourseApplication[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('course_applications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('apply: reading course_applications failed:', error.message);
    return [];
  }

  return (data ?? []).map((app) => ({
    id: app.id,
    userId: app.user_id,
    universityId: app.university_id,
    universityName: app.university_name,
    courseName: app.course_name,
    courseUrl: app.course_url,
    degreeLevel: app.degree_level,
    subject: app.subject,
    studyMode: app.study_mode,
    intake: app.intake,
    country: app.country,
    countryFlag: app.country_flag,
    deadline: app.deadline,
    status: app.status,
    progressPercentage: app.progress_percentage,
    parseStatus: app.parse_status,
    parseError: app.parse_error,
    importStatus: app.import_status,
    aiSummary: app.ai_summary,
    userNotes: app.user_notes,
    createdAt: app.created_at,
    updatedAt: app.updated_at,
  })) as CourseApplication[];
}

/**
 * Crests for the row's avatar slot (Figma 337:18792).
 *
 * course_applications has no logo column of its own — it carries a nullable
 * university_id, and most rows are imported straight from a course URL without
 * one. Only the rows that resolved to a university get a real crest; the rest
 * fall back to initials in `Avatar`.
 */
async function fetchLogos(applications: CourseApplication[]): Promise<Record<number, string | null>> {
  const ids = [...new Set(applications.flatMap((a) => (a.universityId != null ? [a.universityId] : [])))];
  if (ids.length === 0) return {};

  const universities = await getUniversityQueries().getByIds(ids);
  const map: Record<number, string | null> = {};
  for (const uni of universities) map[uni.id] = uni.logo_url ?? null;
  return map;
}

/**
 * Name + domain for the course-search modal, resolved here rather than in a
 * client effect the way the previous dashboard did it.
 *
 * There is no domain column on `universities` — the old code read
 * `primary_domain` and swallowed the error when it turned out not to exist, so
 * the modal always received ''. `officialWebsite` is the project's actual answer
 * to "where does this university live", and it is honest about partial coverage:
 * when it misses, the domain stays '' exactly as before.
 */
async function fetchCourseSearchUniversity(
  universityId: number | null,
): Promise<{ id: number; name: string; domain: string } | null> {
  if (universityId == null) return null;

  const [uni] = await getUniversityQueries().getByIds([universityId]);
  if (!uni) return null;

  const website = officialWebsite(uni.name);
  let domain = '';
  if (website) {
    try {
      domain = new URL(website).hostname;
    } catch {
      domain = '';
    }
  }
  return { id: uni.id, name: uni.name, domain };
}

type Props = {
  // ?universityId=<id>&openCourseSearch=true — /scholarships links here to open
  // the course search straight onto a university.
  searchParams: Promise<{
    universityId?: string;
    openCourseSearch?: string;
  }>;
};

export default async function ApplyPage({ searchParams }: Props) {
  const params = await searchParams;

  const parsedUniversityId = params.universityId ? Number.parseInt(params.universityId, 10) : NaN;
  const courseSearchUniversityId = Number.isFinite(parsedUniversityId) ? parsedUniversityId : null;
  const openCourseSearch = params.openCourseSearch === 'true';

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Signing in is required to track applications, but not to open the course
  // search — /scholarships funnels signed-out students straight into it.
  if (!user && !openCourseSearch) {
    redirect('/auth?redirect=%2Fapply');
  }

  if (!user) {
    return (
      <ApplyListClient
        applications={[]}
        logoByUniversityId={{}}
        courseSearchUniversity={await fetchCourseSearchUniversity(courseSearchUniversityId)}
        openCourseSearch={openCourseSearch}
        isLoggedOut
      />
    );
  }

  const applications = await fetchApplications(user.id);
  const [logoByUniversityId, courseSearchUniversity] = await Promise.all([
    fetchLogos(applications),
    fetchCourseSearchUniversity(courseSearchUniversityId),
  ]);

  const userName =
    (user.user_metadata?.full_name as string | undefined) || user.email?.split('@')[0] || null;
  const userAvatarUrl = (user.user_metadata?.avatar_url as string | undefined) ?? null;

  return (
    <ApplyListClient
      applications={applications}
      logoByUniversityId={logoByUniversityId}
      userName={userName}
      userAvatarUrl={userAvatarUrl}
      courseSearchUniversity={courseSearchUniversity}
      openCourseSearch={openCourseSearch}
    />
  );
}
