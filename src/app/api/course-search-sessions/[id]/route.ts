import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserEntitlement } from '@/lib/entitlements/entitlement-service';

/**
 * GET /api/course-search-sessions/:id
 * 
 * Retrieve a single course search session with its results and current usage state.
 * Requires authentication and verifies that the user owns the session.
 * 
 * Returns:
 * - session: The session record with metadata
 * - results: Array of course search results for this session (ordered by rank)
 * - usage: Current usage state (plan, limits, and usage counts)
 * 
 * Error responses:
 * - 401: Not authenticated
 * - 404: Session not found or not owned by user
 * - 500: Internal server error
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Extract session ID from route params
    const { id } = await context.params;
    
    // Create Supabase client and check authentication
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Fetch session and verify ownership
    const { data: session, error: sessionError } = await supabase
      .from('course_search_sessions')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();
    
    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }
    
    // Fetch results for this session
    const { data: results, error: resultsError } = await supabase
      .from('course_search_session_results')
      .select('*')
      .eq('session_id', id)
      .order('rank', { ascending: true });
    
    if (resultsError) {
      console.error('Error fetching session results:', resultsError);
      return NextResponse.json(
        { error: 'Failed to fetch session results' },
        { status: 500 }
      );
    }
    
    // Transform session to camelCase for frontend
    const transformedSession = {
      id: session.id,
      userId: session.user_id,
      universityId: session.university_id,
      query: session.query,
      studyLevel: session.study_level,
      studentProfileSnapshot: session.student_profile_snapshot,
      status: session.status,
      resultCount: session.result_count,
      providerName: session.provider_name,
      searchStrategy: session.search_strategy,
      errorMessage: session.error_message,
      errorCode: session.error_code,
      createdAt: session.created_at,
      updatedAt: session.updated_at,
      completedAt: session.completed_at,
    };
    
    // Transform results to camelCase for frontend
    const transformedResults = results.map(result => ({
      id: result.id,
      sessionId: result.session_id,
      universityId: result.university_id,
      courseName: result.course_name,
      courseUrl: result.course_url,
      sourceDomain: result.source_domain,
      snippet: result.snippet,
      degreeLevel: result.degree_level,
      duration: result.duration,
      tuitionFeeText: result.tuition_fee_text,
      confidenceLabel: result.confidence_label,
      sourceConfidence: result.source_confidence,
      rank: result.rank,
      selected: result.selected,
      selectedAt: result.selected_at,
      selectedApplicationId: result.selected_application_id,
      sourceType: result.source_type,
      rawSearchResult: result.raw_search_result,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    }));
    
    // Calculate current usage state
    const usage = await getUserEntitlement(user.id);
    
    return NextResponse.json({
      session: transformedSession,
      results: transformedResults,
      usage,
    });
  } catch (error) {
    console.error('Unexpected error in GET /api/course-search-sessions/:id:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
