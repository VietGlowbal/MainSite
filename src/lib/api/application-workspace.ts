/**
 * Application Workspace API
 * 
 * Fetches complete application workspace view for the UI
 */

import { createClient } from '@/lib/supabase/server';
import type { ApplicationWorkspaceView } from '@/lib/apply-types';

/**
 * Fetch complete application workspace view
 * Returns all data needed to render the application details page
 */
export async function fetchApplicationWorkspace(
  applicationId: string,
  userId: string
): Promise<ApplicationWorkspaceView | null> {
  const supabase = await createClient();

  // Fetch application
  const { data: application, error: appError } = await supabase
    .from('course_applications')
    .select('*')
    .eq('id', applicationId)
    .eq('user_id', userId)
    .single();

  if (appError || !application) {
    console.error('Error fetching application:', appError);
    return null;
  }

  // Fetch course (if linked)
  let course = null;
  if (application.course_id) {
    const { data: courseData } = await supabase
      .from('courses')
      .select('*')
      .eq('id', application.course_id)
      .single();
    course = courseData;
  }

  // Fetch stages with tasks
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
  const { data: tasks } = await supabase
    .from('application_tasks')
    .select('*')
    .eq('application_id', applicationId)
    .order('sort_order', { ascending: true });

  // Attach tasks to stages
  const stagesWithTasks = (stages || []).map(stage => ({
    ...transformStage(stage),
    tasks: (tasks || [])
      .filter(task => task.stage_id === stage.id)
      .map(transformTask),
  }));

  // Fetch requirements
  const { data: requirements } = await supabase
    .from('application_requirements')
    .select('*')
    .eq('application_id', applicationId);

  // Fetch sources
  const { data: sources } = await supabase
    .from('application_sources')
    .select('*')
    .eq('application_id', applicationId)
    .order('display_priority', { ascending: true });

  // Fetch latest match analysis
  const { data: matchAnalysis } = await supabase
    .from('application_match_analyses')
    .select('*')
    .eq('application_id', applicationId)
    .eq('analysis_status', 'complete')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  // Fetch recommendations
  const { data: recommendations } = await supabase
    .from('application_recommendations')
    .select('*')
    .eq('application_id', applicationId)
    .eq('is_dismissed', false)
    .order('priority', { ascending: false });

  // Calculate metrics
  const metrics = calculateMetrics(
    application,
    requirements || [],
    matchAnalysis
  );

  // Find active stage
  const activeStage = stagesWithTasks.find(s => s.status === 'in_progress') 
    || stagesWithTasks.find(s => s.status === 'not_started')
    || stagesWithTasks[0];

  return {
    application: transformApplication(application),
    course: course ? transformCourse(course) : undefined,
    stages: stagesWithTasks,
    activeStage,
    requirements: (requirements || []).map(transformRequirement),
    sources: (sources || []).map(transformSource),
    matchAnalysis: matchAnalysis ? transformMatchAnalysis(matchAnalysis) : undefined,
    recommendations: (recommendations || []).map(transformRecommendation),
    metrics,
  };
}

