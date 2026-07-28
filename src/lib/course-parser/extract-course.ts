/**
 * Course page extraction.
 *
 * Fetches an official course page and turns it into everything the apply
 * workspace needs: the course facts, a checklist of tasks bucketed into the
 * five fixed stages, and any scholarships the page mentions.
 *
 * WHAT THIS REPLACES, AND WHY. There were two extractors in the tree and
 * neither did the job:
 *
 *   - `ai/course-extractor.ts` asked the model to invent the stage structure
 *     *and* fill it, over a hand-rolled fetch to the completions endpoint with
 *     "respond with JSON only" and a code-fence strip. On any failure it
 *     returned fabricated defaults — `matchScore: 70`, "Profile under review" —
 *     which is the one thing a system showing AI output to students must never
 *     do. Nothing called it.
 *   - `course-parser/ai-parser.ts` was correctly built (SDK, strict schema) but
 *     only extracted five scalar fields and wrote no checklist at all. This is
 *     the one that ran, which is why every application in the database renders
 *     as an empty workspace.
 *
 * THE STAGES ARE NOT THE MODEL'S JOB. The five stages are a fixed template, so
 * the model is asked only to *classify* each task it finds into one of them.
 * Deterministic structure, and the failure mode degrades to "a stage with no
 * tasks" rather than "a page with no stages". It also sidesteps a real
 * limitation: OpenAI's strict schema mode does not support `minItems`, so
 * "exactly five stages" could not have been enforced by the schema anyway.
 *
 * NOTHING IS INVENTED. Every field is nullable and the prompt is explicit that
 * absent means null. A missing tuition figure renders as absent in the UI; it
 * never renders as a guess.
 */

import { openai, isOpenAIConfigured } from '@/lib/ai/openai-client';

/* ─────────────────────────────────────────────────────────────────────────
   The fixed stage template
   ───────────────────────────────────────────────────────────────────────── */

/**
 * The five stages every application gets, in order.
 *
 * Trimmed from the seven that `applications/import` used to create: Interview
 * and Decision are outcomes the student waits for rather than work they do, and
 * the redesign drops both.
 */
export const STAGE_TEMPLATE = [
  {
    key: 'research',
    name: 'Research',
    slug: 'research',
    description: 'Understand the course, the university and whether it fits your plans.',
  },
  {
    key: 'eligibility',
    name: 'Check eligibility',
    slug: 'check-eligibility',
    description: 'Confirm you meet the academic, English and test requirements.',
  },
  {
    key: 'documents',
    name: 'Prepare documents',
    slug: 'prepare-documents',
    description: 'Gather and write everything the application asks you to submit.',
  },
  {
    key: 'improve',
    name: 'Improve application',
    slug: 'improve-application',
    description: 'Strengthen the parts of your application that are weakest.',
  },
  {
    key: 'submit',
    name: 'Submit',
    slug: 'submit',
    description: 'Send the application and track its progress.',
  },
] as const;

export type StageKey = (typeof STAGE_TEMPLATE)[number]['key'];

const STAGE_KEYS = STAGE_TEMPLATE.map((s) => s.key);

/**
 * Task types the `application_tasks.task_type` CHECK constraint accepts. Kept
 * here as a literal union so a schema change breaks the build rather than the
 * insert.
 */
export type TaskType =
  | 'research'
  | 'eligibility'
  | 'document'
  | 'profile'
  | 'scholarship'
  | 'mentor'
  | 'external_link'
  | 'deadline'
  | 'submission'
  | 'general';

const TASK_TYPES: TaskType[] = [
  'research',
  'eligibility',
  'document',
  'profile',
  'scholarship',
  'mentor',
  'external_link',
  'deadline',
  'submission',
  'general',
];

export type Confidence = 'high' | 'medium' | 'low';

/* ─────────────────────────────────────────────────────────────────────────
   Result shape
   ───────────────────────────────────────────────────────────────────────── */

export type ExtractedTask = {
  stage: StageKey;
  title: string;
  description: string | null;
  priority: 'high' | 'medium' | 'low';
  taskType: TaskType;
  sourceUrl: string | null;
  confidence: Confidence;
};

export type ExtractedScholarship = {
  name: string;
  amount: string | null;
  eligibility: string | null;
  deadline: string | null;
  url: string | null;
  confidence: Confidence;
};

