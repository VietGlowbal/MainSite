import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { extractCourseData } from '@/lib/ai/course-extractor';

/**
 * POST /api/applications/extract
 * 
 * Extract course information from a URL using AI and create a complete application
 * with stages, tasks, and scholarship information.
 * 
 * Body:
 * - courseUrl: string (required)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { courseUrl } = body;
    
    if (!courseUrl || typeof courseUrl !== 'string') {
      return NextResponse.json(
        { error: 'Course URL is required' },
        { status: 400 }
      );
    }
    
    // Validate URL format
    try {
      new URL(courseUrl);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }
    
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Check for duplicate URL
    const { data: existingApp } = await supabase
      .from('course_applications')
      .select('id')
      .eq('user_id', user.id)
      .eq('course_url', courseUrl)
      .maybeSingle();
    
    if (existingApp) {
      return NextResponse.json(
        { 
          error: 'This course has already been imported',
          existingApplicationId: existingApp.id,
        },
        { status: 409 }
      );
    }
    
    // Get OpenAI API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'AI service not configured. Please contact support.' },
        { status: 500 }
      );
    }
    
    const model = process.env.OPENAI_MODEL || 'gpt-4o';
    
    // Extract course data using AI
    let extractedData;
    try {
      extractedData = await extractCourseData(courseUrl, apiKey, model);
    } catch (error) {
      console.error('Course extraction error:', error);
      return NextResponse.json(
        { 
          error: error instanceof Error ? error.message : 'Failed to extract course information',
          details: 'The AI could not parse the course page. Please ensure the URL is a valid university course page.'
        },
        { status: 422 }
      );
    }
    
    // Create the application with extracted data
    const { data: application, error: appError } = await supabase
      .from('course_applications')
      .insert({
        user_id: user.id,
        university_name: extractedData.universityName,
        course_name: extractedData.courseName,
        course_url: courseUrl,
        degree_level: extractedData.degreeLevel,
        subject: extractedData.subject,
        study_mode: extractedData.studyMode,
        intake: extractedData.intake,
        country: extractedData.country,
        country_flag: extractedData.countryFlag,
        application_method: extractedData.applicationMethod,
        application_code: extractedData.applicationCode,
        deadline: extractedData.deadline,
        tuition_fee: extractedData.tuitionFee,
        entry_requirements_summary: extractedData.entryRequirementsSummary,
        english_requirements_summary: extractedData.englishRequirementsSummary,
        image_url: extractedData.imageUrl,
        logo_url: extractedData.logoUrl,
        status: 'plan_generated',
        progress_percentage: 0,
        source_confidence: extractedData.sourceConfidence,
      })
      .select()
      .single();
    
    if (appError || !application) {
      console.error('Error creating application:', appError);
      return NextResponse.json(
        { error: 'Failed to create application' },
        { status: 500 }
      );
    }
    
    // Create stages with tasks
    const stagesWithTasks = extractedData.stages.map(stage => ({
      application_id: application.id,
      name: stage.name,
      order_num: stage.order,
      description: stage.description,
      status: 'not_started' as const,
      is_required: stage.isRequired,
    }));
    
    const { data: createdStages, error: stagesError } = await supabase
      .from('application_stages')
      .insert(stagesWithTasks)
      .select();
    
    if (stagesError || !createdStages) {
      console.error('Error creating stages:', stagesError);
      // Don't fail the request, but log the error
    }
    
    // Create tasks for each stage
    if (createdStages) {
      const allTasks = [];
      
      for (let i = 0; i < extractedData.stages.length; i++) {
        const stage = extractedData.stages[i];
        const createdStage = createdStages[i];
        
        if (createdStage && stage.tasks.length > 0) {
          const tasks = stage.tasks.map(task => ({
            application_id: application.id,
            stage_id: createdStage.id,
            title: task.title,
            description: task.description,
            due_date: task.dueDate,
            priority: task.priority,
            type: task.type,
            status: 'not_started' as const,
            source_url: task.sourceUrl,
            support_tool_type: task.supportToolType,
            confidence: task.confidence,
            created_by: 'ai' as const,
          }));
          
          allTasks.push(...tasks);
        }
      }
      
      if (allTasks.length > 0) {
        const { error: tasksError } = await supabase
          .from('application_tasks')
          .insert(allTasks);
        
        if (tasksError) {
          console.error('Error creating tasks:', tasksError);
        }
      }
    }
    
    // Store scholarships as support resources
    if (extractedData.scholarships.length > 0) {
      const scholarshipResources = extractedData.scholarships.map(scholarship => ({
        application_id: application.id,
        resource_type: 'scholarship',
        title: scholarship.name,
        description: scholarship.eligibility 
          ? `${scholarship.amount || 'Amount not specified'} - ${scholarship.eligibility}${scholarship.deadline ? ` - Deadline: ${scholarship.deadline}` : ''}`
          : scholarship.amount || 'Scholarship opportunity',
        url: scholarship.url,
        confidence: scholarship.confidence,
      }));
      
      const { error: scholarshipsError } = await supabase
        .from('support_resources')
        .insert(scholarshipResources);
      
      if (scholarshipsError) {
        console.error('Error creating scholarship resources:', scholarshipsError);
      }
    }
    
    // Calculate initial progress and next action
    const totalTasks = extractedData.stages.reduce((sum, stage) => sum + stage.tasks.length, 0);
    const nextAction = extractedData.stages[0]?.tasks[0]?.title || 'Start researching the course';
    
    await supabase
      .from('course_applications')
      .update({ 
        next_action: nextAction,
        progress_percentage: 0,
      })
      .eq('id', application.id);
    
    return NextResponse.json({ 
      success: true,
      applicationId: application.id,
      message: 'Course imported and analyzed successfully',
      summary: {
        courseName: extractedData.courseName,
        universityName: extractedData.universityName,
        stagesCreated: createdStages?.length || 0,
        tasksCreated: totalTasks,
        scholarshipsFound: extractedData.scholarships.length,
        confidence: extractedData.sourceConfidence,
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error in POST /api/applications/extract:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
