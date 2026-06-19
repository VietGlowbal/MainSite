import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ApplyDashboard } from './apply-dashboard';
import { JourneySteps } from '@/components/JourneySteps';
import { getPublishedScholarships } from '@/lib/scholarships-data';
import { COUNTRY_FLAGS } from '@/app/universities/explorer-constants';
import type {
  CourseApplication,
  ApplicationOverview,
  ShortlistedUniversity,
  UpcomingDeadline,
  SavedScholarshipLite,
} from '@/lib/apply-types';

// Statuses that mean an application is no longer "active" — used to decide
// which saved universities still belong in the Shortlisted section.
const INACTIVE_STATUSES = ['submitted', 'offer_received', 'accepted', 'rejected', 'withdrawn', 'archived'];

/**
 * Saved scholarships (user_scholarships) grouped by the university they were
 * saved under, so the dashboard can nest them under the matching application or
 * shortlisted university. Reuses getPublishedScholarships() for display labels.
 */
async function fetchSavedScholarshipsByUniversity(userId: string): Promise<Record<number, SavedScholarshipLite[]>> {
  const supabase = await createClient();
  const [{ data: savedRows }, published] = await Promise.all([
    supabase.from('user_scholarships').select('id, scholarship_id, university_id').eq('user_id', userId),
    getPublishedScholarships(),
  ]);
  const byId = new Map(published.map((s) => [s.id, s]));
  const grouped: Record<number, SavedScholarshipLite[]> = {};
  for (const row of savedRows ?? []) {
    const s = byId.get(row.scholarship_id as number);
    if (!s || row.university_id == null) continue;
    (grouped[row.university_id as number] ??= []).push({
      id: row.id as number,
      scholarshipId: s.id,
      name: s.name,
      scope: s.scope,
      amountLabel: s.amountLabel,
      deadlineLabel: s.deadlineLabel,
      sourceUrl: s.source_url,
      universityId: row.university_id as number,
    });
  }
  return grouped;
}

/** Latest CV-vs-requirements match score per application (for the score ring). */
async function fetchMatchScores(applicationIds: string[]): Promise<Record<string, number>> {
  if (applicationIds.length === 0) return {};
  const supabase = await createClient();
  const { data } = await supabase
    .from('application_match_analyses')
    .select('application_id, current_match_score, created_at')
    .in('application_id', applicationIds)
    .eq('analysis_status', 'complete')
    .order('created_at', { ascending: false });
  const map: Record<string, number> = {};
  for (const row of data ?? []) {
    const id = row.application_id as string;
    if (!(id in map) && row.current_match_score != null) map[id] = row.current_match_score as number;
  }
  return map;
}

/** Saved universities with no active application yet → Shortlisted section. */
async function fetchShortlisted(
  userId: string,
  applications: CourseApplication[],
): Promise<ShortlistedUniversity[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('user_universities')
    .select('university_id, universities(id, name, country)')
    .eq('user_id', userId);

  const activeUniIds = new Set(
    applications.filter((a) => !INACTIVE_STATUSES.includes(a.status)).map((a) => a.universityId).filter(Boolean),
  );

  const out: ShortlistedUniversity[] = [];
  for (const row of data ?? []) {
    const uni = Array.isArray(row.universities) ? row.universities[0] : row.universities;
    if (!uni || activeUniIds.has(row.university_id)) continue;
    out.push({
      id: String(row.university_id),
      universityName: uni.name,
      country: uni.country ?? undefined,
      countryFlag: uni.country ? COUNTRY_FLAGS[uni.country] : undefined,
    });
  }
  return out;
}

async function fetchApplications(userId: string): Promise<CourseApplication[]> {
  const supabase = await createClient();
  
  const { data: applications, error } = await supabase
    .from('course_applications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching applications:', error);
    return [];
  }
  
  return applications.map(app => ({
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
    applicationMethod: app.application_method,
    applicationCode: app.application_code,
    deadline: app.deadline,
    status: app.status,
    progressPercentage: app.progress_percentage,
    imageUrl: app.image_url,
    nextAction: app.next_action,
    importStatus: app.import_status,
    createdAt: app.created_at,
    updatedAt: app.updated_at,
  }));
}

async function calculateOverview(applications: CourseApplication[]): Promise<ApplicationOverview> {
  const supabase = await createClient();
  
  const activeApplications = applications.filter(app => 
    ['course_imported', 'plan_generated', 'preparing', 'ready_to_submit'].includes(app.status)
  ).length;
  
  const submitted = applications.filter(app => 
    ['submitted', 'interview'].includes(app.status)
  ).length;
  
  const offersReceived = applications.filter(app => 
    app.status === 'offer_received'
  ).length;
  
  // Fetch all tasks for these applications
  const applicationIds = applications.map(app => app.id);
  
  if (applicationIds.length === 0) {
    return {
      activeApplications: 0,
      submitted: 0,
      offersReceived: 0,
      tasksCompleted: 0,
      totalTasks: 0,
    };
  }
  
  const { data: tasks } = await supabase
    .from('application_tasks')
    .select('status')
    .in('application_id', applicationIds);
  
  const tasksCompleted = tasks?.filter(t => t.status === 'completed').length || 0;
  const totalTasks = tasks?.length || 0;
  
  return {
    activeApplications,
    submitted,
    offersReceived,
    tasksCompleted,
    totalTasks,
  };
}

function calculateUpcomingDeadlines(applications: CourseApplication[]): UpcomingDeadline[] {
  const now = new Date();
  
  return applications
    .filter(app => app.deadline)
    .map(app => {
      const deadlineDate = new Date(app.deadline!);
      const diffTime = deadlineDate.getTime() - now.getTime();
      const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      return {
        date: app.deadline!,
        label: app.applicationMethod ? `${app.applicationMethod} deadline` : 'Application deadline',
        universityName: app.universityName,
        applicationId: app.id,
        daysLeft,
      };
    })
    .filter(d => d.daysLeft > 0)
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 5);
}

type Props = {
  // ?focus=<universityId> — set when arriving from the scholarships "Continue
  // to Apply" flow, to highlight the application/uni the student funneled toward.
  searchParams: Promise<{ focus?: string }>;
};

export default async function ApplyPage({ searchParams }: Props) {
  const params = await searchParams;
  const parsedFocus = params.focus ? Number.parseInt(params.focus, 10) : NaN;
  const focusUniversityId = Number.isFinite(parsedFocus) ? parsedFocus : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/auth');

  const applications = await fetchApplications(user.id);
  const [overview, savedScholarshipsByUniversity, matchByApplicationId, shortlisted] = await Promise.all([
    calculateOverview(applications),
    fetchSavedScholarshipsByUniversity(user.id),
    fetchMatchScores(applications.map((a) => a.id)),
    fetchShortlisted(user.id, applications),
  ]);
  const upcomingDeadlines = calculateUpcomingDeadlines(applications);

  return (
    <main className="min-h-screen bg-transparent px-4 py-6 md:px-8 md:py-8">
      <div className="w-full">
        <JourneySteps activeStep={3} />
        <ApplyDashboard
          applications={applications}
          shortlisted={shortlisted}
          upcomingDeadlines={upcomingDeadlines}
          overview={overview}
          savedScholarshipsByUniversity={savedScholarshipsByUniversity}
          matchByApplicationId={matchByApplicationId}
          focusUniversityId={focusUniversityId}
        />
      </div>
    </main>
  );
}