export type ExtractedCourse = {
  universityName: string | null;
  courseName: string | null;
  degreeLevel: string | null;
  subject: string | null;
  studyMode: string | null;
  intake: string | null;
  country: string | null;
  /** ISO YYYY-MM-DD, only when the page states it plainly. */
  deadline: string | null;
  durationText: string | null;
  tuitionFeeText: string | null;
  applicationMethod: string | null;
  applicationCode: string | null;
  entryRequirements: string | null;
  englishRequirements: string | null;
  summary: string | null;
};

export type CourseExtraction = {
  course: ExtractedCourse;
  tasks: ExtractedTask[];
  scholarships: ExtractedScholarship[];
  links: {
    entryRequirements: string | null;
    howToApply: string | null;
    tuitionFees: string | null;
    scholarships: string | null;
  };
  /** How much of this came off the page rather than being left blank. */
  confidence: Confidence;
};

/** Why an extraction produced nothing. Drives the message the student sees. */
export type ExtractionFailure =
  | 'not_configured'
  | 'fetch_failed'
  | 'empty_page'
  | 'model_failed';

export type ExtractionResult =
  | { ok: true; data: CourseExtraction }
  | { ok: false; reason: ExtractionFailure };

/* ─────────────────────────────────────────────────────────────────────────
   Fetching
   ───────────────────────────────────────────────────────────────────────── */

const FETCH_TIMEOUT_MS = 12_000;
const AI_TIMEOUT_MS = 60_000;
const MAX_CONTENT_CHARS = 18_000;

/**
 * Below this much text the page is not worth sending to the model — it is
 * almost always a bot wall or a shell that renders its content with JavaScript,
 * and asking anyway just buys a page of nulls at full token price.
 */
const MIN_USEFUL_CHARS = 400;

/**
 * Fetch a page and return its visible text.
 *
 * The `Accept-Language` header is not decoration: a good share of these pages
 * are Vietnamese university sites that content-negotiate, and without it we get
 * whichever language the CDN guesses.
 */
export async function fetchCoursePageText(
  url: string,
  timeoutMs: number = FETCH_TIMEOUT_MS,
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        // Some university sites reject requests without a browser-shaped UA.
        'User-Agent':
          'Mozilla/5.0 (compatible; GlowbalBot/1.0; +https://glowbal.com/robots)',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en,vi;q=0.8',
      },
      redirect: 'follow',
    });

    if (!res.ok) return null;
    return htmlToText(await res.text());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Crude but dependency-free HTML → text.
 *
 * `nav`, `header` and `footer` are dropped before the tag strip: on a
 * university site those carry the entire site menu, which is often longer than
 * the course content itself and would crowd it out of the character budget.
 */
function htmlToText(html: string): string {
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ');

  return stripped
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_CONTENT_CHARS);
}

/* ─────────────────────────────────────────────────────────────────────────
   The model call
   ───────────────────────────────────────────────────────────────────────── */

const SYSTEM_PROMPT = `You extract structured facts from an official university course page, and turn them into an application checklist.

RULES, in order of importance:

1. Only state what the page states. If a fact is not clearly present, return null. Never guess a fee, a deadline, a grade requirement or a scholarship amount. A null is always better than a plausible invention — a student will act on what you write.
2. Every task you create must be traceable to something on the page. Do not pad the checklist to make it look complete. Five well-sourced tasks beat twenty generic ones.
3. Assign every task to exactly one stage:
   - research: understanding the course, the university, the city, the fit
   - eligibility: checking grades, English scores, admission tests, visas
   - documents: gathering, writing or requesting anything to be submitted
   - improve: strengthening a weak part of the application
   - submit: the act of applying, fees, portals, tracking, deadlines
4. Set each task's confidence: high when the page says it outright, medium when it follows directly from what the page says, low when it is standard practice for this kind of course.
5. deadline must be YYYY-MM-DD and only when the page gives an unambiguous date. A month with no day, or a phrase like "rolling admissions", is null.
6. Write in English, in the second person ("Request two academic references"). Titles are short and start with a verb.`;

