import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getScholarshipQueries } from '@/features/scholarships/api';
import { getUniversityQueries } from '@/features/universities/api';
import { formatTuitionForCard, officialWebsite } from '@/features/universities/domain';
import { formatAmount } from '@/lib/scholarships-data';
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
 * application — its "Lên kế hoạch ứng tuyển" was a bare link to this page. It
 * now posts to /api/applications/from-saved-university and the page scrolls up
 * to the new row. See `planApplications` in the client.
 *
 * ⚠️ AND IT IS THE ONLY WAY IN (01/08). The paste-a-course-URL bar and the
 * course-search modal are gone. That removed this page's whole reason for
 * gating itself in the body rather than in src/proxy.ts — the gate was
 * conditional so `?openCourseSearch=true` could stay reachable signed-out. The
 * redirect below is now unconditional; proxy.ts still applies the onboarding
 * gate to this path.
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
    .select('id, user_id, university_id, university_name, course_name, course_url, country, deadline, status, progress_percentage, parse_status, parse_error, import_status, strategy_intro_seen_at, created_at, updated_at')
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
    country: app.country,
    deadline: app.deadline,
    status: app.status,
    progressPercentage: app.progress_percentage,
    parseStatus: app.parse_status,
    parseError: app.parse_error,
    importStatus: app.import_status,
    strategyIntroSeenAt: app.strategy_intro_seen_at ?? null,
    createdAt: app.created_at,
    updatedAt: app.updated_at,
  })) as CourseApplication[];
}

/**
 * Which applications have a finished strategy, so the tracker rows can link
 * straight into the planner instead of only offering "continue applying".
 *
 * ─── TWO QUERIES FOR THE WHOLE PAGE, NOT TWO PER ROW ─────────────────────────
 *
 * `nextOnboardingStep` needs three facts: the student's profile flags (one row,
 * shared by every application), whether an analysis exists for this application,
 * and whether the intro has been seen. The first is read once and the second in
 * a single `in (...)` across every id; the third is already on the
 * `course_applications` rows this page has. Calling `fetchOnboardingState` per
 * application would have been N round trips to render a list.
 *
 * ─── WHY THE ROWS NEED IT AT ALL ─────────────────────────────────────────────
 *
 * `strategy/dashboard` redirects back into onboarding until every step is done.
 * A "Calendar" link on a row that has not been analysed yet would bounce the
 * student into a form — which is the funnel this navigation work exists to
 * remove. Rows without a strategy get one honest link that starts it instead.
 */
async function fetchStrategyReadiness(
  userId: string,
  applications: CourseApplication[],
): Promise<Record<string, boolean>> {
  if (applications.length === 0) return {};

  const supabase = await createClient();
  const ids = applications.map((app) => app.id);

  const [{ data: profile }, { data: analyses }] = await Promise.all([
    supabase
      .from('student_profiles')
      .select('personal_summary_completed_at, achievements_completed_at')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase.from('applicant_analyses').select('application_id').in('application_id', ids),
  ]);

  const analysed = new Set((analyses ?? []).map((row) => String(row.application_id)));
  const profileDone = Boolean(
    profile?.personal_summary_completed_at && profile?.achievements_completed_at,
  );

  const readiness: Record<string, boolean> = {};
  for (const app of applications) {
    readiness[app.id] = profileDone && analysed.has(app.id) && Boolean(app.strategyIntroSeenAt);
  }
  return readiness;
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
          .select('id, university_id, scholarships(id, name, amount_min, amount_max, amount_currency)')
          .eq('user_id', userId)
          .in('university_id', universityIds)
      : Promise.resolve({ data: [] }),
    getScholarshipQueries().byUniversityIds(universityIds),
  ]);

  const savedScholarships = (savedScholarshipRows.data ?? []) as Array<{
    id: number;
    university_id: number | null;
    scholarships:
      | {
          id: number;
          name: string;
          amount_min: number | null;
          amount_max: number | null;
          amount_currency: string | null;
        }
      | Array<{
          id: number;
          name: string;
          amount_min: number | null;
          amount_max: number | null;
          amount_currency: string | null;
        }>
      | null;
  }>;

  const byId = new Map(universities.map((uni) => [uni.id, uni]));

  // getByIds returns rows in whatever order the database hands back, so the
  // saved order (newest first) is reapplied here rather than lost.
  return saved.flatMap((row) => {
    const uni = byId.get(row.university_id);
    if (!uni) return [];

    const attached = savedScholarships
      .filter((s) => s.university_id === row.university_id)
      .flatMap((s) => {
        const label = Array.isArray(s.scholarships) ? s.scholarships[0] : s.scholarships;
        return label
          ? [{
              savedId: s.id,
              id: label.id,
              name: label.name,
              amountLabel: formatAmount(label.amount_min, label.amount_max, label.amount_currency),
            }]
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
  /*
   * ?planFor=<universityId> — the return trip from /my-universities/program.
   * ?focus=<universityId>   — /scholarships sends the student here pointed at
   *                           the university they just attached an award to.
   *
   * Both are read by the client and stripped from the URL once consumed, so
   * neither is declared here beyond the type. `?universityId` +
   * `?openCourseSearch` are gone with the course-search modal — see the header.
   */
  searchParams: Promise<{
    planFor?: string;
    focus?: string;
  }>;
};

export default async function ApplyPage({ searchParams }: Props) {
  // Awaited but not read: the params above belong to the client component,
  // which takes them from useSearchParams. Awaiting keeps this a dynamic render
  // rather than one Next.js may try to cache across students.
  await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  /*
   * Signing in is now required outright. It used to be conditional, because
   * ?openCourseSearch had to stay reachable signed-out for the /scholarships
   * funnel; that entry point is gone, and every remaining thing on this page is
   * the student's own data.
   */
  if (!user) {
    redirect('/auth?redirect=%2Fapply');
  }

  const applicationsPromise = fetchApplications(user.id);
  const savedRowsPromise = fetchSavedRows(user.id);
  const applications = await applicationsPromise;
  const [savedRows, logoByUniversityId, strategyReadyById] = await Promise.all([
    savedRowsPromise,
    fetchLogos(applications),
    fetchStrategyReadiness(user.id, applications),
  ]);

  const userName =
    (user.user_metadata?.full_name as string | undefined) || user.email?.split('@')[0] || null;
  const userAvatarUrl = (user.user_metadata?.avatar_url as string | undefined) ?? null;

  return (
    <ApplicationProgressClient
      applications={applications}
      logoByUniversityId={logoByUniversityId}
      savedRows={savedRows}
      strategyReadyById={strategyReadyById}
      userName={userName}
      userAvatarUrl={userAvatarUrl}
    />
  );
}
