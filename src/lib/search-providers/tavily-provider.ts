/**
 * Tavily Search Provider
 * 
 * Task 3.2: Implement TavilySearchProvider with AI ranking and quality filtering
 * 
 * This provider uses Tavily's search API for course discovery with:
 * - Domain-restricted search prioritizing site:{primaryDomain}
 * - AI-powered ranking using OpenAI for quality filtering
 * - URL normalization and deduplication
 * - Adaptive result count (5-10 based on quality, fewer if insufficient)
 * - Quality filtering (rejects third-party directories, PDFs, news pages)
 */

import type { SearchProvider, SearchParams, SearchResult } from './search-provider-interface';
import { constructSearchQuery, extractDomain, normalizeUrl, validateDomain } from './search-provider-interface';
import { openai, isOpenAIConfigured } from '@/lib/ai/openai-client';
import { z } from 'zod';

/**
 * Tavily API response types
 */
interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

interface TavilyResponse {
  results: TavilySearchResult[];
  query: string;
}

/**
 * Blacklisted domains - third-party course directories and non-official sites
 */
const BLACKLISTED_DOMAINS = [
  'findauniversity.com',
  'whatuni.com',
  'thecompleteuniversityguide.co.uk',
  'theuniguide.co.uk',
  'topuniversities.com',
  'timeshighereducation.com',
  'usnews.com',
  'collegedunia.com',
  'studyportals.com',
  'mastersportal.com',
  'bachelorsportal.com',
  'phdportal.com',
  'scholarships.com',
  'collegevine.com',
  'niche.com',
];

/**
 * AI ranking schema for structured output
 */
const RankedResultSchema = z.object({
  title: z.string().describe('The course name/title'),
  url: z.string().url().describe('The official course page URL'),
  snippet: z.string().nullable().optional().describe('Brief description of the course'),
  degreeLevel: z.string().nullable().optional().describe('Degree level (e.g., Bachelor, Master, PhD)'),
  duration: z.string().nullable().optional().describe('Course duration (e.g., 3 years, 2 years)'),
  tuitionFee: z.string().nullable().optional().describe('Tuition fee if mentioned (e.g., $50,000/year)'),
  confidence: z.number().min(0).max(1).describe('Confidence score 0.0-1.0'),
  rejected: z.boolean().nullable().optional().describe('True if this result should be rejected'),
  rejectionReason: z.string().nullable().optional().describe('Reason for rejection if applicable'),
});

const AIRankingResponseSchema = z.object({
  rankedResults: z.array(RankedResultSchema).describe('Top course results ranked by quality'),
});

type AIRankingResponse = z.infer<typeof AIRankingResponseSchema>;

/**
 * Tavily Search Provider
 */
export class TavilySearchProvider implements SearchProvider {
  name = 'tavily' as const;
  
  private apiKey: string;
  private tavilyTimeout = 5000; // 5s Tavily timeout
  private aiTimeout = 15000; // 15s OpenAI ranking timeout (bounded so it can't hang the request)
  
  constructor() {
    this.apiKey = process.env.TAVILY_API_KEY || '';
    
    if (!this.apiKey) {
      console.warn('TAVILY_API_KEY not configured. Search will fail.');
    }
  }
  
  /**
   * Execute course search with AI ranking and quality filtering
   */
  async search(params: SearchParams): Promise<SearchResult[]> {
    try {
      // Step 1: Execute Tavily search
      const tavilyResults = await this.executeTavilySearch(params);
      
      if (tavilyResults.length === 0) {
        return [];
      }
      
      // Step 2: Filter out blacklisted domains
      const filteredResults = this.filterOfficialResults(tavilyResults, params.primaryDomain);
      
      if (filteredResults.length === 0) {
        return [];
      }
      
      // Step 3: Rank/clean results.
      // AI ranking adds latency (an OpenAI call) that doesn't fit within
      // Vercel Hobby's 10s function limit, so it's opt-in via ENABLE_AI_RANKING.
      // When disabled (default), we use Tavily's own relevance scoring after
      // the quality filtering above — fast and reliable.
      const useAiRanking =
        process.env.ENABLE_AI_RANKING === 'true' && isOpenAIConfigured();

      const rankedResults = useAiRanking
        ? await this.rankWithAI(filteredResults, params)
        : this.simpleRank(filteredResults);
      
      // Step 4: Deduplicate by normalized URL
      const deduplicatedResults = this.deduplicateResults(rankedResults);
      
      // Step 5: Return 5-10 results or fewer if insufficient quality
      return deduplicatedResults;
      
    } catch (error) {
      console.error('Tavily search failed:', error);
      return []; // Graceful failure - return empty array
    }
  }

  /**
   * Convert filtered Tavily results into SearchResult[] using Tavily's own
   * relevance score (no AI call). Used when AI ranking is disabled.
   */
  private simpleRank(results: TavilySearchResult[]): SearchResult[] {
    return results.slice(0, 10).map(r => ({
      title: r.title,
      url: r.url,
      snippet: r.content ? r.content.slice(0, 200) : undefined,
      domain: extractDomain(r.url) || '',
      confidence: Math.min(r.score ?? 0.7, 1.0),
    }));
  }
  
  /**
   * Execute Tavily API search with timeout
   */
  private async executeTavilySearch(params: SearchParams): Promise<TavilySearchResult[]> {
    const searchQuery = constructSearchQuery(
      params.query,
      params.universityName,
      params.primaryDomain
    );
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.tavilyTimeout);
    
