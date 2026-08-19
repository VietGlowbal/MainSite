import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getScholarshipQueries } from '@/features/scholarships/api';
import {
  formatDeadlineLabel,
  formatTuitionForCard,
  officialWebsite,
} from '@/features/universities/domain';
import { formatAmount } from '@/lib/scholarships-data';
import { createClient } from '@/lib/supabase/server';
import { getServerIdentity } from '@/server/auth/server-identity';
import { isPlusEntitlementActive } from '@/lib/entitlements/entitlement-service';
import type { CourseApplication } from '@/lib/apply-types';
import type {
  ApplicationScholarship,
  UniversityScholarships,
} from './application-scholarships';
import { ApplicationProgressClient } from './application-progress-client';
import { ApplyShell } from './apply-shell';
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
  title: 'Application Tracker & Saved Universities',
  description:
    'Track your course application progress, deadlines, and manage saved universities all in one place.',
  alternates: {
    canonical: '/apply',
  },
};

async function fetchApplications(userId: string): Promise<CourseApplication[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('course_applications')
    .select('id, user_id, university_id, university_name, course_name, course_url, country, deadline, status, progress_percentage, parse_status, parse_error, import_status, strategy_intro_seen_at, created_at, updated_at, university:universities(logo_url)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('apply: reading course_applications failed:', error.message);
    return [];
  }

  return (data ?? []).map((app) => {
    const university = Array.isArray(app.university) ? app.university[0] : app.university;
    return {
      id: app.id,
      userId: app.user_id,
      universityId: app.university_id,
      universityName: app.university_name,
      logoUrl: university?.logo_url ?? null,
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
    };
  }) as CourseApplication[];
}

/**
 * Which applications have a finished strategy, so the tracker rows can link
 * straight into the planner instead of only offering "continue applying".
 *
 * ─── TWO QUERIES FOR THE WHOLE PAGE, NOT TWO PER ROW ─────────────────────────
 *
 * `nextOnboardingStep` needs three facts: whether THIS application's
 * reflections/achievements have been reviewed (per-application — see
 * `supabase-per-application-onboarding.sql`; a shared `student_profiles` flag
 * would incorrectly mark a brand-new application "ready" the moment ANY
 * other application had been reviewed), whether an analysis exists for this
 * application, and whether the intro has been seen. The first two are read
 * once each in a single `in (...)` across every id; the third is already on
 * the `course_applications` rows this page has. Calling `fetchOnboardingState`
 * per application would have been N round trips to render a list.
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
  applicationsPromise: Promise<CourseApplication[]>,
): Promise<Record<string, boolean>> {
  const supabase = await createClient();
  // Filtered by `user_id`, not by application id, so — unlike the
  // per-application review read below — this does not need to wait for
  // `applicationsPromise` to resolve. Started immediately to keep the same
  // "independent reads run in parallel, not serialized behind
  // `course_applications`" property the original single-profile-row version
  // of this function had.
  const analysesPromise = supabase
    .from('applicant_analyses')
    .select('application_id')
    .eq('user_id', userId)
    // Supabase's query builder does not fire the request until it is
    // awaited/`.then()`ed — appending `.then()` here starts it immediately
    // rather than leaving it to fire only once `Promise.all` below reaches
    // it, which by then would be AFTER `applicationsPromise` resolves.
    .then((result) => result);

  const applications = await applicationsPromise;
  if (applications.length === 0) return {};

  const ids = applications.map((app) => app.id);
  // Same PostgREST-fails-the-whole-select-on-one-unknown-column caveat as
  // every other tolerant read in this project — a missing migration degrades
  // to "not reviewed" for every row (the safe default: a slightly stale
  // "continue applying" label, never a false "ready").
  const reviewedPromise = supabase
    .from('course_applications')
    .select('id, personal_summary_reviewed_at, achievements_reviewed_at')
    .in('id', ids)
    .then((result) => result);
  const [{ data: analyses }, reviewed] = await Promise.all([analysesPromise, reviewedPromise]);

  const analysed = new Set((analyses ?? []).map((row) => String(row.application_id)));

  if (reviewed.error) {
    console.warn(
      'apply: could not read per-application review columns — run supabase-per-application-onboarding.sql.',
      reviewed.error.message,
    );
  }
  const reviewedById = new Map(
    (reviewed.error ? [] : (reviewed.data ?? [])).map((row) => [
      String(row.id),
      Boolean(row.personal_summary_reviewed_at && row.achievements_reviewed_at),
    ]),
  );

  const readiness: Record<string, boolean> = {};
  for (const app of applications) {
    readiness[app.id] =
      (reviewedById.get(app.id) ?? false) && analysed.has(app.id) && Boolean(app.strategyIntroSeenAt);
  }
  return readiness;
}

/**
 * The scholarships behind each application row's drawer — added 18/08.
 *
 * WHY THE TRACKER READS THIS ITSELF instead of taking it off `fetchSavedRows`,
 * which already joins the same table: those rows are streamed into a Suspense
 * boundary and arrive after the tracker has rendered, and — more decisively —
 * they only cover universities that are still ON the saved list. An application
 * outlives the saved row it was planned from (removing a university does not
 * delete its application), so hanging the drawer off the saved list would blank
 * it for exactly the students furthest along.
 *
 * TWO READS, ONE ROUND TRIP EACH, FOR THE WHOLE LIST:
 *
 *   1. `user_scholarships` joined to `scholarships` — what the student chose.
 *      The join, rather than `byIds`, because it is one trip and this page
 *      already makes the identical call in `fetchSavedRows`.
 *   2. `byUniversityIds` — everything the directory offers at those
 *      universities, which is what the drawer's picker chooses from.
 *
 * ⚠️ THE TWO SETS OVERLAP BUT NEITHER CONTAINS THE OTHER. Measured live on
 * 18/08: 39 of the 84 saved awards point at a scholarship that is not linked to
 * the university it was saved under (the directory's `scholarship_universities`
 * rows have moved since, or the award was saved from a country-wide listing).
 * So `chosen` cannot be derived by filtering `options`, and the drawer unions
 * the two rather than dropping a student's own choice on the floor.
 */
