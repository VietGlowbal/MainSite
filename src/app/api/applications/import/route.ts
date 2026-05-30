import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/applications/import
 * 
 * Import a course URL and create a new application with default stages.
 * 
 * Body:
 * - courseUrl: string (required)
 * - universityName?: string (optional, extracted from URL if not provided)
 * - courseName?: string (optional, extracted from URL if not provided)
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
    let url: URL;
    try {
      url = new URL(courseUrl);
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
    const { data: existingApp, error: duplicateError } = await supabase
      .from('course_applications')
      .select('id')
      .eq('user_id', user.id)
      .eq('course_url', courseUrl)
      .maybeSingle();
    
    if (duplicateError) {
      console.error('Error checking for duplicates:', duplicateError);
    }
    
    if (existingApp) {
      return NextResponse.json(
        { 
          error: 'This course has already been imported',
          existingApplicationId: existingApp.id,
        },
        { status: 409 }
      );
    }
    
    // Extract basic info from URL (simple heuristics)
    const universityName = body.universityName || extractUniversityName(url);
    const courseName = body.courseName || extractCourseName(url);
    
    // Create the application
    const { data: application, error: appError } = await supabase
      .from('course_applications')
      .insert({
        user_id: user.id,
        university_name: universityName,
        course_name: courseName,
        course_url: courseUrl,
        status: 'course_imported',
        progress_percentage: 0,
        source_confidence: 'low', // Will be updated by AI extraction later
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
    
    // Create default stages
    const defaultStages = [
      {
        application_id: application.id,
        name: 'Research',
        order_num: 1,
        description: 'Learn about the course, the university, and the application process.',
        status: 'not_started',
        is_required: true,
      },
      {
        application_id: application.id,
        name: 'Check eligibility',
        order_num: 2,
        description: 'Confirm you meet all the academic, language, and subject requirements.',
        status: 'not_started',
        is_required: true,
      },
      {
        application_id: application.id,
        name: 'Prepare documents',
        order_num: 3,
        description: 'Gather transcripts, references, and supporting documents.',
        status: 'not_started',
        is_required: true,
      },
      {
        application_id: application.id,
        name: 'Improve application',
        order_num: 4,
        description: 'Strengthen your personal statement, CV, and supporting materials.',
        status: 'not_started',
        is_required: true,
      },
      {
        application_id: application.id,
        name: 'Submit',
        order_num: 5,
        description: 'Complete and submit your application.',
        status: 'not_started',
        is_required: true,
      },
      {
        application_id: application.id,
        name: 'Interview',
        order_num: 6,
        description: 'Prepare for and attend any interviews or assessments.',
        status: 'not_started',
        is_required: false,
      },
      {
        application_id: application.id,
        name: 'Decision',
        order_num: 7,
        description: 'Track your application outcome and respond to offers.',
        status: 'not_started',
        is_required: true,
      },
    ];
    
    const { error: stagesError } = await supabase
      .from('application_stages')
      .insert(defaultStages);
    
    if (stagesError) {
      console.error('Error creating stages:', stagesError);
      // Don't fail the request, stages can be created later
    }
    
    // Update status to plan_generated
    await supabase
      .from('course_applications')
      .update({ status: 'plan_generated' })
      .eq('id', application.id);
    
    return NextResponse.json({ 
      success: true,
      applicationId: application.id,
      message: 'Course imported successfully',
    }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error in POST /api/applications/import:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper functions to extract info from URL
function extractUniversityName(url: URL): string {
  const hostname = url.hostname;
  
  // Remove common prefixes and TLDs
  let name = hostname
    .replace(/^www\./, '')
    .replace(/\.(edu|ac\.uk|edu\.au|edu\.vn|com|org|net)$/, '');
  
  // Capitalize first letter of each word
  name = name
    .split(/[.-]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  
  return name || 'Unknown University';
}

function extractCourseName(url: URL): string {
  const pathname = url.pathname;
  
  // Try to extract course name from path segments
  const segments = pathname.split('/').filter(Boolean);
  
  // Look for segments that might be course names
  const courseSegment = segments[segments.length - 1] || segments[segments.length - 2];
  
  if (courseSegment) {
    // Convert kebab-case or snake_case to Title Case
    const name = courseSegment
      .replace(/[-_]/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    
    return name;
  }
  
  return 'Untitled Course';
}
