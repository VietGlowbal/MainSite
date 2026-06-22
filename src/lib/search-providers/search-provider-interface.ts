/**
 * Search Provider Interface
 * 
 * Task 3.2: Define SearchProvider interface and types
 * 
 * This module provides a common interface for course search providers,
 * allowing the system to be provider-agnostic and easily switch between
 * different search APIs (Tavily, SerpAPI, Bing, Exa, Firecrawl).
 */

/**
 * Parameters for executing a course search
 */
export interface SearchParams {
  /** The search query (e.g., "Computer Science") */
  query: string;
  
  /** University name for context (e.g., "Harvard University") */
  universityName: string;
  
  /** Primary domain for domain-restricted search (e.g., "harvard.edu") */
  primaryDomain?: string;
  
  /** Official course discovery URL if available */
  courseDiscoveryUrl?: string;
  
  /** Maximum number of results to return (5-10) */
  maxResults?: number;
  
  /** Study level filter (e.g., "undergraduate", "postgraduate") */
  studyLevel?: string;
}

/**
 * Normalized search result format
 * All providers must return this format
 */
export interface SearchResult {
  /** Course name/title */
  title: string;
  
  /** Official course page URL */
  url: string;
  
  /** Brief description/snippet */
  snippet?: string;
  
  /** Domain of the result (e.g., "harvard.edu") */
  domain: string;
  
  /** Degree level (e.g., "Bachelor", "Master") - extracted if available */
  degreeLevel?: string;
  
  /** Course duration (e.g., "3 years", "2 years") - extracted if available */
  duration?: string;
  
  /** Tuition fee text (e.g., "$50,000/year") - extracted if available */
  tuitionFee?: string;
  
  /** Confidence score from AI ranking (0.0 - 1.0) */
  confidence?: number;
}

/**
 * Common interface all search providers must implement
 */
export interface SearchProvider {
  /** Provider name (e.g., "tavily", "serpapi") */
  name: string;
  
  /**
   * Execute a course search
   * 
   * @param params - Search parameters
   * @returns Array of normalized search results (5-10 results, or fewer if quality insufficient)
   * @throws Error if search fails (caller should handle gracefully)
   */
  search(params: SearchParams): Promise<SearchResult[]>;
}

/**
 * Helper: Construct domain-restricted search query
 * 
 * Prioritizes site:{primaryDomain} when available for more accurate results.
 * Falls back to generic query with university name.
 * 
 * @param query - User's search query
 * @param universityName - Name of the university
 * @param primaryDomain - Primary domain (e.g., "harvard.edu")
 * @returns Formatted search query string
 */
export function constructSearchQuery(
  query: string,
  universityName: string,
  primaryDomain?: string
): string {
  const baseQuery = query.trim();
  
  if (primaryDomain) {
    // Domain-restricted search for official pages
    return `site:${primaryDomain} "${baseQuery}" course degree program`;
  }
  
  // Generic search with university context
  return `"${universityName}" "${baseQuery}" course degree program`;
}

/**
 * Helper: Extract domain from URL
 * 
 * @param url - Full URL string
 * @returns Domain (hostname) or null if invalid
 */
export function extractDomain(url: string): string | null {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return null;
  }
}

/**
 * Helper: Validate URL matches expected domain
 * 
 * @param url - Full URL string
 * @param expectedDomain - Expected domain (e.g., "harvard.edu")
 * @returns true if URL domain matches or is subdomain of expectedDomain
 */
export function validateDomain(url: string, expectedDomain: string): boolean {
  const domain = extractDomain(url);
  if (!domain) return false;
  
  // Normalize domains to lowercase
  const normalizedDomain = domain.toLowerCase();
  const normalizedExpected = expectedDomain.toLowerCase();
  
  // Check exact match or subdomain
  return (
    normalizedDomain === normalizedExpected ||
    normalizedDomain.endsWith(`.${normalizedExpected}`)
  );
}

/**
 * Helper: Normalize URL for deduplication
 * 
 * Removes tracking parameters, canonicalizes trailing slashes, lowercase host.
 * 
 * @param url - Full URL string
 * @returns Normalized URL string or original if parsing fails
 */
export function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    
    // Lowercase hostname
    urlObj.hostname = urlObj.hostname.toLowerCase();
    
    // Remove common tracking parameters
    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'fbclid', 'gclid', 'msclkid', 'mc_cid', 'mc_eid',
      '_ga', '_gl', 'ref', 'source'
    ];
    
    trackingParams.forEach(param => {
      urlObj.searchParams.delete(param);
    });
    
    // Canonicalize trailing slash in pathname
    if (urlObj.pathname.endsWith('/') && urlObj.pathname.length > 1) {
      urlObj.pathname = urlObj.pathname.slice(0, -1);
    }
    
    return urlObj.toString();
  } catch {
    return url; // Return original if parsing fails
  }
}