async function fetchApplicationScholarships(
  userId: string,
  applicationsPromise: Promise<CourseApplication[]>,
): Promise<Record<number, UniversityScholarships>> {
  const supabase = await createClient();

  /*
   * Filtered by user, not by university, so it does not have to wait for the
   * applications to resolve — same `.then()` trick as `fetchStrategyReadiness`,
   * which fires the request now rather than when `Promise.all` reaches it.
   */
  const savedPromise = supabase
    .from('user_scholarships')
    .select(
      'scholarship_id, university_id, scholarships(id, name, scope, amount_min, amount_max, amount_currency, coverage, funding_type, deadline_date, deadline_text, source_url)',
    )
    .eq('user_id', userId)
    .then((result) => result);

  const applications = await applicationsPromise;
  const universityIds = [
    ...new Set(
      applications.flatMap((app) => (app.universityId != null ? [app.universityId] : [])),
    ),
  ];
  if (universityIds.length === 0) {
    // Still await the in-flight read so it is not left dangling.
    await savedPromise;
    return {};
  }

  const [saved, optionsByUniversity] = await Promise.all([
    savedPromise,
    getScholarshipQueries().byUniversityIds(universityIds),
  ]);

  if (saved.error) {
    // An empty drawer and a failed read look identical on screen, so say which
    // one happened — the same reason `fetchSavedRows` logs its failure.
    console.error('apply: reading user_scholarships failed:', saved.error.message);
  }

  type SavedScholarshipRow = {
    university_id: number | null;
    scholarships:
      | {
          id: number;
          name: string;
          scope: string | null;
          amount_min: number | null;
          amount_max: number | null;
          amount_currency: string | null;
          coverage: string | null;
          funding_type: string[] | null;
          deadline_date: string | null;
          deadline_text: string | null;
          source_url: string | null;
        }
      | null;
  };

  const wanted = new Set(universityIds);
  const chosenByUniversity = new Map<number, ApplicationScholarship[]>();

  for (const row of (saved.error ? [] : (saved.data ?? [])) as unknown as SavedScholarshipRow[]) {
    const universityId = row.university_id;
    if (universityId == null || !wanted.has(universityId)) continue;
    // PostgREST returns an embedded one-to-one as an object, but the generated
    // types widen it to an array on some versions — normalise both.
    const s = Array.isArray(row.scholarships) ? row.scholarships[0] : row.scholarships;
    if (!s) continue;

    const entry: ApplicationScholarship = {
      id: s.id,
      name: s.name,
      scope: s.scope,
      amountLabel: formatAmount(s.amount_min, s.amount_max, s.amount_currency),
      /* `deadline_date` is an ISO date and `deadline_text` is free prose;
         `formatDeadlineLabel` handles both and leaves prose it cannot parse
         alone, which is what the scholarship repository does with the pair. */
      deadlineLabel: formatDeadlineLabel(s.deadline_date ?? s.deadline_text),
      coverage: s.coverage,
      fundingType: s.funding_type,
      sourceUrl: s.source_url,
    };

    const bucket = chosenByUniversity.get(universityId);
    if (bucket) bucket.push(entry);
    else chosenByUniversity.set(universityId, [entry]);
  }

  const byUniversity: Record<number, UniversityScholarships> = {};
  for (const universityId of universityIds) {
    byUniversity[universityId] = {
      chosen: chosenByUniversity.get(universityId) ?? [],
      options: (optionsByUniversity.get(universityId) ?? []).map((option) => ({
        id: option.id,
        name: option.name,
        scope: option.scope,
        amountLabel: option.amountLabel,
        deadlineLabel: option.deadlineLabel,
        coverage: option.coverage,
        fundingType: option.fundingType,
        sourceUrl: option.sourceUrl,
      })),
    };
  }
  return byUniversity;
}

