import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ApplyDashboard } from './apply-dashboard';
import type { CourseApplication, ApplicationOverview, ShortlistedUniversity, UpcomingDeadline } from '@/lib/apply-types';

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
    tuitionFee: app.tuition_fee,
    entryRequirementsSummary: app.entry_requirements_summary,
    englishRequirementsSummary: app.english_requirements_summary,
    status: app.status,
    progressPercentage: app.progress_percentage,
    matchScore: app.match_score,
    imageUrl: app.image_url,
    logoUrl: app.logo_url,
    nextAction: app.next_action,
    sourceConfidence: app.source_confidence,
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

export default async function ApplyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/auth');

  const applications = await fetchApplications(user.id);
  const overview = await calculateOverview(applications);
  const upcomingDeadlines = calculateUpcomingDeadlines(applications);
  
  // Shortlisted universities - placeholder for now
  const shortlisted: ShortlistedUniversity[] = [];

  return (
    <main className="min-h-screen bg-transparent px-4 py-6 md:px-8 md:py-8">
      <div className="w-full">
        <ApplyDashboard
          applications={applications}
          shortlisted={shortlisted}
          upcomingDeadlines={upcomingDeadlines}
          overview={overview}
        />
      </div>
    </main>
  );
}
