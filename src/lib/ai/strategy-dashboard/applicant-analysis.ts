// ============================================================================
// F1 + F4 — the Shared Evaluation Engine's only model call
// ----------------------------------------------------------------------------
// Produces the narrative half of the engine: the CMCAITF Reflection sections
// (F1) and the Narrative Identity / Personal Branding sections (F4). Everything
// else the engine reports — competencies, evidence hierarchy, programme fit,
// vagueness — is derived without a model. See
// features/ai-strategy-dashboard/domain/evaluation/framework.ts on why the
// split falls where it does.
//
// One structured-JSON OpenAI call, same convention as
// `src/lib/ai/match-insights.ts` (plain JSON-mode, manual normalisation) — see
// .kiro/specs/ai-strategy-dashboard/requirements.md Open decision 3 for why
// this feature does not use the trust-rules-no-score wrapper the unmerged
// feat/strategy-* branches use instead.
// ============================================================================

import { openAiCompletionParameters } from '@/lib/ai/openai-client';
import type {
  ApplicantAnalysisInputsPresent,
  NarrativeProfile,
} from '@/features/ai-strategy-dashboard/domain';

export type ApplicantAnalysisProfileInput = {
  nationality?: string | null;
  currentQualification?: string | null;
  schoolName?: string | null;
  currentYear?: string | null;
  currentSubjects?: string[] | null;
  predictedGrades?: string | null;
  targetSubjects?: string[] | null;
  careerGoals?: string | null;
  learningStyle?: string[] | null;
  interestAreas?: string[] | null;
  personalStatementAnswers?: Record<string, unknown> | null;
};

export type ApplicantAnalysisAchievementInput = {
  category: string;
  title: string;
  detail?: string | null;
};

export type ApplicantAnalysisActivityInput = {
  category: string;
  title: string;
  description?: string | null;
};

export type ApplicantAnalysisResult = NarrativeProfile & {
  inputsPresent: ApplicantAnalysisInputsPresent;
};

/**
 * The JSON keys are the OLD column names, not the new narrative ones.
 *
 * `personality_summary`, `motivation_analysis`, `competitive_advantages` and
 * `suggested_positioning` are the columns on `applicant_analyses`, and rows
 * written before this change are still read through the same mapper. Renaming
 * the prompt's keys as well would have meant either a destructive column rename
 * or two shapes to parse; the narrative names live in the domain, and the
 * mapping happens once, here and in the row reader.
 */
function buildSystemPrompt(): string {
  return `You are a senior university admissions strategist writing a candidate portrait — an honest, evidence-based read on who this applicant is, for the applicant themselves to read.

Respond with VALID JSON ONLY (no markdown, no commentary) matching exactly:
{
  "personalitySummary": "<2-3 sentences, e.g. 'A resilient and community-driven leader who leverages practical problem-solving to optimise inefficient systems.'>",
  "learningStyle": ["<short phrase>", ...up to 4],
  "academicStrengths": ["<short phrase>", ...up to 5],
  "growthAreas": ["<short phrase>", ...up to 4],
  "motivationAnalysis": "<1-2 sentences on what drives them: career/research/impact/exploration-driven>",
  "competitiveAdvantages": ["<short phrase>", ...up to 5],
  "emergingThemes": ["<short phrase>", ...up to 5],
  "suggestedPositioning": "<1-2 sentences: how should this student present themselves?>",
  "overallRating": <0-100>
}

FIELD NOTES:
- "competitiveAdvantages" is their signature pattern — the COMBINATION only this applicant can claim, not a list of good qualities. "Clinical exposure paired with software delivery" is a signature pattern; "hardworking" is not.
- "emergingThemes" are patterns that RECUR across what they have already done — the throughline an admissions reader would notice reading their record end to end. These are not goals, and they are not gaps. If nothing recurs across at least two separate items, return fewer themes or none at all; do not manufacture a pattern from a single data point.
- "growthAreas" is what is missing or thin. It is the counterweight to the rest of the report and must not be left empty to be kind.

RULES:
- Base everything ONLY on the material provided. Do not invent facts, schools, grades or achievements.
- If a category (e.g. achievements) is empty, keep that section brief and general rather than fabricating specifics — do not pretend evidence exists.
- Return an EMPTY ARRAY for any list you cannot support from the material. An empty section is handled gracefully by the product; an invented one is not.
- "overallRating" is a holistic self-presentation strength score (0-100), not an admission probability for any specific course — this report is course-agnostic.
- Write for the student, in the second-person-adjacent third person the examples above use ("Curious, analytical..." not "You are curious").`;
}