/** The strict JSON schema. Every property required, nulls carry absence. */
const RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['course', 'tasks', 'scholarships', 'links', 'confidence'],
  properties: {
    course: {
      type: 'object',
      additionalProperties: false,
      required: [
        'universityName',
        'courseName',
        'degreeLevel',
        'subject',
        'studyMode',
        'intake',
        'country',
        'deadline',
        'durationText',
        'tuitionFeeText',
        'applicationMethod',
        'applicationCode',
        'entryRequirements',
        'englishRequirements',
        'summary',
      ],
      properties: {
        universityName: { type: ['string', 'null'] },
        courseName: { type: ['string', 'null'] },
        degreeLevel: { type: ['string', 'null'], description: "e.g. Bachelor's, Master's, PhD" },
        subject: { type: ['string', 'null'] },
        studyMode: { type: ['string', 'null'], description: 'Full-time, Part-time, Online' },
        intake: { type: ['string', 'null'], description: 'e.g. September 2027' },
        country: { type: ['string', 'null'] },
        deadline: { type: ['string', 'null'], description: 'YYYY-MM-DD, only if unambiguous' },
        durationText: { type: ['string', 'null'], description: 'e.g. 3 years, 18 months' },
        tuitionFeeText: { type: ['string', 'null'], description: 'With currency, as written' },
        applicationMethod: { type: ['string', 'null'], description: 'UCAS, Common App, direct' },
        applicationCode: { type: ['string', 'null'] },
        entryRequirements: { type: ['string', 'null'], description: 'One or two sentences' },
        englishRequirements: { type: ['string', 'null'], description: 'IELTS/TOEFL, as written' },
        summary: { type: ['string', 'null'], description: 'One or two sentences on the course' },
      },
    },
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['stage', 'title', 'description', 'priority', 'taskType', 'sourceUrl', 'confidence'],
        properties: {
          stage: { type: 'string', enum: STAGE_KEYS },
          title: { type: 'string' },
          description: { type: ['string', 'null'] },
          priority: { type: 'string', enum: ['high', 'medium', 'low'] },
          taskType: { type: 'string', enum: TASK_TYPES },
          sourceUrl: { type: ['string', 'null'] },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
      },
    },
    scholarships: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'amount', 'eligibility', 'deadline', 'url', 'confidence'],
        properties: {
          name: { type: 'string' },
          amount: { type: ['string', 'null'] },
          eligibility: { type: ['string', 'null'] },
          deadline: { type: ['string', 'null'] },
          url: { type: ['string', 'null'] },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
      },
    },
    links: {
      type: 'object',
      additionalProperties: false,
      required: ['entryRequirements', 'howToApply', 'tuitionFees', 'scholarships'],
      properties: {
        entryRequirements: { type: ['string', 'null'] },
        howToApply: { type: ['string', 'null'] },
        tuitionFees: { type: ['string', 'null'] },
        scholarships: { type: ['string', 'null'] },
      },
    },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
  },
} as const;

/** ISO dates only. Anything else is dropped rather than stored half-parsed. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Narrow the model's response to our types.
 *
 * The schema is strict, so this is a belt-and-braces pass rather than real
 * parsing — but `strict: true` does not validate that a string *looks like* a
 * date, and it cannot stop the model returning a stage key that was valid when
 * the enum was built and has since been renamed.
 */
