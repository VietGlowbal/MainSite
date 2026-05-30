import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/applications
 * 
 * Fetch all course applications for the authenticated user.
 * Returns applications with basic info (no stages/tasks).
 */
export async function GET() {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const { data: applications, error } = await supabase
      .from('course_applications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching applications:', error);
      return NextResponse.json(
        { error: 'Failed to fetch applications' },
        { status: 500 }
      );
    }
    
    // Transform snake_case to camelCase for frontend
    const transformedApplications = applications.map(app => ({
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
    
    return NextResponse.json({ applications: transformedApplications });
  } catch (error) {
    console.error('Unexpected error in GET /api/applications:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
