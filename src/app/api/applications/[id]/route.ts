import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/applications/:id
 * 
 * Fetch a single application with all stages and tasks.
 * Returns the full ApplicationWorkspace structure.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Fetch application
    const { data: application, error: appError } = await supabase
      .from('course_applications')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();
    
    if (appError || !application) {
      return NextResponse.json(
        { error: 'Application not found' },
        { status: 404 }
      );
    }
    
    // Fetch stages
    const { data: stages, error: stagesError } = await supabase
      .from('application_stages')
      .select('*')
      .eq('application_id', id)
      .order('order_num', { ascending: true });
    
    if (stagesError) {
      console.error('Error fetching stages:', stagesError);
      return NextResponse.json(
        { error: 'Failed to fetch stages' },
        { status: 500 }
      );
    }
    
    // Fetch all tasks for this application
    const { data: tasks, error: tasksError } = await supabase
      .from('application_tasks')
      .select('*')
      .eq('application_id', id);
    
    if (tasksError) {
      console.error('Error fetching tasks:', tasksError);
      return NextResponse.json(
        { error: 'Failed to fetch tasks' },
        { status: 500 }
      );
    }
    
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
    
    // Build key facts from application data
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
    
    const workspace = {
      application: transformedApplication,
      keyFacts,
      stages: transformedStages,
    };
    
    return NextResponse.json({ workspace });
  } catch (error) {
    console.error('Unexpected error in GET /api/applications/:id:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/applications/:id
 * 
 * Update an application's fields.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Transform camelCase to snake_case for database
    const updateData: Record<string, unknown> = {};
    
    if (body.status !== undefined) updateData.status = body.status;
    if (body.progressPercentage !== undefined) updateData.progress_percentage = body.progressPercentage;
    if (body.nextAction !== undefined) updateData.next_action = body.nextAction;
    if (body.matchScore !== undefined) updateData.match_score = body.matchScore;
    
    const { data: application, error } = await supabase
      .from('course_applications')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating application:', error);
      return NextResponse.json(
        { error: 'Failed to update application' },
        { status: 500 }
      );
    }
    
    if (!application) {
      return NextResponse.json(
        { error: 'Application not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ 
      success: true,
      application: {
        id: application.id,
        status: application.status,
        progressPercentage: application.progress_percentage,
        nextAction: application.next_action,
        matchScore: application.match_score,
        updatedAt: application.updated_at,
      }
    });
  } catch (error) {
    console.error('Unexpected error in PATCH /api/applications/:id:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper functions
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