// Transform functions to convert snake_case DB fields to camelCase
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformApplication(app: any) {
  return {
    id: app.id,
    userId: app.user_id,
    courseId: app.course_id,
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
    status: app.status,
    currentStageId: app.current_stage_id,
    progressPercentage: app.progress_percentage,
    deadline: app.deadline,
    deadlineSource: app.deadline_source,
    deadlineConfidence: app.deadline_confidence,
    importedFromUrl: app.imported_from_url,
    importStatus: app.import_status,
    aiSummary: app.ai_summary,
    userNotes: app.user_notes,
    createdAt: app.created_at,
    updatedAt: app.updated_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformCourse(course: any) {
  return {
    id: course.id,
    universityId: course.university_id,
    universityName: course.university_name,
    courseName: course.course_name,
    courseUrl: course.course_url,
    degreeLevel: course.degree_level,
    subject: course.subject,
    studyMode: course.study_mode,
    duration: course.duration,
    intake: course.intake,
    country: course.country,
    city: course.city,
    tuitionFeeText: course.tuition_fee_text,
    tuitionFeeMin: course.tuition_fee_min,
    tuitionFeeMax: course.tuition_fee_max,
    tuitionCurrency: course.tuition_currency,
    entryRequirementsSummary: course.entry_requirements_summary,
    englishRequirementsSummary: course.english_requirements_summary,
    applicationMethod: course.application_method,
    applicationCode: course.application_code,
    sourceConfidence: course.source_confidence,
    extractionStatus: course.extraction_status,
    lastExtractedAt: course.last_extracted_at,
    createdAt: course.created_at,
    updatedAt: course.updated_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformStage(stage: any) {
  return {
    id: stage.id,
    applicationId: stage.application_id,
    name: stage.name,
    slug: stage.slug,
    description: stage.description,
    orderNum: stage.order_num,
    status: stage.status,
    isRequired: stage.is_required,
    icon: stage.icon,
    whyThisMatters: stage.why_this_matters,
    aiGenerated: stage.ai_generated,
    confidence: stage.confidence,
    startedAt: stage.started_at,
    completedAt: stage.completed_at,
    createdAt: stage.created_at,
    updatedAt: stage.updated_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformTask(task: any) {
  return {
    id: task.id,
    applicationId: task.application_id,
    stageId: task.stage_id,
    title: task.title,
    description: task.description,
    taskType: task.task_type,
    status: task.status,
    priority: task.priority,
    dueDate: task.due_date,
    actionLabel: task.action_label,
    actionType: task.action_type,
    actionTarget: task.action_target,
    sourceUrl: task.source_url,
    confidence: task.confidence,
    sortOrder: task.sort_order,
    completedAt: task.completed_at,
    createdBy: task.created_by,
    pillar: task.pillar ?? undefined,
    estimatedUplift: task.estimated_uplift ?? undefined,
    createdAt: task.created_at,
    updatedAt: task.updated_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformRequirement(req: any) {
  return {
    id: req.id,
    applicationId: req.application_id,
    courseId: req.course_id,
    requirementType: req.requirement_type,
    title: req.title,
    requirementText: req.requirement_text,
    isMandatory: req.is_mandatory,
    studentStatus: req.student_status,
    sourceUrl: req.source_url,
    sourceId: req.source_id,
    confidence: req.confidence,
    createdAt: req.created_at,
    updatedAt: req.updated_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformSource(source: any) {
  return {
    id: source.id,
    applicationId: source.application_id,
    courseId: source.course_id,
    universityId: source.university_id,
    sourceType: source.source_type,
    title: source.title,
    url: source.url,
    description: source.description,
    displayPriority: source.display_priority,
    isOfficial: source.is_official,
    confidence: source.confidence,
    validationStatus: source.validation_status,
    lastCheckedAt: source.last_checked_at,
    createdAt: source.created_at,
    updatedAt: source.updated_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformMatchAnalysis(analysis: any) {
  return {
    id: analysis.id,
    applicationId: analysis.application_id,
    userId: analysis.user_id,
    profileVersion: analysis.profile_version,
    currentMatchScore: analysis.current_match_score,
    maxPossibleMatchScore: analysis.max_possible_match_score,
    scoreLabel: analysis.score_label,
    maxScoreLabel: analysis.max_score_label,
    academicScore: analysis.academic_score,
    englishScore: analysis.english_score,
    experienceScore: analysis.experience_score,
    documentScore: analysis.document_score,
    fitScore: analysis.fit_score,
    strengths: analysis.strengths,
    weaknesses: analysis.weaknesses,
    improvementActions: analysis.improvement_actions,
    explanation: analysis.explanation,
    maxPossibleExplanation: analysis.max_possible_explanation,
    modelName: analysis.model_name,
    promptVersion: analysis.prompt_version,
    analysisStatus: analysis.analysis_status,
    pillars: analysis.pillars ?? undefined,
    confidence: analysis.confidence ?? undefined,
    inputsPresent: analysis.inputs_present ?? undefined,
    createdAt: analysis.created_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformRecommendation(rec: any) {
  return {
    id: rec.id,
    applicationId: rec.application_id,
    recommendationType: rec.recommendation_type,
    title: rec.title,
    body: rec.body,
    priority: rec.priority,
    actionLabel: rec.action_label,
    actionType: rec.action_type,
    actionTarget: rec.action_target,
    confidence: rec.confidence,
    isDismissed: rec.is_dismissed,
    createdAt: rec.created_at,
    updatedAt: rec.updated_at,
  };
}

function calculateMetrics(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  application: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  requirements: any[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  matchAnalysis: any | null
) {
  // Calculate deadline info
  let deadline = undefined;
  if (application.deadline) {
    const deadlineDate = new Date(application.deadline);
    const now = new Date();
    const diffTime = deadlineDate.getTime() - now.getTime();
    const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    deadline = {
      date: application.deadline,
      daysLeft,
      label: daysLeft < 0 ? 'Deadline passed' : `${daysLeft} days left`,
    };
  }

  // Calculate requirements met
  const requirementsMet = requirements.filter(r => r.student_status === 'met').length;
  const requirementsTotal = requirements.filter(r => r.is_mandatory).length;

  return {
    deadline,
    progress: application.progress_percentage || 0,
    currentMatch: matchAnalysis?.current_match_score,
    maxPossibleMatch: matchAnalysis?.max_possible_match_score,
    requirementsMet,
    requirementsTotal,
  };
}
