/**
 * URL Validation Utilities for Course Applications
 * 
 * Task 13.5: Validate course URLs before creating applications
 * 
 * Provides lightweight validation for course URLs to ensure:
 * - URL is accessible (HEAD request)
 * - Domain matches expected university domain
 * - Not an obvious non-course page (PDF, news, blog, etc.)
 */

export interface URLValidationResult {
  isValid: boolean;
  reason?: string;
}

/**
 * Validate a course URL with lightweight checks
 * 
 * @param courseUrl - The course URL to validate
 * @param expectedDomain - The expected university domain (e.g., 'ox.ac.uk', 'stanford.edu')
 * @returns Promise<URLValidationResult> - Validation result with reason if invalid
 */
export async function validateCourseUrl(
  courseUrl: string,
  expectedDomain: string | null
): Promise<URLValidationResult> {
  // Step 1: Parse URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(courseUrl);
  } catch {
    return {
      isValid: false,
      reason: 'Invalid URL format',
    };
  }

  // Step 2: Check for non-course page patterns
  const pathname = parsedUrl.pathname.toLowerCase();
  const hostname = parsedUrl.hostname.toLowerCase();

  // Check for obvious non-course pages
  const nonCoursePatterns = [
    /\.pdf$/i,                    // PDF files
    /\/news\//i,                  // News pages
    /\/blog\//i,                  // Blog pages
    /\/directory\//i,             // Directory listings
    /\/index\//i,                 // Index pages
    /\/events\//i,                // Event pages
    /\/calendar\//i,              // Calendar pages
    /\/staff\//i,                 // Staff pages
    /\/people\//i,                // People pages
    /\/research-groups\//i,       // Research group pages
  ];

  for (const pattern of nonCoursePatterns) {
    if (pattern.test(pathname)) {
      return {
        isValid: false,
        reason: `URL appears to be a ${pattern.source.replace(/[\/\\]/g, '')} page, not a course page`,
      };
    }
  }

  // Step 3: Validate domain matches expected university domain
  if (expectedDomain) {
    const normalizedExpectedDomain = expectedDomain.toLowerCase().trim();
    
    // Check if hostname matches expected domain (exact match or subdomain)
    // Examples:
    // - 'ox.ac.uk' matches 'ox.ac.uk' ✓
    // - 'www.ox.ac.uk' matches 'ox.ac.uk' ✓
    // - 'notox.ac.uk' does NOT match 'ox.ac.uk' ✗
    const isExactMatch = hostname === normalizedExpectedDomain;
    const isSubdomain = hostname.endsWith(`.${normalizedExpectedDomain}`);
    
    if (!isExactMatch && !isSubdomain) {
      return {
        isValid: false,
        reason: `Domain '${hostname}' does not match expected university domain '${normalizedExpectedDomain}'`,
      };
    }
  }

  // Step 4: Check URL accessibility with HEAD request (lightweight)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch(courseUrl, {
      method: 'HEAD',
      signal: controller.signal,
      // Don't follow redirects to avoid performance issues
      redirect: 'manual',
    });

    clearTimeout(timeoutId);

    // Accept 2xx and 3xx status codes (redirects are OK)
    if (response.ok || (response.status >= 300 && response.status < 400)) {
      return { isValid: true };
    }

    return {
      isValid: false,
      reason: `URL returned HTTP status ${response.status}`,
    };
  } catch (error) {
    // Network errors, timeouts, etc.
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return {
          isValid: false,
          reason: 'URL request timed out (>5s)',
        };
      }
      return {
        isValid: false,
        reason: `URL is not accessible: ${error.message}`,
      };
    }
    return {
      isValid: false,
      reason: 'URL is not accessible',
    };
  }
}

/**
 * Batch validate multiple course URLs
 * 
 * @param courses - Array of courses with course_url to validate
 * @param expectedDomain - The expected university domain
 * @returns Promise with valid and invalid course arrays
 */
export async function batchValidateCourseUrls<T extends { course_url: string; course_name: string }>(
  courses: T[],
  expectedDomain: string | null
): Promise<{
  valid: T[];
  invalid: Array<{ course: T; reason: string }>;
}> {
  const validationPromises = courses.map(async (course) => {
    const result = await validateCourseUrl(course.course_url, expectedDomain);
    return { course, result };
  });

  const results = await Promise.all(validationPromises);

  const valid: T[] = [];
  const invalid: Array<{ course: T; reason: string }> = [];

  for (const { course, result } of results) {
    if (result.isValid) {
      valid.push(course);
    } else {
      invalid.push({ course, reason: result.reason || 'Unknown validation error' });
    }
  }

  return { valid, invalid };
}