/**
 * Crests for the tracker row's avatar slot (Figma 562:15468).
 *
 * `fetchApplications` joins the crest through the nullable university_id, so
 * the tracker builds this map without a second universities round trip.
 * Unresolved course imports still fall back to initials in `Avatar`.
 */
function applicationLogos(applications: CourseApplication[]): Record<number, string | null> {
  const map: Record<number, string | null> = {};
  for (const app of applications) {
    if (app.universityId != null) map[app.universityId] = app.logoUrl ?? null;
  }
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

  const savedRowsPromise = supabase
    .from('user_universities')
    .select('*, universities(id, name, country, type, qs_rank, the_rank, application_deadline, best_for, strengths, image_url, logo_url, tuition_usd)')
    .eq('user_id', userId)
    .order('added_at', { ascending: false });
  const savedScholarshipRowsPromise = supabase
    .from('user_scholarships')
    .select('id, university_id, scholarships(id, name, amount_min, amount_max, amount_currency)')
    .eq('user_id', userId);
  const [
    { data: savedRows, error: savedError },
    { data: savedScholarshipData },
  ] = await Promise.all([savedRowsPromise, savedScholarshipRowsPromise]);

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
    universities:
      | {
          id: number;
          name: string;
          country: string;
          type: string | null;
          qs_rank: number | null;
          the_rank: number | null;
          application_deadline: string | null;
          best_for: string | null;
          strengths: string | null;
          image_url: string | null;
          logo_url: string | null;
          tuition_usd: string | null;
        }
      | Array<{
          id: number;
          name: string;
          country: string;
          type: string | null;
          qs_rank: number | null;
          the_rank: number | null;
          application_deadline: string | null;
          best_for: string | null;
          strengths: string | null;
          image_url: string | null;
          logo_url: string | null;
          tuition_usd: string | null;
        }>
      | null;
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
  const linkedScholarships = await getScholarshipQueries().byUniversityIds(universityIds);

  const savedScholarships = (savedScholarshipData ?? []) as Array<{
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

  // getByIds returns rows in whatever order the database hands back, so the
  // saved order (newest first) is reapplied here rather than lost.
  return saved.flatMap((row) => {
    const uni = Array.isArray(row.universities) ? row.universities[0] : row.universities;
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

  const { identity: user } = await getServerIdentity();

  /*
   * Signing in is now required outright. It used to be conditional, because
   * ?openCourseSearch had to stay reachable signed-out for the /scholarships
   * funnel; that entry point is gone, and every remaining thing on this page is
   * the student's own data.
   */
  if (!user) {
    redirect('/auth?redirect=%2Fapply');
  }

  const supabase = await createClient();
  const applicationsPromise = fetchApplications(user.id);
  const savedRowsPromise = fetchSavedRows(user.id);
  const strategyReadyPromise = fetchStrategyReadiness(user.id, applicationsPromise);
  const scholarshipsPromise = fetchApplicationScholarships(user.id, applicationsPromise);
  const profilePromise = supabase
    .from('student_profiles')
    .select('plus_status, plus_expires_at, is_admin')
    .eq('user_id', user.id)
    .maybeSingle();

  const [applications, strategyReadyById, scholarshipsByUniversityId, profileResult] =
    await Promise.all([
      applicationsPromise,
      strategyReadyPromise,
      scholarshipsPromise,
      profilePromise,
    ]);

  const isPlus = isPlusEntitlementActive(profileResult.data ?? {});
  const logoByUniversityId = applicationLogos(applications);

  return (
    <ApplyShell userName={user.name} userAvatarUrl={user.avatarUrl}>
      <ApplicationProgressClient
        applications={applications}
        logoByUniversityId={logoByUniversityId}
        savedRowsPromise={savedRowsPromise}
        strategyReadyById={strategyReadyById}
        scholarshipsByUniversityId={scholarshipsByUniversityId}
        isPlus={isPlus}
      />
    </ApplyShell>
  );
}
