import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { batchValidateCourseUrls } from '@/lib/course-search/url-validator';
import { canAddCoursesToApply } from '@/lib/entitlements/entitlement-service';
import crypto from 'crypto';

/**
 * Task 13.8: Idempotency helper functions
 * 
 * These functions manage request deduplication using the idempotency_keys table.
 * Prevents duplicate applications from double-click submissions.
 */

/**
 * Generate a deterministic idempotency key from session and result IDs
 * Format: SHA-256 hash of "${sessionId}:${sortedResultIds}"
 */
function generateIdempotencyKey(sessionId: string, selectedResultIds: string[]): string {
  const sortedIds = [...selectedResultIds].sort();
  const data = `${sessionId}:${sortedIds.join(',')}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Check if an idempotency key exists and return cached response if found
 * Returns null if key not found or expired (>24 hours old)
 */
async function checkIdempotencyKey(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  endpoint: string,
  key: string
): Promise<AddCoursesResponse | null> {
  // Idempotency is best-effort: any failure looking up the key should not
  // break the request, it should just be treated as a cache miss.
  try {
    const { data, error } = await supabase
      .from('idempotency_keys')
      .select('response_body, created_at')
      .eq('user_id', userId)
      .eq('endpoint', endpoint)
      .eq('key', key)
      .single();

    if (error || !data) {
      return null;
    }

    // Check if key is within 24-hour window
    const createdAt = new Date(data.created_at);
    const now = new Date();
    const hoursDiff = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

    if (hoursDiff > 24) {
      // Key expired, ignore it
      return null;
    }

    // Return cached response
    return data.response_body as AddCoursesResponse;
  } catch (err) {
    console.warn('Idempotency key lookup failed, treating as cache miss:', err);
    return null;
  }
}

/**
 * Store response body in idempotency_keys table
 * Creates or updates the key with the response
 */
async function storeIdempotencyKey(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  endpoint: string,
  key: string,
  responseBody: AddCoursesResponse
): Promise<void> {
  try {
    const { error } = await supabase
      .from('idempotency_keys')
      .upsert({
        user_id: userId,
        endpoint,
        key,
        response_body: responseBody,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,endpoint,key',
      });

    if (error) {
      // Log error but don't fail the request - idempotency is best-effort
      console.warn('Failed to store idempotency key:', error);
    }
  } catch (err) {
    console.warn('Failed to store idempotency key:', err);
  }
}

/**
 * POST /api/apply-shortlist/add-courses
 * 
 * Phase 3, Task 13: Multi-Select Shortlist & Background Parsing
 * 
 * This endpoint allows users to add multiple selected courses from a search session
 * to their Apply shortlist with background parsing job creation.
 * 
 * Task 13.1: Route handler creation, authentication, and input validation
 */

/**
 * Request body validation schema
 * 
 * Task 13.1: Zod schema for input validation
 * - sessionId: UUID string representing the course search session
 * - selectedResultIds: Array of UUID strings representing selected search results
 * - idempotencyKey: Optional string for request deduplication (Task 13.8)
 */
const AddCoursesRequestSchema = z.object({
  sessionId: z.string().uuid('Session ID must be a valid UUID'),
  selectedResultIds: z
    .array(z.string().uuid('Each result ID must be a valid UUID'))
    .min(1, 'At least one course must be selected')
    .max(10, 'Cannot add more than 10 courses at once'),
  idempotencyKey: z.string().optional(),
});

/**
 * Response structure for successful course addition
 */
interface AddCoursesResponse {
  success: boolean;
  applicationsCreated: Array<{
    id: string;
    courseName: string;
    courseUrl: string;
    parseStatus: 'processing' | 'pending';
  }>;
  skippedDuplicates: Array<{
    courseName: string;
    courseUrl: string;
    existingApplicationId: string;
  }>;
  failedValidation: Array<{
    courseName: string;
    courseUrl: string;
    reason: string;
  }>;
  usage: {
    coursesAdded: number;
    courseAddLimit: number;
    plan: string;
  };
}

/**
 * POST /api/apply-shortlist/add-courses
 * 
 * Batch add selected courses from a search session to the user's Apply shortlist.
 * 
 * Request body:
 * - sessionId: string (UUID) - The course search session ID
 * - selectedResultIds: string[] (UUIDs) - Array of selected course result IDs
 * 
 * Returns:
 * - success: boolean - Whether the operation succeeded
 * - applicationsCreated: array - Successfully created applications
 * - skippedDuplicates: array - Courses already in the user's shortlist
 * - failedValidation: array - Courses that failed validation
 * - usage: object - Updated usage state and limits
 * 
 * Error responses:
 * - 400: Invalid request body or validation failure
 * - 401: Unauthorized (not authenticated)
 * - 403: Forbidden (quota exceeded or insufficient permissions)
 * - 404: Session or results not found
 * - 500: Internal server error
 */
export async function POST(request: NextRequest) {
  try {
    // Task 13.1: Parse and validate request body with Zod
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const parsed = AddCoursesRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { sessionId, selectedResultIds, idempotencyKey } = parsed.data;

    // Task 13.1: Authenticate user (return 401 if no auth)
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Task 13.8: Check for idempotency key
    // Accept key from request body or generate from sessionId + selectedResultIds
    const endpoint = '/api/apply-shortlist/add-courses';
    const finalIdempotencyKey = idempotencyKey || generateIdempotencyKey(sessionId, selectedResultIds);
    
    // Check if we've already processed this exact request
    const cachedResponse = await checkIdempotencyKey(
      supabase,
      user.id,
      endpoint,
      finalIdempotencyKey
    );

    if (cachedResponse) {
      console.log('Returning cached response for idempotency key:', {
        userId: user.id,
        key: finalIdempotencyKey.substring(0, 16) + '...',
        applicationsCreated: cachedResponse.applicationsCreated.length,
      });
      
      return NextResponse.json(cachedResponse, { status: 200 });
    }

    // Task 13.2: Verify session ownership and status
    const { data: session, error: sessionError } = await supabase
      .from('course_search_sessions')
      .select('id, user_id, status, university_id')
      .eq('id', sessionId)
      .single();

    // Session not found
    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Verify session ownership (RLS should handle this, but double-check)
    if (session.user_id !== user.id) {
      return NextResponse.json(
        { error: "You don't have permission to access this session" },
        { status: 403 }
      );
    }

    // Verify session status
    if (session.status === 'processing') {
      return NextResponse.json(
        { error: 'This search session is still processing. Please wait for it to complete.' },
        { status: 400 }
      );
    }

    if (session.status === 'failed') {
      return NextResponse.json(
        { error: 'This search session failed. Please try searching again.' },
        { status: 400 }
      );
    }

    // Only proceed if session status is 'complete'
    if (session.status !== 'complete') {
      return NextResponse.json(
        { error: `Invalid session status: ${session.status}` },
        { status: 400 }
      );
    }

    // Task 13.3: Fetch selected session results
    const { data: selectedResults, error: resultsError } = await supabase
      .from('course_search_session_results')
      .select('*')
      .eq('session_id', sessionId)
      .in('id', selectedResultIds);

    if (resultsError) {
      console.error('Error fetching session results:', resultsError);
      return NextResponse.json(
        { error: 'Failed to fetch session results' },
        { status: 500 }
      );
    }

    // Validate that ALL selected results were found
    if (!selectedResults || selectedResults.length !== selectedResultIds.length) {
      const foundIds = new Set(selectedResults?.map(r => r.id) || []);
      const missingIds = selectedResultIds.filter(id => !foundIds.has(id));
      
      console.warn('Missing selected results:', {
        requested: selectedResultIds,
        found: Array.from(foundIds),
        missing: missingIds,
      });

      return NextResponse.json(
        { 
          error: 'One or more selected courses not found',
          details: {
            requestedCount: selectedResultIds.length,
            foundCount: selectedResults?.length || 0,
            missingIds,
          }
        },
        { status: 404 }
      );
    }

    // Task 13.4: Implement duplicate detection
    // For each selected result, check if user already has an application with the same course_url
    const courseUrls = selectedResults.map(r => r.course_url);
    
    const { data: existingApplications, error: duplicateCheckError } = await supabase
      .from('course_applications')
      .select('id, course_name, course_url')
      .eq('user_id', user.id)
      .in('course_url', courseUrls);

    if (duplicateCheckError) {
      console.error('Error checking for duplicate applications:', duplicateCheckError);
      return NextResponse.json(
        { error: 'Failed to check for existing applications' },
        { status: 500 }
      );
    }

    // Create a map of course_url -> existing application for fast lookup
    const existingByUrl = new Map(
      (existingApplications || []).map(app => [app.course_url, app])
    );

    // Separate results into toCreate (new courses) and skippedDuplicates (already in shortlist)
    const toCreate = selectedResults.filter(result => !existingByUrl.has(result.course_url));
    const skippedDuplicates = selectedResults
      .filter(result => existingByUrl.has(result.course_url))
      .map(result => {
        const existing = existingByUrl.get(result.course_url)!;
        return {
          courseName: result.course_name,
          courseUrl: result.course_url,
          existingApplicationId: existing.id,
        };
      });

    // Task 13.5: Validate course URLs before creating applications.
    // `universities` has no domain column, so URL validation runs without a
    // domain restriction (still checks URL format / non-course-page patterns).
    const universityDomain: string | null = null;

    // Validate all URLs in toCreate
    const { valid: validCourses, invalid: invalidCourses } = await batchValidateCourseUrls(
      toCreate,
      universityDomain
    );

    // Separate valid courses and failed validations
    const toCreateValidated = validCourses;
    const failedValidation = invalidCourses.map(({ course, reason }) => ({
      courseName: course.course_name,
      courseUrl: course.course_url,
      reason,
    }));

    // Task 13.6: Check course add limits with actual toCreate count
    // Only check limits for courses that passed duplicate filtering and URL validation
    const entitlementCheck = await canAddCoursesToApply(user.id, toCreateValidated.length);

    if (!entitlementCheck.allowed) {
      // User has exceeded their quota - return 403 with usage state and upgrade prompt
      return NextResponse.json(
        {
          allowed: false,
          usage: entitlementCheck.usage,
          upgradeRequired: entitlementCheck.upgradeRequired || false,
          reason: entitlementCheck.reason || 'You have reached your active course limit.',
          // Include partial results so user knows what was processed
          selectedCount: selectedResultIds.length,
          skippedDuplicatesCount: skippedDuplicates.length,
          failedValidationCount: failedValidation.length,
          attemptedToAddCount: toCreateValidated.length,
        },
        { status: 403 }
      );
    }

    // Task 13.7: Create applications batch with transaction using PostgreSQL RPC
    // The RPC function add_selected_courses_to_apply handles all writes atomically:
    // - Creates course_applications records
    // - Creates application_sources records
    // - Creates course_parse_jobs records
    // - Marks session results as selected
    // All operations succeed or fail together (ACID transaction)

    let applicationsCreated: Array<{
      id: string;
      courseName: string;
      courseUrl: string;
      parseStatus: 'processing' | 'pending';
    }> = [];

    if (toCreateValidated.length > 0) {
      // Prepare data for RPC call
      const resultsPayload = toCreateValidated.map(result => ({
        result_id: result.id,
        university_id: session.university_id,
        university_name: result.university_name || 'Unknown University',
        course_name: result.course_name,
        course_url: result.course_url,
        source_domain: result.source_domain,
      }));

      try {
        // Call PostgreSQL RPC function for atomic batch creation
        const { data: rpcResult, error: rpcError } = await supabase.rpc(
          'add_selected_courses_to_apply',
          {
            p_user_id: user.id,
            p_session_id: sessionId,
            p_results: resultsPayload,
          }
        );

        if (rpcError) {
          console.error('RPC error creating applications:', rpcError);
          return NextResponse.json(
            { 
              error: 'Failed to create applications',
              details: rpcError.message,
            },
            { status: 500 }
          );
        }

        // Transform RPC response to API response format
        if (rpcResult?.applications_created) {
          applicationsCreated = rpcResult.applications_created.map((app: {
            application_id: string;
            course_name: string;
            course_url: string;
            parse_status?: string;
          }) => ({
            id: app.application_id,
            courseName: app.course_name,
            courseUrl: app.course_url,
            parseStatus: app.parse_status || 'pending',
          }));
        }

        console.log('Successfully created applications:', {
          userId: user.id,
          sessionId,
          applicationsCreated: applicationsCreated.length,
          skippedDuplicates: skippedDuplicates.length,
          failedValidation: failedValidation.length,
        });
      } catch (error) {
        console.error('Unexpected error calling RPC:', error);
        return NextResponse.json(
          { error: 'Failed to create applications due to unexpected error' },
          { status: 500 }
        );
      }
    }

    // Task 13.9: Return success response with usage state
    // Fetch updated usage after creating applications
    const updatedEntitlementCheck = await canAddCoursesToApply(user.id, 0);

    const response: AddCoursesResponse = {
      success: true,
      applicationsCreated,
      skippedDuplicates,
      failedValidation,
      usage: updatedEntitlementCheck.usage || {
        coursesAdded: applicationsCreated.length,
        courseAddLimit: entitlementCheck.usage?.courseAddLimit || 5,
        plan: entitlementCheck.usage?.plan || 'free',
      },
    };

    // Task 13.8: Store idempotency key with successful response
    await storeIdempotencyKey(
      supabase,
      user.id,
      endpoint,
      finalIdempotencyKey,
      response
    );

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Unexpected error in POST /api/apply-shortlist/add-courses:', error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
