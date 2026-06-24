// ============================================================================
// AI scorer for Course Match Insights
// ----------------------------------------------------------------------------
// One structured-JSON OpenAI call that scores a candidate against a course on
// the five pillars (Academic / Activities / Essays / Impact / Personal),
// returning a *current* and a *realistic max* per pillar with evidence,
// strengths, gaps and concrete improvement actions. Mirrors the evidence-based
// approach of the AACC analyzer but generalised and course-aware.
// ============================================================================

import {
  MATCH_PILLARS,
  PILLAR_ORDER,
  type MatchInsights,
  type MatchInputsPresent,
  type PillarBreakdown,
  type PillarKey,
  type ImprovementAction,
  type ImprovementActionType,
  clampScore,
  confidenceFromInputs,
} from '@/lib/match-insights';

export type MatchCourseInput = {
  universityName: string;
  courseName: string;
  subject?: string | null;
  degreeLevel?: string | null;
  entryRequirements?: string | null;
  englishRequirements?: string | null;
  summary?: string | null;
};

export type MatchProfileInput = {
  academicBackground?: string | null;
  grades?: string | null;
  testScores?: string | null;
  activities?: string | null;
  achievements?: string | null;
  personalContext?: string | null;
};

const VALID_ACTION_TYPES: ImprovementActionType[] = [
  'upload_document',
  'internal_route',
  'external_url',
  'book_mentor',
  'none',
];

function buildSystemPrompt(): string {
  const pillarLines = MATCH_PILLARS.map(
    (p) => `- ${p.label.toUpperCase()} (${Math.round(p.weight * 100)}% of the match): ${p.blurb}`,
  ).join('\n');

  return `You are a senior university admissions strategist. You score how well a candidate matches a SPECIFIC course, across five pillars, and you say honestly how much better they could realistically score if they act on your advice.

THE FIVE PILLARS (with their weight in the overall match):
${pillarLines}

Pillar detail to apply when scoring:
- ACADEMIC: do their past/predicted grades and prior subjects meet the entry requirements and prepare them to step up to this course? Reward relevance and rigour; penalise gaps vs the stated requirements.
- ACTIVITIES: do their extracurriculars/skills add transferable depth this course would value?
- ESSAYS: is the statement well written with a clear narrative that admissions for THIS course would value, focused on the right things? Judge substance and fit, not just polish.
- IMPACT: have the things they've done changed them and others (growth, initiative, results)? Will this course help them have impact, and do they present that way?
- PERSONAL: their personal story and how this course fits it — circumstances, background, motivation, and fit (e.g. a course with a strong track record supporting their situation).

SCORING RULES:
- Score each pillar 0–100 for the candidate's CURRENT state, based ONLY on evidence in the materials provided. Do not invent facts.
- Also give a realistic MAX (0–100, always ≥ current): the ceiling if they act on your improvements THIS application cycle. Immutable history (e.g. past grades already achieved) limits the academic max — be realistic, not aspirational. Essays/activities/impact framing are highly improvable.
- If you lack the input needed to judge a pillar (e.g. no essay text was provided for ESSAYS, or no activities), set "assessed": false for that pillar, set current to 0, set max to a realistic value they could reach by providing it, and make the gaps + improvements about providing that input.
- For each pillar, cite 1–2 "evidenceQuotes": SHORT verbatim substrings copied character-for-character from the candidate's CV or essay. If none exist, use an empty array.
- "improvements": 1–3 concrete, course-specific actions per pillar. Each has an "estimatedUplift" (points it would add to THAT pillar, 0–40) and an "actionType" from: ${VALID_ACTION_TYPES.join(', ')}. Use "upload_document" when the fix is to provide/upload a CV or essay; "book_mentor" for getting expert review; "none" otherwise. Sum of a pillar's uplifts should not exceed (max - current).
- Reward specific, quantified, lived evidence. Penalise generic claims with no proof.

Respond with VALID JSON ONLY (no markdown, no commentary) matching exactly:
{
  "confidence": <0-100 — how much real evidence backed this analysis>,
  "pillars": {
    "academic":   { "assessed": <bool>, "current": <0-100>, "max": <0-100>, "verdict": "<2-4 words>", "summary": "<1-2 sentences>", "evidenceQuotes": ["..."], "strengths": ["..."], "gaps": ["..."], "improvements": [ { "label": "<imperative>", "detail": "<why/how>", "estimatedUplift": <0-40>, "actionType": "<type>", "actionTarget": "<optional route/url or empty>" } ] },
    "activities": { ...same shape... },
    "essays":     { ...same shape... },
    "impact":     { ...same shape... },
    "personal":   { ...same shape... }
  }
}`;
}

