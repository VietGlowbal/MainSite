import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getScholarshipQueries } from '@/features/scholarships/api';
import { getUniversityQueries } from '@/features/universities/api';
import { formatTuitionForCard, officialWebsite } from '@/features/universities/domain';
import { createClient } from '@/lib/supabase/server';
import type { CourseApplication } from '@/lib/apply-types';
import { ApplicationProgressClient } from './application-progress-client';
import type { SavedRow, ScholarshipOption } from './saved-list-section';

/**
 * /apply — "Application Progress", Figma 562:15078 ("Trang lưu") on the
 * authoritative "Khanh Linh - Chi" canvas.
 *
 * ONE PAGE FROM TWO. This route was the applications tracker (337:18767) and
 * /my-universities was the saved list (375:12701); 562:15078 draws them stacked
 * on one screen, tracker first. /my-universities now 308s here — see
 * next.config.ts for why the redirect is an exact match and not a prefix.
 *
 * The merge is not only layout. Nothing on the saved list used to CREATE an
 * application — its "Lên kế hoạch ứng tuyển" was a bare link to this page. Now
 * it posts the saved row's programme URL to /api/applications/from-course-url
 * and the page scrolls up to the new row. See `planApplications` in the client.
 *
 * Auth: this page gates itself below rather than through src/proxy.ts, because
 * ?openCourseSearch=true has to stay reachable signed-out — /scholarships
 * funnels students straight into the course search. proxy.ts does apply the
 * onboarding gate to this path.
 */