    try {
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          query: searchQuery,
          search_depth: 'basic',
          max_results: 10, // Enough for AI filtering while keeping ranking fast
          include_answer: false,
          include_domains: params.primaryDomain ? [params.primaryDomain] : undefined,
        }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Tavily API error: ${response.status}`);
      }
      
      const data: TavilyResponse = await response.json();
      return data.results || [];
      
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Tavily search timeout');
      }
      
      throw error;
    }
  }
  
  /**
   * Filter out blacklisted domains and non-official results
   */
  private filterOfficialResults(
    results: TavilySearchResult[],
    primaryDomain?: string
  ): TavilySearchResult[] {
    return results.filter(result => {
      const domain = extractDomain(result.url);
      if (!domain) return false;
      
      // Reject blacklisted third-party directories
      const isBlacklisted = BLACKLISTED_DOMAINS.some(blocked => 
        domain.includes(blocked)
      );
      
      if (isBlacklisted) return false;
      
      // Reject PDFs unless from official domain
      const isPdf = result.url.toLowerCase().endsWith('.pdf');
      if (isPdf && primaryDomain && !validateDomain(result.url, primaryDomain)) {
        return false;
      }
      
      // Reject news pages
      const isNewsPage = result.url.includes('/news/') || result.url.includes('/blog/');
      if (isNewsPage) return false;
      
      return true;
    });
  }
  
  /**
   * Use AI to rank and filter results with quality assessment
   */
  private async rankWithAI(
    results: TavilySearchResult[],
    params: SearchParams
  ): Promise<SearchResult[]> {
    try {
      const systemPrompt = `You are an expert at identifying official university course pages.
      
Your task: Rank and filter search results to find genuine course pages for "${params.universityName}".

STRICT QUALITY RULES:
1. ONLY official course pages from the university website
2. Do NOT include:
   - Third-party course directories
   - News articles or blog posts
   - General department pages without specific course info
   - Scholarship-only pages
   - Pages from other universities
3. Extract degree level, duration, tuition fee ONLY if clearly present
4. Do NOT guess or infer fields - leave them undefined if not found
5. Set confidence based on:
   - 0.9-1.0: Clear official course page with structured data
   - 0.7-0.9: Official course page with some data
   - 0.5-0.7: Likely course page but missing key fields
   - <0.5: Uncertain, should be rejected
6. Return 5-10 high-quality results. If fewer than 5 good matches, return fewer.
7. Do NOT pad with weak results just to reach 5.`;

      const userPrompt = `University: ${params.universityName}
Primary Domain: ${params.primaryDomain || 'N/A'}
Search Query: "${params.query}"
${params.studyLevel ? `Study Level: ${params.studyLevel}` : ''}

Search Results to Rank:
${results.map((r, i) => `${i + 1}. ${r.title}\n   URL: ${r.url}\n   Snippet: ${r.content.slice(0, 200)}...`).join('\n\n')}

Return the TOP 5-10 results that are genuine official course pages, ranked by quality and relevance.
Reject results that don't meet quality standards. Better to return 3 great results than 10 mediocre ones.`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_schema', json_schema: {
          name: 'course_ranking',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              rankedResults: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    url: { type: 'string' },
                    snippet: { type: ['string', 'null'] },
                    degreeLevel: { type: ['string', 'null'] },
                    duration: { type: ['string', 'null'] },
                    tuitionFee: { type: ['string', 'null'] },
                    confidence: { type: 'number' },
                    rejected: { type: 'boolean' },
                    rejectionReason: { type: ['string', 'null'] },
                  },
                  // OpenAI strict mode requires every property to be listed in
                  // `required`; optional fields are expressed as nullable above.
                  required: [
                    'title',
                    'url',
                    'snippet',
                    'degreeLevel',
                    'duration',
                    'tuitionFee',
                    'confidence',
                    'rejected',
                    'rejectionReason',
                  ],
                  additionalProperties: false,
                },
              },
            },
            required: ['rankedResults'],
            additionalProperties: false,
          },
        }},
      }, {
        timeout: this.aiTimeout,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content in AI response');
      }

      const parsed: AIRankingResponse = JSON.parse(content);
      
      // Filter out rejected results and convert to SearchResult format
      return parsed.rankedResults
        .filter(r => !r.rejected && r.confidence >= 0.5)
        .map(r => ({
          title: r.title,
          url: r.url,
          snippet: r.snippet ?? undefined,
          domain: extractDomain(r.url) || '',
          degreeLevel: r.degreeLevel ?? undefined,
          duration: r.duration ?? undefined,
          tuitionFee: r.tuitionFee ?? undefined,
          confidence: r.confidence,
        }));
      
    } catch (error) {
      console.error('AI ranking failed, falling back to simple ranking:', error);
      
      // Fallback: Simple ranking by Tavily score
      return results.slice(0, 10).map(r => ({
        title: r.title,
        url: r.url,
        snippet: r.content.slice(0, 200),
        domain: extractDomain(r.url) || '',
        confidence: Math.min(r.score, 1.0),
      }));
    }
  }
  
  /**
   * Deduplicate results by normalized URL
   */
  private deduplicateResults(results: SearchResult[]): SearchResult[] {
    const seen = new Set<string>();
    const deduplicated: SearchResult[] = [];
    
    for (const result of results) {
      const normalized = normalizeUrl(result.url);
      
      if (!seen.has(normalized)) {
        seen.add(normalized);
        deduplicated.push(result);
      }
    }
    
    return deduplicated;
  }
}