function buildUserPrompt(
  course: MatchCourseInput,
  profile: MatchProfileInput,
  cvText?: string,
  essayText?: string,
  notes?: string[],
): string {
  const parts: string[] = [];
  parts.push(`COURSE: ${course.courseName} at ${course.universityName}`);
  if (course.degreeLevel) parts.push(`Level: ${course.degreeLevel}`);
  if (course.subject) parts.push(`Subject: ${course.subject}`);
  if (course.entryRequirements) parts.push(`Entry requirements: ${course.entryRequirements}`);
  if (course.englishRequirements) parts.push(`English requirements: ${course.englishRequirements}`);
  if (course.summary) parts.push(`Course summary: ${course.summary}`);

  parts.push('\nCANDIDATE PROFILE:');
  parts.push(`Academic background: ${profile.academicBackground || '(not provided)'}`);
  parts.push(`Grades: ${profile.grades || '(not provided)'}`);
  parts.push(`Test scores: ${profile.testScores || '(not provided)'}`);
  parts.push(`Activities: ${profile.activities || '(not provided)'}`);
  parts.push(`Achievements: ${profile.achievements || '(not provided)'}`);
  if (profile.personalContext) parts.push(`Personal context: ${profile.personalContext}`);

  parts.push(`\nCV / RESUME TEXT:\n${cvText ? cvText.slice(0, 6000) : '(no CV provided)'}`);
  parts.push(`\nESSAY / STATEMENT TEXT:\n${essayText ? essayText.slice(0, 6000) : '(no essay provided)'}`);

  if (notes && notes.length > 0) {
    parts.push(`\nIMPORTANT NOTES:\n${notes.map((n) => `- ${n}`).join('\n')}`);
  }

  parts.push('\nScore the match now. Respond with JSON only.');
  return parts.join('\n');
}

function toStringArray(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).slice(0, max);
}

function normalizeImprovements(v: unknown, pillar: PillarKey): ImprovementAction[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 3).map((raw, i) => {
    const r = (raw ?? {}) as Record<string, unknown>;
    const actionType = VALID_ACTION_TYPES.includes(r.actionType as ImprovementActionType)
      ? (r.actionType as ImprovementActionType)
      : 'none';
    const target = typeof r.actionTarget === 'string' && r.actionTarget.trim() ? r.actionTarget.trim() : undefined;
    return {
      id: `${pillar}-${i + 1}`,
      pillar,
      label: typeof r.label === 'string' ? r.label.slice(0, 140) : 'Improve this area',
      detail: typeof r.detail === 'string' ? r.detail.slice(0, 400) : '',
      estimatedUplift: Math.min(40, Math.max(0, clampScore(r.estimatedUplift))),
      actionType,
      actionTarget: target,
    };
  });
}

function normalizePillar(raw: unknown, pillar: PillarKey): PillarBreakdown {
  const r = (raw ?? {}) as Record<string, unknown>;
  const assessed = r.assessed !== false; // default to assessed unless explicitly false
  const current = clampScore(r.current);
  // Max must be ≥ current and ≤ 100.
  const max = Math.max(current, clampScore(r.max));
  return {
    current: assessed ? current : 0,
    max,
    assessed,
    verdict: typeof r.verdict === 'string' ? r.verdict.slice(0, 40) : undefined,
    summary: typeof r.summary === 'string' ? r.summary.slice(0, 400) : '',
    evidenceQuotes: toStringArray(r.evidenceQuotes, 2),
    strengths: toStringArray(r.strengths, 3),
    gaps: toStringArray(r.gaps, 3),
    improvements: normalizeImprovements(r.improvements, pillar),
  };
}

/**
 * Run the five-pillar match analysis. Throws on a hard failure (no key, network,
 * unparseable response) so the caller can surface an error.
 */
export async function analyzeCourseMatchInsights(args: {
  course: MatchCourseInput;
  profile: MatchProfileInput;
  cvText?: string;
  essayText?: string;
  /** Caveats for the model, e.g. "a CV was uploaded but couldn't be read". */
  notes?: string[];
  apiKey: string;
  model?: string;
}): Promise<MatchInsights> {
  const { course, profile, cvText, essayText, notes, apiKey, model = 'gpt-4o-mini' } = args;

  const inputsPresent: MatchInputsPresent = {
    profile: Boolean(profile.academicBackground || profile.grades || profile.testScores),
    cv: Boolean(cvText && cvText.trim().length > 50),
    essay: Boolean(essayText && essayText.trim().length > 50),
    activities: Boolean(profile.activities || profile.achievements),
  };

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user', content: buildUserPrompt(course, profile, cvText, essayText, notes) },
      ],
      temperature: 0.3,
      max_tokens: 3000,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => '');
    throw new Error(`OpenAI request failed (${response.status}): ${err.slice(0, 200)}`);
  }

  const data = await response.json();
  const content: string | undefined = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty AI response');

  const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const parsed = JSON.parse(cleaned) as Record<string, unknown>;
  const rawPillars = (parsed.pillars ?? {}) as Record<string, unknown>;

  const pillars = {} as Record<PillarKey, PillarBreakdown>;
  for (const key of PILLAR_ORDER) {
    pillars[key] = normalizePillar(rawPillars[key], key);
  }

  // Trust the model's confidence if sane, else derive from available inputs.
  const modelConfidence = clampScore(parsed.confidence);
  const confidence = modelConfidence > 0 ? modelConfidence : confidenceFromInputs(inputsPresent);

  return { pillars, confidence, inputsPresent };
}
