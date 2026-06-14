import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { extractCourseData } from '@/lib/ai/course-extractor';

/** Map extractor task types to V2 DB task_type enum */
function mapTaskType(extractedType: string): string {
  const map: Record<string, string> = {
    required: 'document',
    recommended: 'general',
    optional: 'general',
    risk: 'deadline',
  };
  return map[extractedType] || 'general';
}

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
        deadline: extractedData.deadline || null,
        imported_from_url: courseUrl,
        import_status: 'complete',
        status: 'preparing',
        progress_percentage: 0,
        ai_summary: [
          extractedData.applicationMethod && `Method: ${extractedData.applicationMethod}`,
          extractedData.applicationCode && `Code: ${extractedData.applicationCode}`,
          extractedData.tuitionFee && `Tuition: ${extractedData.tuitionFee}`,
          extractedData.entryRequirementsSummary && `Entry: ${extractedData.entryRequirementsSummary}`,
          extractedData.englishRequirementsSummary && `English: ${extractedData.englishRequirementsSummary}`,
        ].filter(Boolean).join(' | ') || null,
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
      slug: stage.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      order_num: stage.order,
      description: stage.description,
      status: 'not_started' as const,
      is_required: stage.isRequired,
      ai_generated: true,
      confidence: 0.8,
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
          const tasks = stage.tasks.map((task, idx) => ({
            application_id: application.id,
            stage_id: createdStage.id,
            title: task.title,
            description: task.description,
            due_date: task.dueDate || null,
            priority: task.priority,
            task_type: mapTaskType(task.type),
            status: 'not_started' as const,
            source_url: task.sourceUrl,
            confidence: task.confidence === 'high' ? 0.9 : task.confidence === 'medium' ? 0.7 : 0.5,
            sort_order: idx,
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
    
    // Store scholarships as application_sources
    if (extractedData.scholarships.length > 0) {
      const scholarshipSources = extractedData.scholarships.map(scholarship => ({
        application_id: application.id,
        source_type: 'scholarships' as const,
        title: scholarship.name,
        description: [
          scholarship.amount,
          scholarship.eligibility,
          scholarship.deadline ? `Deadline: ${scholarship.deadline}` : null,
        ].filter(Boolean).join(' · ') || 'Scholarship opportunity',
        url: scholarship.url || `https://www.google.com/search?q=${encodeURIComponent(scholarship.name + ' scholarship')}`,
        confidence: scholarship.confidence === 'high' ? 0.9 : scholarship.confidence === 'medium' ? 0.7 : 0.5,
        is_official: true,
      }));
      
      const { error: scholarshipsError } = await supabase
        .from('application_sources')
        .insert(scholarshipSources);
      
      if (scholarshipsError) {
        console.error('Error creating scholarship sources:', scholarshipsError);
      }
    }
    
    // Calculate initial progress
    const totalTasks = extractedData.stages.reduce((sum, stage) => sum + stage.tasks.length, 0);
    
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