export const metadata: Metadata = {
  title: 'Application Progress | GlowBal',
  description:
    'The courses you are applying to, how far along each one is, and the universities you have saved.',
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
 * Crests for the tracker row's avatar slot (Figma 562:15468).
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

/**
 * The saved list — moved here verbatim from my-universities/page.tsx.
 *
 * `select('*')` rather than a column list, and that is deliberate.
 *
 * `program` / `program_url` (supabase-saved-program.sql) back the "Ngành …"
 * line, the re-pick link and — since the merge — the course URL that "Plan my
 * application" posts. Naming them explicitly would make this read fail
 * outright, with the whole saved list rather than just the subject, on any
 * project where that file has not been run yet. A star select returns whatever
 * the table actually has, and the two fields are then read as optional below.
 * The table is ten narrow columns, so there is nothing to save by listing them.
 */
async function fetchSavedRows(userId: string): Promise<SavedRow[]> {
  const supabase = await createClient();

  const { data: savedRows, error: savedError } = await supabase
    .from('user_universities')
    .select('*')
    .eq('user_id', userId)
    .order('added_at', { ascending: false });

  /*
   * A failed read and an empty list render identically — an empty saved list —
   * so the error has to be logged or the page lies about the student having
   * saved nothing. Logging mirrors what the feature repositories already do.
   */
  if (savedError) {
    console.error('apply: reading user_universities failed:', savedError.message);
  }

  const saved = (savedRows ?? []) as Array<{
    id: number;
    university_id: number;
    added_at: string | null;
    /** Absent until supabase-saved-program.sql has been applied. */
    program?: string | null;
    program_url?: string | null;
  }>;
  const universityIds = saved.map((row) => row.university_id);

  /*
   * Three reads, one round trip each:
   *   - the universities themselves, hydrated from the saved ids
   *   - the scholarships the user has already attached to them
   *     (user_scholarships.university_id is what makes that link possible)
   *   - every scholarship linked to those universities, which is what the
   *     "Apply scholarship" picker chooses from
   */
  const [universities, savedScholarshipRows, linkedScholarships] = await Promise.all([
    getUniversityQueries().getByIds(universityIds),
    universityIds.length > 0
      ? supabase
          .from('user_scholarships')
          .select('id, scholarship_id, university_id')
          .eq('user_id', userId)
          .in('university_id', universityIds)
      : Promise.resolve({ data: [] }),
    getScholarshipQueries().byUniversityIds(universityIds),
  ]);

  const savedScholarships = (savedScholarshipRows.data ?? []) as Array<{
    id: number;
    scholarship_id: number;
    university_id: number | null;
  }>;
  const labels = await getScholarshipQueries().byIds(
    savedScholarships.map((row) => row.scholarship_id),
  );

  const byId = new Map(universities.map((uni) => [uni.id, uni]));

  // getByIds returns rows in whatever order the database hands back, so the
  // saved order (newest first) is reapplied here rather than lost.
  return saved.flatMap((row) => {
    const uni = byId.get(row.university_id);
    if (!uni) return [];

    const attached = savedScholarships
      .filter((s) => s.university_id === row.university_id)
      .flatMap((s) => {
        const label = labels.get(s.scholarship_id);
        return label
          ? [{ savedId: s.id, id: label.id, name: label.name, amountLabel: label.amountLabel }]
          : [];
      });

    const options: ScholarshipOption[] = (linkedScholarships.get(row.university_id) ?? []).map(
      (s) => ({
        id: s.id,
        name: s.name,
        amountLabel: s.amountLabel,
        deadlineLabel: s.deadlineLabel,
        coverage: s.coverage,
        /* What the discount maths reads — `bestCoveragePercent` on the bar and
           `computeNetTuition` on the row. Carried on the option rather than on
           `attached`, because `byIds` (which builds `attached`) has no coverage
           in its projection and the same awards appear on both sides. */
        fundingType: s.fundingType,
        amountMin: s.amountMin,
        amountMax: s.amountMax,
        amountCurrency: s.amountCurrency,
        // The detail panel's fields — Figma 375:13369.
        scope: s.scope,
        eligibility: s.eligibility,
        conditions: s.conditions,
        insight: s.insight,
        appliesToText: s.appliesToText,
        sourceUrl: s.sourceUrl,
      }),
    );

    return [
      {
        id: row.id,
        universityId: row.university_id,
        name: uni.name,
        country: uni.country,
        type: uni.type ?? null,
        qsRank: uni.qs_rank ?? null,
        theRank: uni.the_rank ?? null,
        deadline: uni.application_deadline ?? null,
        summary: uni.best_for ?? uni.strengths ?? null,
        imageUrl: uni.image_url ?? null,
        logoUrl: uni.logo_url ?? null,
        website: officialWebsite(uni.name),
        /* The frame's rose badge (562:15117). `tuition_usd` is editorial prose,
           not a number — "32,000–44,000 (intl UG, Medicine higher)" — so it goes
           through the same formatter the university cards use, and the full
           string stays reachable as a title attribute. */
        tuition: formatTuitionForCard(uni.tuition_usd),
        tuitionRaw: uni.tuition_usd ?? null,
        program: row.program ?? null,
        programUrl: row.program_url ?? null,
        attached,
        options,
      },
    ];
  });
}

type Props = {
  // ?universityId=<id>&openCourseSearch=true — /scholarships links here to open
  // the course search straight onto a university.
  // ?planFor=<universityId> — the return trip from /my-universities/program,
  // consumed once by the client.
  searchParams: Promise<{
    universityId?: string;
    openCourseSearch?: string;
    planFor?: string;
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
      <ApplicationProgressClient
        applications={[]}
        logoByUniversityId={{}}
        savedRows={[]}
        courseSearchUniversity={await fetchCourseSearchUniversity(courseSearchUniversityId)}
        openCourseSearch={openCourseSearch}
        isLoggedOut
      />
    );
  }

  const applications = await fetchApplications(user.id);
  const [logoByUniversityId, courseSearchUniversity, savedRows] = await Promise.all([
    fetchLogos(applications),
    fetchCourseSearchUniversity(courseSearchUniversityId),
    fetchSavedRows(user.id),
  ]);

  const userName =
    (user.user_metadata?.full_name as string | undefined) || user.email?.split('@')[0] || null;
  const userAvatarUrl = (user.user_metadata?.avatar_url as string | undefined) ?? null;

  return (
    <ApplicationProgressClient
      applications={applications}
      logoByUniversityId={logoByUniversityId}
      savedRows={savedRows}
      userName={userName}
      userAvatarUrl={userAvatarUrl}
      courseSearchUniversity={courseSearchUniversity}
      openCourseSearch={openCourseSearch}
    />
  );
}
