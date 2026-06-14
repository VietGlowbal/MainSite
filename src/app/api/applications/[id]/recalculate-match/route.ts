import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { analyzeUserMatch } from '@/lib/ai/course-extractor';

/**
 * POST /api/applications/[id]/recalculate-match
 * 
 * Recalculate match score for an application using current user profile
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: applicationId } = await context.params;
    
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Fetch application with course data
    const { data: application, error: appError } = await supabase
      .from('course_applications')
      .select(`
        *,
        courses (*)
      `)
      .eq('id', applicationId)
      .eq('user_id', user.id)
      .single();
    
    if (appError || !application) {
      return NextResponse.json(
        { error: 'Application not found' },
        { status: 404 }
      );
    }
    
    // Get OpenAI API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'AI service not configured' },
        { status: 500 }
      );
    }
    
    // Fetch user profile
    const { data: profile } = await supabase
      .from('student_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    // Fetch user documents
    const { data: documents } = await supabase
      .from('uploaded_documents')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true);
    
    // Build course data for analysis
    const courseData = {
      universityName: application.university_name,
      courseName: application.course_name,
      entryRequirementsSummary: application.courses?.entry_requirements_summary,
      englishRequirementsSummary: application.courses?.english_requirements_summary,
      subject: application.subject,
      sourceConfidence: 'medium' as const,
      stages: [],
      scholarships: [],
    };
    
    // Build user profile for match analysis
    const userProfile = {
      academicBackground: profile?.academic_background,
      cv: documents?.find(d => d.document_type === 'cv')?.parsed_text,
      statementOfPurpose: documents?.find(d => d.document_type === 'sop')?.parsed_text,
      testScores: profile?.grades_summary,
      workExperience: profile?.achievements?.join(', '),
    };
    
    // Analyze match
    const matchAnalysis = await analyzeUserMatch(
      courseData,
      userProfile,
      apiKey,
      'gpt-4o-mini'
    );
    
    // Store new match analysis
    const { error: analysisError } = await supabase
      .from('application_match_analyses')
      .insert({
        application_id: applicationId,
        user_id: user.id,
        profile_version: profile?.profile_version || 1,
        current_match_score: matchAnalysis.matchScore,
        max_possible_match_score: matchAnalysis.maxPossibleMatch,
        score_label: matchAnalysis.matchScore >= 70 ? 'Good match' : 'Fair match',
        max_score_label: matchAnalysis.maxPossibleMatch >= 80 ? 'Excellent match possible' : 'Good match possible',
        strengths: matchAnalysis.matchAnalysis.strengths,
        weaknesses: matchAnalysis.matchAnalysis.gaps,
        improvement_actions: matchAnalysis.matchAnalysis.recommendations,
        model_name: 'gpt-4o-mini',
        analysis_status: 'complete',
      })
      .select()
      .single();
    
    if (analysisError) {
      console.error('Error storing match analysis:', analysisError);
      return NextResponse.json(
        { error: 'Failed to store match analysis' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      matchScore: matchAnalysis.matchScore,
      maxPossibleMatch: matchAnalysis.maxPossibleMatch,
      analysis: matchAnalysis.matchAnalysis,
    });
  } catch (error) {
    console.error('Error recalculating match:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
