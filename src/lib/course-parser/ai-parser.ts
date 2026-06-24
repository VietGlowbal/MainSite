/**
 * AI Course Page Parser
 *
 * Fetches an official course page and uses OpenAI to extract structured course
 * details (degree level, duration, tuition, deadline, summary). Returns null
 * fields for anything not clearly present — it never invents data.
 */

import { openai, isOpenAIConfigured } from '@/lib/ai/openai-client';

export interface ParsedCourse {
  courseName: string | null;
  degreeLevel: string | null;
  studyMode: string | null;
  duration: string | null;
  tuitionFeeText: string | null;
  deadline: string | null; // ISO date (YYYY-MM-DD) when confidently found
  summary: string | null;
}

const FETCH_TIMEOUT_MS = 10000;
const AI_TIMEOUT_MS = 30000;
const MAX_CONTENT_CHARS = 12000;

/**
 * Fetch a page and return its visible text content (HTML stripped).
 */
export async function fetchCoursePageText(
  url: string,
  timeoutMs: number = FETCH_TIMEOUT_MS
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        // Some university sites block requests without a UA.
        'User-Agent':
          'Mozilla/5.0 (compatible; GlowbalBot/1.0; +https://glowbal.com)',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    });

    if (!res.ok) {
      return null;
    }

    const html = await res.text();
    return htmlToText(html);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Crude but dependency-free HTML -> text: drop scripts/styles/markup and
 * collapse whitespace.
 */
function htmlToText(html: string): string {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ');

  const text = withoutScripts
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return text.slice(0, MAX_CONTENT_CHARS);
}

/**
 * Parse a course page into structured details. Returns null if the page can't
 * be fetched or OpenAI isn't configured.
 */
export async function parseCoursePage(url: string): Promise<ParsedCourse | null> {
  if (!isOpenAIConfigured()) {
    return null;
  }

  const content = await fetchCoursePageText(url);
  if (!content) {
    return null;
  }

  const systemPrompt = `You extract structured facts from an official university course page.
Only use information explicitly present in the text. If a field is not clearly stated, return null. Never guess or infer fees, deadlines, or requirements.`;

  const userPrompt = `URL: ${url}

Page content:
${content}

Extract the course details as JSON.`;

  const completion = await openai.chat.completions.create(
    {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'parsed_course',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              courseName: { type: ['string', 'null'] },
              degreeLevel: { type: ['string', 'null'] },
              studyMode: { type: ['string', 'null'] },
              duration: { type: ['string', 'null'] },
              tuitionFeeText: { type: ['string', 'null'] },
              deadline: {
                type: ['string', 'null'],
                description: 'Application deadline as YYYY-MM-DD if clearly stated, else null',
              },
              summary: {
                type: ['string', 'null'],
                description: 'One or two sentence plain-text summary of the course',
              },
            },
            required: [
              'courseName',
              'degreeLevel',
              'studyMode',
              'duration',
              'tuitionFeeText',
              'deadline',
              'summary',
            ],
            additionalProperties: false,
          },
        },
      },
    },
    { timeout: AI_TIMEOUT_MS }
  );

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as ParsedCourse;
  } catch {
    return null;
  }
}
