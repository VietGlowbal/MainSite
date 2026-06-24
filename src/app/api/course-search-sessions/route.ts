import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { canCreateCourseSearchSession, getUserEntitlement } from '@/lib/entitlements/entitlement-service';
import { searchCachedCourses, storeCachedResults, type ConfidenceLabel } from '@/lib/course-search/cached-search';
import { getSearchProvider } from '@/lib/search-providers';
import type { SearchResult } from '@/lib/search-providers';
import { courseSearchSessionLimiter, applyRateLimit } from '@/lib/rate-limiter';

// Vercel Pro allows long-running functions (up to 300s). Give the synchronous
// search (cached lookup + Tavily web search + AI ranking) comfortable headroom.
export const maxDuration = 60;
export const runtime = 'nodejs';

/**
 * Response structure for POST /api/course-search-sessions
 * 
 * Task 8.7: Returns session data with complete usage state for UI display
 */
export interface CourseSearchSessionResponse {
  sessionId: string;
  status: 'complete';
  results: CourseSearchResult[];
  usage: {
    courseSearchesUsed: number;
    courseSearchLimit: number;
    coursesAdded: number;
    courseAddLimit: number;
    plan: 'free' | 'plus' | 'team' | 'admin';
  };
}

/**
 * Individual course search result
 */
export interface CourseSearchResult {
  /** ID of the stored row in course_search_session_results (used to add to Apply) */
  id: string;
  universityId: number;
  courseName: string;
  courseUrl: string;
  sourceDomain: string;
  snippet: string | null;
  degreeLevel: string | null;
  duration: string | null;
  tuitionFeeText: string | null;
  confidenceLabel: ConfidenceLabel;
  sourceConfidence: number;
  rank: number;
  sourceType: 'cached' | 'web';
}

/**
 * POST /api/course-search-sessions
 * 
 * Create a new course search session for AI-powered course discovery.
 * 
 * Body:
 * - universityId: number (required) - The university to search courses for
 * - query: string (required) - The course search query
 * - studyLevel: string (optional) - The study level (e.g., 'undergraduate', 'postgraduate')
 * - studentProfile: object (optional) - Snapshot of student preferences
 * 
 * Returns:
 * - sessionId: UUID - The created session ID
 * - status: string - The session status
 * - results: array - Course search results (populated by subsequent tasks)
 * - usage: object - Current usage state and limits
 */
