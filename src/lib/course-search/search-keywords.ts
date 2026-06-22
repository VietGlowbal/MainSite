/**
 * Search Keywords Generation Utility
 * 
 * Task 21.2: Optimize search_keywords population
 * 
 * Generates tokenized search keywords for course full-text search.
 * Tokenizes course_name, subject, and degree_level fields.
 * Removes common stop words to improve search relevance.
 */

/**
 * Common English stop words to exclude from search keywords
 */
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he',
  'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'will', 'with',
  'this', 'but', 'they', 'have', 'had', 'what', 'when', 'where', 'who', 'which',
  'their', 'said', 'would', 'do', 'there', 'been', 'his', 'her', 'or', 'can', 'all',
]);

/**
 * Tokenize a string into search keywords
 * 
 * Process:
 * 1. Lowercase the string
 * 2. Remove punctuation and special characters
 * 3. Split on whitespace
 * 4. Remove stop words
 * 5. Remove duplicates
 * 6. Filter out tokens shorter than 2 characters
 * 
 * @param text - The text to tokenize
 * @returns Array of unique search keywords
 */
function tokenizeText(text: string): string[] {
  if (!text) return [];
  
  // Lowercase and remove punctuation/special chars (keep alphanumeric and spaces)
  const cleaned = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim();
  
  if (!cleaned) return [];
  
  // Split on whitespace
  const tokens = cleaned.split(/\s+/);
  
  // Filter out stop words and short tokens, then deduplicate
  const keywords = new Set<string>();
  for (const token of tokens) {
    if (token.length >= 2 && !STOP_WORDS.has(token)) {
      keywords.add(token);
    }
  }
  
  return Array.from(keywords);
}

/**
 * Generate search keywords from course fields
 * 
 * Task 21.2: Auto-populate search_keywords on course insert/update
 * 
 * Combines keywords from:
 * - course_name (main field)
 * - subject (if available)
 * - degree_level (if available)
 * 
 * @param courseName - The course name (required)
 * @param subject - The subject field (optional)
 * @param degreeLevel - The degree level field (optional)
 * @returns Array of unique search keywords
 */
export function generateSearchKeywords(
  courseName: string,
  subject?: string | null,
  degreeLevel?: string | null
): string[] {
  const allKeywords = new Set<string>();
  
  // Tokenize course name
  const nameKeywords = tokenizeText(courseName);
  nameKeywords.forEach(kw => allKeywords.add(kw));
  
  // Tokenize subject if provided
  if (subject) {
    const subjectKeywords = tokenizeText(subject);
    subjectKeywords.forEach(kw => allKeywords.add(kw));
  }
  
  // Tokenize degree level if provided
  if (degreeLevel) {
    const levelKeywords = tokenizeText(degreeLevel);
    levelKeywords.forEach(kw => allKeywords.add(kw));
  }
  
  return Array.from(allKeywords).sort();
}

/**
 * Update course with generated search keywords
 * 
 * This function should be called whenever a course is created or updated.
 * It generates and returns the search_keywords array to be stored in the database.
 * 
 * @param course - Course object with course_name, subject, degree_level
 * @returns Object with search_keywords array
 */
export function prepareSearchKeywords(course: {
  course_name: string;
  subject?: string | null;
  degree_level?: string | null;
}): { search_keywords: string[] } {
  return {
    search_keywords: generateSearchKeywords(
      course.course_name,
      course.subject,
      course.degree_level
    ),
  };
}