function normalise(raw: unknown, pageUrl: string): CourseExtraction | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const course = r['course'];
  if (typeof course !== 'object' || course === null) return null;

  const c = course as Record<string, unknown>;
  const str = (v: unknown): string | null =>
    typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;

  const rawTasks = Array.isArray(r['tasks']) ? r['tasks'] : [];
  const tasks: ExtractedTask[] = [];
  for (const t of rawTasks) {
    if (typeof t !== 'object' || t === null) continue;
    const o = t as Record<string, unknown>;
    const title = str(o['title']);
    const stage = o['stage'];
    if (!title || typeof stage !== 'string') continue;
    if (!STAGE_KEYS.includes(stage as StageKey)) continue;

    const taskType = TASK_TYPES.includes(o['taskType'] as TaskType)
      ? (o['taskType'] as TaskType)
      : 'general';
    const priority =
      o['priority'] === 'high' || o['priority'] === 'low' ? o['priority'] : 'medium';
    const confidence =
      o['confidence'] === 'high' || o['confidence'] === 'low' ? o['confidence'] : 'medium';

    tasks.push({
      stage: stage as StageKey,
      title,
      description: str(o['description']),
      priority,
      taskType,
      sourceUrl: str(o['sourceUrl']) ?? pageUrl,
      confidence,
    });
  }

  const rawScholarships = Array.isArray(r['scholarships']) ? r['scholarships'] : [];
  const scholarships: ExtractedScholarship[] = [];
  for (const s of rawScholarships) {
    if (typeof s !== 'object' || s === null) continue;
    const o = s as Record<string, unknown>;
    const name = str(o['name']);
    if (!name) continue;
    const confidence =
      o['confidence'] === 'high' || o['confidence'] === 'low' ? o['confidence'] : 'medium';
    scholarships.push({
      name,
      amount: str(o['amount']),
      eligibility: str(o['eligibility']),
      deadline: str(o['deadline']),
      url: str(o['url']),
      confidence,
    });
  }

  const linksRaw = (r['links'] ?? {}) as Record<string, unknown>;
  const deadline = str(c['deadline']);
  const overall = r['confidence'];

  return {
    course: {
      universityName: str(c['universityName']),
      courseName: str(c['courseName']),
      degreeLevel: str(c['degreeLevel']),
      subject: str(c['subject']),
      studyMode: str(c['studyMode']),
      intake: str(c['intake']),
      country: str(c['country']),
      deadline: deadline && ISO_DATE.test(deadline) ? deadline : null,
      durationText: str(c['durationText']),
      tuitionFeeText: str(c['tuitionFeeText']),
      applicationMethod: str(c['applicationMethod']),
      applicationCode: str(c['applicationCode']),
      entryRequirements: str(c['entryRequirements']),
      englishRequirements: str(c['englishRequirements']),
      summary: str(c['summary']),
    },
    tasks,
    scholarships,
    links: {
      entryRequirements: str(linksRaw['entryRequirements']),
      howToApply: str(linksRaw['howToApply']),
      tuitionFees: str(linksRaw['tuitionFees']),
      scholarships: str(linksRaw['scholarships']),
    },
    confidence: overall === 'high' || overall === 'low' ? overall : 'medium',
  };
}

/**
 * Extract a course page into the full application payload.
 *
 * Returns a tagged result rather than throwing or returning null, so the caller
 * can tell "the site blocked us" from "the model is not configured" and decide
 * whether a retry could ever succeed.
 */
export async function extractCourse(url: string): Promise<ExtractionResult> {
  if (!isOpenAIConfigured()) {
    return { ok: false, reason: 'not_configured' };
  }

  const content = await fetchCoursePageText(url);
  if (content === null) {
    return { ok: false, reason: 'fetch_failed' };
  }
  if (content.length < MIN_USEFUL_CHARS) {
    return { ok: false, reason: 'empty_page' };
  }

  let completion;
  try {
    completion = await openai.chat.completions.create(
      {
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `URL: ${url}\n\nPage content:\n${content}\n\nExtract the course and build the checklist.`,
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'course_extraction',
            strict: true,
            schema: RESPONSE_SCHEMA,
          },
        },
      },
      { timeout: AI_TIMEOUT_MS },
    );
  } catch (error) {
    console.error('[extract-course] model call failed:', error);
    return { ok: false, reason: 'model_failed' };
  }

  const raw = completion.choices[0]?.message?.content;
  if (!raw) return { ok: false, reason: 'model_failed' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'model_failed' };
  }

  const data = normalise(parsed, url);
  if (!data) return { ok: false, reason: 'model_failed' };

  return { ok: true, data };
}

/**
 * Bucket a flat task list into the five stages, in template order.
 *
 * Always returns all five, including empty ones — a stage with nothing in it is
 * information ("we found nothing to do here yet"), and the workspace stepper
 * needs a stable five-step spine regardless of what the page happened to say.
 */
export function groupTasksByStage(
  tasks: ExtractedTask[],
): Array<{ stage: (typeof STAGE_TEMPLATE)[number]; tasks: ExtractedTask[] }> {
  return STAGE_TEMPLATE.map((stage) => ({
    stage,
    tasks: tasks.filter((t) => t.stage === stage.key),
  }));
}

/** `application_tasks.confidence` is numeric; the model speaks in words. */
export function confidenceToNumber(confidence: Confidence): number {
  if (confidence === 'high') return 0.9;
  if (confidence === 'low') return 0.5;
  return 0.7;
}