export async function POST(request: Request) {
  let sessionId: string | undefined; // Declare at function scope for error handling
  
  try {
    // Parse request body
    const body = await request.json();
    const { universityId, query, studyLevel, studentProfile } = body;
    
    // Validate required fields
    if (!universityId || typeof universityId !== 'number') {
      return NextResponse.json(
        { error: 'University ID is required and must be a number' },
        { status: 400 }
      );
    }
    
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      );
    }
    
    // Validate study level if provided
    if (studyLevel && typeof studyLevel !== 'string') {
      return NextResponse.json(
        { error: 'Study level must be a string' },
        { status: 400 }
      );
    }
    
    // Validate student profile if provided
    if (studentProfile && typeof studentProfile !== 'object') {
      return NextResponse.json(
        { error: 'Student profile must be an object' },
        { status: 400 }
      );
    }
    
    // Create Supabase client and check authentication
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    // Task 17.1 - Allow anonymous users (logged-out users)
    let userId: string | null = null;
    let ipAddress: string | null = null;
    
    if (user) {
      // Authenticated user flow
      userId = user.id;
      
      // Task 8.8 - Apply rate limiting (10 requests/minute per user)
      const rateLimitResponse = applyRateLimit(
        courseSearchSessionLimiter,
        user.id,
        'course search'
      );
      if (rateLimitResponse) return rateLimitResponse;
      
      // Task 8.2 - Check entitlements and usage limits
      const entitlementCheck = await canCreateCourseSearchSession(user.id);
      
      if (!entitlementCheck.allowed) {
        return NextResponse.json(
          {
            allowed: false,
            usage: entitlementCheck.usage,
            upgradeRequired: entitlementCheck.upgradeRequired,
            error: entitlementCheck.reason,
            message: entitlementCheck.reason,
          },
          { status: 403 }
        );
      }
    } else {
      // Anonymous user flow - Task 17.1
      // Extract IP address from request headers
      const forwardedFor = request.headers.get('x-forwarded-for');
      const realIp = request.headers.get('x-real-ip');
      ipAddress = forwardedFor?.split(',')[0].trim() || realIp || 'unknown';
      
      // Apply IP-based rate limiting (5 searches per hour for anonymous users)
      // Note: Using a more restrictive limit for anonymous users than authenticated (3/month)
      const rateLimitKey = `anon-search:${ipAddress}`;
      const rateLimitResponse = applyRateLimit(
        courseSearchSessionLimiter,
        rateLimitKey,
        'course search'
      );
      if (rateLimitResponse) {
        // Customize error message for anonymous users
        return NextResponse.json(
          { 
            error: 'Rate limit exceeded. Sign in for more searches.',
            message: 'Rate limit exceeded. Sign in for more searches.',
            ipAddress: ipAddress === 'unknown' ? undefined : ipAddress,
          },
          { status: 429 }
        );
      }
    }
    
    // Task 8.3 - Create session record with status='processing'
    // This ensures failed searches are tracked for debugging
    // Task 17.1 - user_id is nullable for anonymous users
    const { data: session, error: sessionError } = await supabase
      .from('course_search_sessions')
      .insert({
        user_id: userId, // Can be null for anonymous users
        university_id: universityId,
        query: query.trim(),
        study_level: studyLevel || null,
        student_profile_snapshot: studentProfile || null,
        status: 'processing',
      })
      .select('id')
      .single();
    
    if (sessionError || !session) {
      console.error('Failed to create course search session:', sessionError);
      return NextResponse.json(
        { 
          error: 'Failed to create search session',
          message: 'Unable to start your search. Please try again.',
        },
        { status: 500 }
      );
    }
    
    sessionId = session.id; // Assign to function-scoped variable
    
    // Synchronous search budget. Comfortably exceeds Tavily (5s) + AI ranking
    // (15s) + DB writes; well within the 60s Vercel Pro function limit.
    const SEARCH_TIMEOUT_MS = 30000;
    
    try {
      // Create a promise that rejects after timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('SEARCH_TIMEOUT'));
        }, SEARCH_TIMEOUT_MS);
      });
      
      // Create the actual search promise
      const searchPromise = (async () => {
        const results: any[] = [];
        let usedWebSearch = false;
        
        // Task 8.4 - Check cached courses first
        const cachedResults = await searchCachedCourses({
          query: query.trim(),
          universityId,
          studyLevel: studyLevel || undefined,
          maxResults: 10,
        });
        
        // Add cached results to final results
        results.push(...cachedResults.results.map(r => ({
          universityId: r.universityId,
          courseName: r.courseName,
          courseUrl: r.courseUrl,
          sourceDomain: r.sourceDomain,
          snippet: r.snippet,
          degreeLevel: r.degreeLevel,
          duration: r.duration,
          tuitionFeeText: r.tuitionFeeText,
          confidenceLabel: r.confidenceLabel,
          sourceConfidence: r.sourceConfidence,
          rank: r.rank,
          sourceType: 'cached' as const,
        })));
        
        // Task 8.5 - Execute AI search if insufficient cached results
        if (!cachedResults.sufficientResults) {
          // Fetch university info for a domain-restricted ("site:") web search.
          // Try to read primary_domain; tolerate the column not existing yet so
          // an un-migrated DB still works (just without domain restriction).
          const adminSupabase = createAdminClient();
          let universityName: string | null = null;
          let primaryDomain: string | undefined = undefined;
          let courseDiscoveryUrl: string | undefined = undefined;

          const withDomain = await adminSupabase
            .from('universities')
            .select('name, primary_domain, course_discovery_url')
            .eq('id', universityId)
            .single();

          if (!withDomain.error && withDomain.data) {
            universityName = withDomain.data.name;
            primaryDomain = withDomain.data.primary_domain || undefined;
            courseDiscoveryUrl = withDomain.data.course_discovery_url || undefined;
          } else {
            // Column may not exist yet — fall back to name only.
            const nameOnly = await adminSupabase
              .from('universities')
              .select('name')
              .eq('id', universityId)
              .single();
            universityName = nameOnly.data?.name ?? null;
          }
          
          if (universityName) {
            try {
              // Task 26.2: Graceful degradation if provider unavailable
              const searchProvider = getSearchProvider();
              
              const webResults = await searchProvider.search({
                query: query.trim(),
                universityName,
                primaryDomain,
                courseDiscoveryUrl,
                maxResults: 10,
                studyLevel: studyLevel || undefined,
              });
              
              // Transform web results to session result format
              const webResultsFormatted = webResults.map((r, index) => ({
                universityId,
                courseName: r.title,
                courseUrl: r.url,
                sourceDomain: r.domain,
                snippet: r.snippet || null,
                degreeLevel: r.degreeLevel || null,
                duration: r.duration || null,
                tuitionFeeText: r.tuitionFee || null,
                confidenceLabel: getConfidenceLabelFromScore(r.confidence || 0.7),
                sourceConfidence: r.confidence || 0.7,
                rank: cachedResults.results.length + index + 1,
                sourceType: 'web' as const,
              }));
              
              results.push(...webResultsFormatted);
              usedWebSearch = true;
              
            } catch (searchError) {
              // Task 26.2: Log warning and gracefully degrade to cached results
              console.warn('[Course Search] Web search failed, falling back to cached results only:', {
                error: searchError instanceof Error ? searchError.message : String(searchError),
                universityId,
                query: query.trim(),
                fallback: 'Using cached results + manual paste option',
              });
              
              // Continue with cached results only - graceful degradation
              // User will see cached results and can use manual paste fallback
            }
          }
        }
        
        // Combine and deduplicate results by normalized URL
        const uniqueResults = deduplicateResultsByUrl(results);
        
        // Take top 5-10 results
        const finalResults = uniqueResults.slice(0, 10);
        
        // Task 8.6 - Store results and update session status
        // Store cached results
        if (cachedResults.results.length > 0) {
          await storeCachedResults(sessionId!, cachedResults.results);
        }
        
        // Store web search results
        if (usedWebSearch) {
          const webResultsToStore = finalResults.filter(r => r.sourceType === 'web');
          if (webResultsToStore.length > 0) {
            await storeWebSearchResults(sessionId!, webResultsToStore);
          }
        }
        
        const adminSupabase = createAdminClient();

        // Re-fetch the stored result rows so the response carries their DB ids.
        // The frontend passes these ids to /api/apply-shortlist/add-courses,
        // which looks them up by (session_id, id) — without real ids the add
        // request fails Zod validation with a 400 "Invalid request".
        const { data: storedRows } = await adminSupabase
          .from('course_search_session_results')
          .select('*')
          .eq('session_id', sessionId)
          .order('rank', { ascending: true });

        const storedResults: CourseSearchResult[] = (storedRows || []).map((row) => ({
          id: row.id,
          universityId: row.university_id,
          courseName: row.course_name,
          courseUrl: row.course_url,
          sourceDomain: row.source_domain,
          snippet: row.snippet,
          degreeLevel: row.degree_level,
          duration: row.duration,
          tuitionFeeText: row.tuition_fee_text,
          confidenceLabel: row.confidence_label,
          sourceConfidence: row.source_confidence,
          rank: row.rank,
          sourceType: row.source_type,
        }));
        
        // Update session status to complete
        await adminSupabase
          .from('course_search_sessions')
          .update({
            status: 'complete',
            result_count: storedResults.length,
            completed_at: new Date().toISOString(),
            provider_name: usedWebSearch ? 'tavily' : null,
            search_strategy: usedWebSearch ? 'cached+web' : 'cached',
          })
          .eq('id', sessionId);
        
        // Task 8.7 - Return response with usage state and handle zero results
        // Note: Only complete sessions count toward usage quota
        // Fetch updated usage state after session completion to include this search
        // Task 17.1 - For anonymous users, return default/null usage data
        let usageData;
        if (userId) {
          const updatedUsage = await getUserEntitlement(userId);
          usageData = {
            courseSearchesUsed: updatedUsage.courseSearchesUsed,
            courseSearchLimit: updatedUsage.courseSearchLimit,
            coursesAdded: updatedUsage.coursesAdded,
            courseAddLimit: updatedUsage.courseAddLimit,
            plan: updatedUsage.plan,
          };
        } else {
          // Anonymous user - no usage tracking
          usageData = {
            courseSearchesUsed: 0,
            courseSearchLimit: 5, // Anonymous users have 5 searches per hour (rate limit)
            coursesAdded: 0,
            courseAddLimit: 0, // Must sign in to add courses
            plan: 'free' as const,
          };
        }
        
        // Zero-results handling (result_count = 0):
        // Frontend should check if results.length === 0 and display:
        // - Message: "We couldn't find reliable course options from the official university site"
        // - Action buttons: 
        //   * "Open official course directory" (links to university's course page)
        //   * "Paste course URL manually" (opens manual paste dialog)
        // 
        // The usage state is always included so the UI can:
        // - Display remaining quota (e.g., "2 of 3 searches used this month")
        // - Show upgrade prompt if quota exhausted
        // - Update usage counter in navigation/header
        return {
          sessionId,
          status: 'complete' as const,
          results: storedResults,
          usage: usageData,
        };
      })();
      
      // Race between search and timeout
      const result = await Promise.race([searchPromise, timeoutPromise]);
      
      return NextResponse.json(result, { status: 201 });
    } catch (error) {
      // Handle timeout
      if (error instanceof Error && error.message === 'SEARCH_TIMEOUT') {
        // Task 8.3 & 8.6 - Mark session as failed with error_code='SEARCH_TIMEOUT'
        await supabase
          .from('course_search_sessions')
          .update({
            status: 'failed',
            error_code: 'SEARCH_TIMEOUT',
            updated_at: new Date().toISOString(),
          })
          .eq('id', sessionId);
        
        return NextResponse.json(
          {
            error: 'Search timeout',
            message: 'The search took longer than expected. Please try again.',
            errorCode: 'SEARCH_TIMEOUT',
            recoverable: true,
          },
          { status: 408 }
        );
      }
      
      throw error; // Re-throw other errors to be caught by outer handler
    }
  } catch (error) {
    console.error('Unexpected error in POST /api/course-search-sessions:', error);
    
    // Check if this is a JSON parsing error
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }
    
    // Task 8.6 - If we have a sessionId, mark the session as failed
    // This can happen if the session was created but an unexpected error occurred during search
    // Note: sessionId might not be defined if error happened before session creation
    if (typeof sessionId !== 'undefined') {
      try {
        const supabase = await createClient();
        await supabase
          .from('course_search_sessions')
          .update({
            status: 'failed',
            error_code: 'SYSTEM_ERROR',
            error_message: error instanceof Error ? error.message : 'Unknown error occurred',
            updated_at: new Date().toISOString(),
          })
          .eq('id', sessionId);
      } catch (updateError) {
        console.error('Failed to update session status to failed:', updateError);
        // Continue to return error response even if session update fails
      }
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Helper: Convert confidence score (0-1) to confidence label
 */
function getConfidenceLabelFromScore(score: number): ConfidenceLabel {
  if (score >= 0.9) {
    return 'Checked recently';
  } else if (score >= 0.7) {
    return 'Good match';
  } else {
    return 'Needs review';
  }
}

/**
 * Helper: Normalize URL for deduplication
 * - Remove tracking parameters (utm_*, fbclid, etc.)
 * - Normalize trailing slashes
 * - Lowercase host
 */
function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    
    // Lowercase the host
    urlObj.hostname = urlObj.hostname.toLowerCase();
    
    // Remove tracking parameters
    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
      'fbclid', 'gclid', 'msclkid', '_ga', 'mc_cid', 'mc_eid'
    ];
    
    trackingParams.forEach(param => {
      urlObj.searchParams.delete(param);
    });
    
    // Normalize path (remove trailing slash if not root)
    let path = urlObj.pathname;
    if (path.length > 1 && path.endsWith('/')) {
      path = path.slice(0, -1);
    }
    urlObj.pathname = path;
    
    return urlObj.toString();
  } catch {
    // If URL parsing fails, return original
    return url.toLowerCase().trim();
  }
}

