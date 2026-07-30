/**
 * Cached Course Search Service
 * 
 * Task 8.4: Check cached courses first
 * Task 21.1: Handle stale cached courses in search results ✅ (already implemented)
 * Task 21.2: Optimize search_keywords population (integrated with search)
 * 
 * Implements cache-first search strategy:
 * 1. Query courses table using full-text search on course_name and related fields
 * 2. Filter by university_id
 * 3. If results.length >= 5: Use cached results, apply freshness labels
 * 4. If cached results are stale (last_extracted_at > 30 days), label as 'Needs refresh'
 * 5. Set source_type = 'cached' for cached results
 */

import { createAdminClient } from '@/lib/supabase/admin';
import type { Course } from '@/lib/apply-types';

/**
 * Confidence labels for search results
 * Based on cache freshness and data completeness
 */
export type ConfidenceLabel = 'Checked recently' | 'Good match' | 'Needs review' | 'Needs refresh';

/**
 * Search result format - normalized for frontend consumption
 */
export interface CachedSearchResult {
  id: string;
  universityId: number | null;
  courseName: string;
  courseUrl: string;
  sourceDomain: string | null;
  snippet: string | null;
  degreeLevel: string | null;
  duration: string | null;
  tuitionFeeText: string | null;
  confidenceLabel: ConfidenceLabel;
  sourceConfidence: number;
  sourceType: 'cached';
  lastExtractedAt: string | null;
  rank: number;
}

/**
 * Parameters for cached course search
 */
export interface CachedSearchParams {
  query: string;
  universityId: number;
  studyLevel?: string;
  maxResults?: number;
}

/**
 * Result of cached search operation
 */
export interface CachedSearchResult_Response {
  results: CachedSearchResult[];
  usedCache: boolean;
  sufficientResults: boolean; // true if >= 5 results found
}

/**
 * Check if cached data is stale (> 30 days old)
 */
function isCacheStale(lastExtractedAt: string | null): boolean {
  if (!lastExtractedAt) return true;
  
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const extractedDate = new Date(lastExtractedAt);
  return extractedDate < thirtyDaysAgo;
}

/**
 * Determine confidence label based on cache freshness and source confidence
 */
function getConfidenceLabel(
  sourceConfidence: number,
  lastExtractedAt: string | null
): ConfidenceLabel {
  const isStale = isCacheStale(lastExtractedAt);
  
  // Stale data always needs refresh
  if (isStale) {
    return 'Needs refresh';
  }
  
  // Fresh data with high confidence
  if (sourceConfidence >= 0.9) {
    return 'Checked recently';
  }
  
  // Fresh data with medium confidence
  if (sourceConfidence >= 0.7) {
    return 'Good match';
  }
  
  // Fresh data with low confidence
  return 'Needs review';
}

/**
 * Extract domain from course URL
 */
function extractDomain(url: string): string | null {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return null;
  }
}

/**
 * Generate a snippet from available course data
 */
function generateSnippet(course: Partial<Course>): string {
  const parts: string[] = [];
  
  if (course.degreeLevel) {
    parts.push(course.degreeLevel);
  }
  
  if (course.duration) {
    parts.push(course.duration);
  }
  
  if (course.studyMode) {
    parts.push(course.studyMode);
  }
  
  if (course.subject) {
    parts.push(`in ${course.subject}`);
  }
  
  if (course.entryRequirementsSummary && course.entryRequirementsSummary.length > 0) {
    const summary = course.entryRequirementsSummary.slice(0, 100);
    parts.push(summary + (course.entryRequirementsSummary.length > 100 ? '...' : ''));
  }
  
  return parts.join(' • ') || 'Course details available';
}

/**
 * Search cached courses using full-text search
 * 
 * This function queries the courses table to find cached results that match:
 * - The search query (using ILIKE pattern matching on course_name)
 * - The specified university_id
 * - Optional study level filter
 * 
 * Returns up to maxResults courses, ordered by source confidence and last extraction date.
 * 
 * @param params - Search parameters (query, universityId, studyLevel, maxResults)
 * @returns CachedSearchResult_Response with results and metadata
 */
export async function searchCachedCourses(
  params: CachedSearchParams
): Promise<CachedSearchResult_Response> {
  const { query, universityId, studyLevel, maxResults = 10 } = params;
  
  const supabase = createAdminClient();
  
  try {
    // Build the search query
    // We use ILIKE for case-insensitive pattern matching on course_name
    // This is simpler than full-text search and works well for course names
    const searchPattern = `%${query.trim()}%`;
    
    let queryBuilder = supabase
      .from('courses')
      .select('*')
      .eq('university_id', universityId)
      .eq('extraction_status', 'extracted')
      .ilike('course_name', searchPattern);
    
    // Filter by study level if provided
    if (studyLevel) {
      queryBuilder = queryBuilder.ilike('degree_level', `%${studyLevel}%`);
    }
    
    // Order by confidence and freshness
    // Prioritize recently extracted courses with high confidence
    queryBuilder = queryBuilder
      .order('source_confidence', { ascending: false })
      .order('last_extracted_at', { ascending: false, nullsFirst: false })
      .limit(maxResults);
    
    const { data: courses, error } = await queryBuilder;
    
    if (error) {
      console.error('Error searching cached courses:', error);
      return {
        results: [],
        usedCache: false,
        sufficientResults: false,
      };
    }
    
    if (!courses || courses.length === 0) {
      return {
        results: [],
        usedCache: false,
        sufficientResults: false,
      };
    }
    
    // Transform database results to normalized search results
    const results: CachedSearchResult[] = courses.map((course, index) => ({
      id: course.id,
      universityId: course.university_id,
      courseName: course.course_name,
      courseUrl: course.course_url,
      sourceDomain: extractDomain(course.course_url),
      snippet: generateSnippet(course),
      degreeLevel: course.degree_level || null,
      duration: course.duration || null,
      tuitionFeeText: course.tuition_fee_text || null,
      confidenceLabel: getConfidenceLabel(
        course.source_confidence || 0.7,
        course.last_extracted_at
      ),
      sourceConfidence: course.source_confidence || 0.7,
      sourceType: 'cached',
      lastExtractedAt: course.last_extracted_at || null,
      rank: index + 1,
    }));
    
    const sufficientResults = results.length >= 5;
    
    return {
      results,
      usedCache: true,
      sufficientResults,
    };
  } catch (error) {
    console.error('Unexpected error in searchCachedCourses:', error);
    return {
      results: [],
      usedCache: false,
      sufficientResults: false,
    };
  }
}

/**
 * Store cached search results in course_search_session_results table
 * 
 * This function creates result records linked to the search session.
 * Each result has source_type='cached' and includes freshness labels.
 * 
 * @param sessionId - The search session ID to link results to
 * @param results - Array of cached search results to store
 * @returns Promise<boolean> - true if storage succeeded, false otherwise
 */
export async function storeCachedResults(
  sessionId: string,
  results: CachedSearchResult[]
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
      source_type: 'cached',
      raw_search_result: {
        id: result.id,
        lastExtractedAt: result.lastExtractedAt,
        searchRank: result.rank,
      },
    }));
    
    const { error } = await supabase
      .from('course_search_session_results')
      .insert(resultRecords);
    
    if (error) {
      console.error('Error storing cached results:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Unexpected error in storeCachedResults:', error);
    return false;
  }
}
