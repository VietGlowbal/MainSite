/**
 * AI-powered course information extractor
 * 
 * Uses OpenAI to extract structured data from university course pages
 * including course details, requirements, deadlines, and scholarships.
 */

export type ExtractedCourseData = {
  // Core course info
  universityName: string;
  courseName: string;
  degreeLevel?: string;
  subject?: string;
  studyMode?: string;
  intake?: string;
  country?: string;
  countryFlag?: string;

  // Application details
  applicationMethod?: string;
  applicationCode?: string;
  deadline?: string;
  tuitionFee?: string;
  entryRequirementsSummary?: string;
  englishRequirementsSummary?: string;

  // Metadata
  imageUrl?: string;
  logoUrl?: string;
  sourceConfidence: 'high' | 'medium' | 'low';

  // Extracted stages with tasks
  stages: ExtractedStage[];

  // Scholarships
  scholarships: ExtractedScholarship[];
};

export type ExtractedStage = {
  name: string;
  order: number;
  description: string;
  isRequired: boolean;
  tasks: ExtractedTask[];
};

export type ExtractedTask = {
  title: string;
  description?: string;
  dueDate?: string;
  priority: 'high' | 'medium' | 'low';
  type: 'required' | 'recommended' | 'optional' | 'risk';
  sourceUrl?: string;
  supportToolType?: 'sop_maximiser' | 'interview_prep' | 'mentor' | 'test_prep' | 'profile_review';
  confidence: 'high' | 'medium' | 'low';
};

export type ExtractedScholarship = {
  name: string;
  amount?: string;
  eligibility?: string;
  deadline?: string;
  url?: string;
  confidence: 'high' | 'medium' | 'low';
};

/**
 * Fetch and extract course information using AI
 */
export async function extractCourseData(
  courseUrl: string,
  apiKey: string,
  model: string = 'gpt-4o'
): Promise<ExtractedCourseData> {
  // Step 1: Fetch the course page content
  const pageContent = await fetchPageContent(courseUrl);

  // Step 2: Extract course data using AI
  const extractedData = await extractWithAI(courseUrl, pageContent, apiKey, model);

  return extractedData;
}

/**
 * Fetch the HTML content of a course page
 */
async function fetchPageContent(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GlowbalBot/1.0; +https://glowbal-education.com)',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch page: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();

    // Extract text content from HTML (simple approach)
    // Remove script and style tags
    let text = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Limit to first 15000 characters to stay within token limits
    if (text.length > 15000) {
      text = text.substring(0, 15000) + '...';
    }

    return text;
  } catch (error) {
    console.error('Error fetching page content:', error);
    throw new Error('Failed to fetch course page. Please check the URL and try again.');
  }
}

/**
 * Extract structured data from page content using OpenAI
 */
async function extractWithAI(
  courseUrl: string,
  pageContent: string,
  apiKey: string,
  model: string
): Promise<ExtractedCourseData> {
  const systemPrompt = `You are an expert university admissions data extractor. You analyze university course pages and extract structured information to help students apply.

You MUST respond with valid JSON only — no markdown, no code fences, no extra text.

Extract the following information from the course page:

1. **Core Course Info**:
   - universityName: Full official name
   - courseName: Full course title
   - degreeLevel: e.g., "Bachelor's", "Master's", "PhD"
   - subject: Main subject area
   - studyMode: e.g., "Full-time", "Part-time", "Online"
   - intake: e.g., "September 2027", "Fall 2027"
   - country: Country where the university is located
   - countryFlag: Emoji flag for the country

2. **Application Details**:
   - applicationMethod: e.g., "UCAS", "Direct Apply", "Common App", "University Portal"
   - applicationCode: UCAS code or other application reference
   - deadline: Application deadline in ISO format (YYYY-MM-DD) if available
   - tuitionFee: Annual tuition fee with currency
   - entryRequirementsSummary: Brief summary of academic requirements (e.g., "AAA at A-Level or equivalent")
   - englishRequirementsSummary: English language requirements (e.g., "IELTS 6.5 overall")

3. **Application Stages & Tasks**:
   Create 5-7 stages with specific tasks for THIS course. Base tasks on the actual requirements found on the page.
   
   Standard stages:
   - Research (order: 1)
   - Check eligibility (order: 2)
   - Prepare documents (order: 3)
   - Improve application (order: 4)
   - Submit (order: 5)
   - Interview (order: 6, isRequired: false if not mentioned)
   - Decision (order: 7)

   For each stage, create 2-5 specific tasks based on the course requirements. Tasks should be:
   - Actionable and specific to this course
   - Prioritized (high/medium/low)
   - Typed as required/recommended/optional/risk
   - Include supportToolType where relevant (sop_maximiser, interview_prep, mentor, test_prep, profile_review)

4. **Scholarships**:
   Extract any scholarships mentioned on the page or commonly available for this course/university.
   Include:
   - name: Scholarship name
   - amount: Value or percentage
   - eligibility: Brief eligibility criteria
   - deadline: Deadline if mentioned
   - url: Link to scholarship page if available

5. **Confidence Level**:
   - "high": Most information found and verified
   - "medium": Some information found, some inferred
   - "low": Limited information, mostly inferred

Return JSON matching this schema:

{
  "universityName": string,
  "courseName": string,
  "degreeLevel": string | null,
  "subject": string | null,
  "studyMode": string | null,
  "intake": string | null,
  "country": string | null,
  "countryFlag": string | null,
  "applicationMethod": string | null,
  "applicationCode": string | null,
  "deadline": string | null,
  "tuitionFee": string | null,
  "entryRequirementsSummary": string | null,
  "englishRequirementsSummary": string | null,
  "sourceConfidence": "high" | "medium" | "low",
  "stages": [
    {
      "name": string,
      "order": number,
      "description": string,
      "isRequired": boolean,
      "tasks": [
        {
          "title": string,
          "description": string | null,
          "dueDate": string | null,
          "priority": "high" | "medium" | "low",
          "type": "required" | "recommended" | "optional" | "risk",
          "sourceUrl": string | null,
          "supportToolType": string | null,
          "confidence": "high" | "medium" | "low"
        }
      ]
    }
  ],
  "scholarships": [
    {
      "name": string,
      "amount": string | null,
      "eligibility": string | null,
      "deadline": string | null,
      "url": string | null,
      "confidence": "high" | "medium" | "low"
    }
  ]
}`;

  const userPrompt = `Extract course information from this page:

URL: ${courseUrl}

Page Content:
---
${pageContent}
---

Respond with JSON only. Be thorough and extract as much relevant information as possible.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3, // Lower temperature for more consistent extraction
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('OpenAI API error:', errorData);
      throw new Error('AI extraction failed. Please try again.');
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No response from AI. Please try again.');
    }

    // Parse the JSON response (strip any markdown fences if present)
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const extractedData = JSON.parse(cleaned) as ExtractedCourseData;

    // Validate required fields
    if (!extractedData.universityName || !extractedData.courseName) {
      throw new Error('Failed to extract required course information');
    }

    return extractedData;
  } catch (error) {
    console.error('AI extraction error:', error);
    throw error;
  }
}