function buildUserPrompt(
  profile: ApplicantAnalysisProfileInput,
  achievements: ApplicantAnalysisAchievementInput[],
  activities: ApplicantAnalysisActivityInput[],
): string {
  const parts: string[] = [];

  parts.push('PERSONAL SUMMARY:');
  parts.push(`Nationality: ${profile.nationality || '(not provided)'}`);
  parts.push(`Qualification: ${profile.currentQualification || '(not provided)'}`);
  parts.push(`School / year: ${profile.schoolName || '(not provided)'} / ${profile.currentYear || '(not provided)'}`);
  parts.push(`Current subjects: ${(profile.currentSubjects ?? []).join(', ') || '(not provided)'}`);
  parts.push(`Predicted grades: ${profile.predictedGrades || '(not provided)'}`);
  parts.push(`Target subjects: ${(profile.targetSubjects ?? []).join(', ') || '(not provided)'}`);
  parts.push(`Career goals: ${profile.careerGoals || '(not provided)'}`);
  parts.push(`Learning style (self-reported): ${(profile.learningStyle ?? []).join(', ') || '(not provided)'}`);
  parts.push(`Interest areas: ${(profile.interestAreas ?? []).join(', ') || '(not provided)'}`);

  const ps = profile.personalStatementAnswers ?? {};
  parts.push('\nPERSONAL STATEMENT QUESTIONS:');
  parts.push(`Motivations: ${typeof ps['motivations'] === 'string' ? ps['motivations'] : '(not provided)'}`);
  parts.push(`Goals: ${typeof ps['goals'] === 'string' ? ps['goals'] : '(not provided)'}`);
  parts.push(`Dream career: ${typeof ps['dreamCareer'] === 'string' ? ps['dreamCareer'] : '(not provided)'}`);
  parts.push(`Reasons for studying abroad: ${typeof ps['reasonsAbroad'] === 'string' ? ps['reasonsAbroad'] : '(not provided)'}`);

  parts.push('\nACHIEVEMENTS:');
  if (achievements.length > 0) {
    for (const a of achievements) {
      parts.push(`- [${a.category}] ${a.title}${a.detail ? `: ${a.detail.slice(0, 300)}` : ''}`);
    }
  } else {
    parts.push('(none recorded)');
  }

  parts.push('\nACTIVITIES:');
  if (activities.length > 0) {
    for (const a of activities) {
      parts.push(`- [${a.category}] ${a.title}${a.description ? `: ${a.description.slice(0, 300)}` : ''}`);
    }
  } else {
    parts.push('(none recorded)');
  }

  parts.push('\nWrite the candidate portrait now. Respond with JSON only.');
  return parts.join('\n');
}

function toStringArray(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).slice(0, max);
}

function toProse(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim().slice(0, 600) : null;
}

function clampScore(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}

/**
 * @deprecated Use canonical Personal Report V2 pipeline (`src/lib/ai/personal-report-v2.ts` / `src/features/apply/domain/personal-report.ts`) instead.
 *
 * Run the F1/F4 call. Throws on a hard failure (no key, network, unparseable
 * response) so the caller can surface an error — same contract as
 * `analyzeCourseMatchInsights`.
 */
export async function analyzeApplicant(args: {
  profile: ApplicantAnalysisProfileInput;
  achievements: ApplicantAnalysisAchievementInput[];
  activities: ApplicantAnalysisActivityInput[];
  apiKey: string;
  model?: string;
}): Promise<ApplicantAnalysisResult> {
  const { profile, achievements, activities, apiKey, model = 'gpt-4o-mini' } = args;

  const inputsPresent: ApplicantAnalysisInputsPresent = {
    personalSummary: Boolean(
      profile.nationality || profile.currentQualification || profile.careerGoals,
    ),
    achievements: achievements.length > 0,
    evidence: activities.length > 0,
  };

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user', content: buildUserPrompt(profile, achievements, activities) },
      ],
      ...openAiCompletionParameters({ model, temperature: 0.4, maxTokens: 1400 }),
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

  return {
    coreIdentity: toProse(parsed.personalitySummary),
    learningStyle: toStringArray(parsed.learningStyle, 4),
    academicStrengths: toStringArray(parsed.academicStrengths, 5),
    growthAreas: toStringArray(parsed.growthAreas, 4),
    drivingForce: toProse(parsed.motivationAnalysis),
    signaturePattern: toStringArray(parsed.competitiveAdvantages, 5),
    emergingThemes: toStringArray(parsed.emergingThemes, 5),
    personalPositioning: toProse(parsed.suggestedPositioning),
    overallRating: clampScore(parsed.overallRating),
    inputsPresent,
  };
}