/**
 * Helper: Deduplicate results by normalized URL
 * Keeps the first occurrence of each unique URL
 */
function deduplicateResultsByUrl(results: any[]): any[] {
  const seen = new Set<string>();
  const unique: any[] = [];
  
  for (const result of results) {
    const normalized = normalizeUrl(result.courseUrl);
    
    if (!seen.has(normalized)) {
      seen.add(normalized);
      unique.push(result);
    }
  }
  
  return unique;
}

/**
 * Helper: Store web search results in course_search_session_results table
 */
async function storeWebSearchResults(
  sessionId: string,
  results: any[]
): Promise<boolean> {
  const supabase = createAdminClient();
  
  try {
    // Transform results to database format
    const resultRecords = results.map((result) => ({
      session_id: sessionId,
      university_id: result.universityId,
      course_name: result.courseName,
      course_url: result.courseUrl,
      source_domain: result.sourceDomain,
      snippet: result.snippet,
      degree_level: result.degreeLevel,
      duration: result.duration,
      tuition_fee_text: result.tuitionFeeText,
      confidence_label: result.confidenceLabel,
      source_confidence: result.sourceConfidence,
      rank: result.rank,
      source_type: 'web',
      raw_search_result: {
        searchRank: result.rank,
      },
    }));
    
    const { error } = await supabase
      .from('course_search_session_results')
      .insert(resultRecords);
    
    if (error) {
      console.error('Error storing web search results:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Unexpected error in storeWebSearchResults:', error);
    return false;
  }
}
