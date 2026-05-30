import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ApplicationWorkspaceView } from './application-workspace';
import type { ApplicationWorkspace } from '@/lib/apply-types';

async function fetchApplicationWorkspace(applicationId: string, userId: string): Promise<ApplicationWorkspace | null> {
  const supabase = await createClient();
  
  // Fetch application
  const { data: application, error: appError } = await supabase
    .from('course_applications')
    .select('*')
    .eq('id', applicationId)
    .eq('user_id', userId)
    .single();
  
  if (appError || !application) {
    return null;
  }
  
  // Fetch stages
  const { data: stages, error: stagesError } = await supabase
    .from('application_stages')
    .select('*')
    .eq('application_id', applicationId)
    .order('order_num', { ascending: true });
  
  if (stagesError) {
    console.error('Error fetching stages:', stagesError);
    return null;
  }
  
  // Fetch all tasks
  const { data: tasks, error: tasksError } = await supabase
    .from('application_tasks')
    .select('*')
    .eq('application_id', applicationId);
  
  if (tasksError) {
    console.error('Error fetching tasks:', tasksError);
    return null;
  }
  
  // Fetch scholarships (stored as support resources)
  const { data: scholarships } = await supabase
    .from('support_resources')
    .select('*')
    .eq('application_id', applicationId)
    .eq('resource_type', 'scholarship');
  
  // Transform to frontend format
  const transformedApplication = {
    id: application.id,
    userId: application.user_id,
    universityId: application.university_id,
    universityName: application.university_name,
    courseName: application.course_name,
    courseUrl: application.course_url,
    degreeLevel: application.degree_level,
    subject: application.subject,
    studyMode: application.study_mode,
    intake: application.intake,
    country: application.country,
    countryFlag: application.country_flag,
    applicationMethod: application.application_method,
    applicationCode: application.application_code,
    deadline: application.deadline,
    tuitionFee: application.tuition_fee,
    entryRequirementsSummary: application.entry_requirements_summary,
    englishRequirementsSummary: application.english_requirements_summary,
    status: application.status,
    progressPercentage: application.progress_percentage,
    matchScore: application.match_score,
    imageUrl: application.image_url,
    logoUrl: application.logo_url,
    nextAction: application.next_action,
    sourceConfidence: application.source_confidence,
    createdAt: application.created_at,
    updatedAt: application.updated_at,
    scholarships: scholarships || [],
  };
  
  const transformedStages = stages.map(stage => {
    const stageTasks = tasks
      .filter(task => task.stage_id === stage.id)
      .map(task => ({
        id: task.id,
        applicationId: task.application_id,
        stageId: task.stage_id,
        title: task.title,
        description: task.description,
        dueDate: task.due_date,
        priority: task.priority,
        type: task.type,
        status: task.status,
        sourceUrl: task.source_url,
        supportToolType: task.support_tool_type,
        confidence: task.confidence,
        notes: task.notes,
        createdBy: task.created_by,
        createdAt: task.created_at,
        updatedAt: task.updated_at,
      }));
    
    return {
      id: stage.id,
      applicationId: stage.application_id,
      name: stage.name,
      order: stage.order_num,
      description: stage.description,
      status: stage.status,
      isRequired: stage.is_required,
      icon: stage.icon,
      tasks: stageTasks,
    };
  });
  
  // Build key facts
  const keyFacts = {
    deadline: application.deadline ? {
      value: new Date(application.deadline).toLocaleDateString('en-GB', { 
        day: 'numeric', 
        month: 'short', 
        year: 'numeric' 
      }),
      confidence: application.source_confidence,
      sourceUrl: application.course_url,
      label: calculateDaysLeft(application.deadline),
    } : undefined,
    tuitionFee: application.tuition_fee ? {
      value: application.tuition_fee,
      confidence: application.source_confidence,
      sourceUrl: application.course_url,
      label: 'View fees page',
    } : undefined,
    applicationMethod: application.application_method ? {
      value: application.application_method,
      confidence: application.source_confidence,
      sourceUrl: application.course_url,
      label: 'View how to apply',
    } : undefined,
    entryRequirements: application.entry_requirements_summary ? {
      value: application.entry_requirements_summary,
      confidence: application.source_confidence,
      sourceUrl: application.course_url,
      label: 'View full requirements',
    } : undefined,
    matchScore: application.match_score,
    matchLabel: getMatchLabel(application.match_score),
  };
  
  return {
    application: transformedApplication,
    keyFacts,
    stages: transformedStages,
  };
}

function calculateDaysLeft(deadline: string): string {
  const now = new Date();
  const deadlineDate = new Date(deadline);
  const diffTime = deadlineDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return 'Deadline passed';
  if (diffDays === 0) return 'Due today';
  if (diffDays === 1) return '1 day left';
  return `${diffDays} days left`;
}

function getMatchLabel(matchScore?: number): string | undefined {
  if (matchScore === undefined) return undefined;
  if (matchScore >= 80) return 'Excellent match';
  if (matchScore >= 70) return 'Good match';
  if (matchScore >= 60) return 'Fair match';
  return 'Consider alternatives';
}

export default async function ApplicationPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/auth');

  const workspace = await fetchApplicationWorkspace(applicationId, user.id);

  if (!workspace) notFound();

  return (
    <main className="min-h-screen bg-transparent px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto max-w-7xl">
        <ApplicationWorkspaceView workspace={workspace} />
      </div>
    </main>
  );
}
