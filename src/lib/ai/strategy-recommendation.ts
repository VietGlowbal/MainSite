// ============================================================================
// F7 — Strategic Recommendation Framework ("Personalized Strategy")
// ----------------------------------------------------------------------------
// One structured-JSON OpenAI call that synthesises the Personal Report
// (NarrativeProfile, F1/F4) and the Matching Report (ProgrammeFit, F5) into a
// strategy: which direction to commit to, how to narrate it, how to
// reposition, what to build next, how to differentiate, and a roadmap. See
// `features/ai-strategy-dashboard/domain/strategy-recommendation.ts` for why
// this is a real model call (not a derived reshape) and why it validates with
// zod rather than manual normalisation.
//
// Written in English — unlike `match-insights.ts` and `applicant-analysis.ts`,
// which write Vietnamese user-facing copy, F7's report content is English by
// product decision.
// ============================================================================

import type { NarrativeProfile } from '@/features/ai-strategy-dashboard/domain';
import {
  strategyRecommendationSchema,
  type StrategyRecommendation,
} from '@/features/ai-strategy-dashboard/domain';
import type { ProgrammeFit } from '@/features/apply/domain';
import { openAiJsonCompletion, defaultOpenAIModel } from './openai-client';

export type StrategyProgrammeInput = {
  universityName: string;
  courseName: string;
  subject?: string | null;
  degreeLevel?: string | null;
  careerOutcomes?: string | null;
};

export type StrategyAchievementInput = {
  category: string;
  title: string;
  detail?: string | null;
};

export type StrategyActivityInput = {
  category: string;
  title: string;
  description?: string | null;
};

function buildSystemPrompt(): string {
  return `You are a senior university admissions strategist writing a Strategic Recommendation Report for one applicant applying to one specific programme. You already have their Personal Report (who they are) and their Matching Report (how well they fit this programme) — your job is to turn those two read-only facts into a strategy: what to commit to, and how to become more competitive before they submit.

Respond with VALID JSON ONLY (no markdown, no commentary) matching exactly:
{
  "directionOptions": [
    { "name": "<a specific, ownable strategic direction, e.g. 'Business Analytics for Education'>", "identityFit": <0-10>, "evidenceStrength": <0-10>, "consistency": <0-10>, "differentiation": <0-10>, "futureAlignment": <0-10>, "scalability": <0-10>, "overall": <0-10> },
    ...2-6 candidate directions
  ],
  "chosenDirection": "<must exactly match one \\"name\\" above — the one with the strongest case>",
  "chosenDirectionWhy": "<why this direction wins over the others, referencing the six scores>",
  "narrative": "<the applicant's story told through the lens of the chosen direction — how their existing experiences, told in sequence, build toward it>",
  "positioningBefore": "<how the applicant would currently present themselves, unfocused>",
  "positioningAfter": "<how they should present themselves once committed to the chosen direction>",
  "positioningRationale": "<why the \\"after\\" positioning is stronger for this specific programme>",
  "portfolioEvaluations": [
    { "name": "<name of a real activity/achievement OR a proposed new opportunity>", "source": "existing_activity | ai_proposed", "strategicContribution": "<how it strengthens (or doesn't) the chosen direction>", "recommendation": "highly_recommended | recommended | low_priority" },
    ...at least 2, mixing BOTH sources: every real activity/achievement provided must be evaluated (source: "existing_activity"), and at least one NEW opportunity you propose (source: "ai_proposed") the applicant does not yet have
  ],
  "differentiationInsight": "<what makes this applicant's profile common vs. what other applicants for this direction typically also have>",
  "differentiationProposal": "<one concrete thing that would make them stand out from that common pool>",
  "roadmap": {
    "chosenStrategy": "<one-sentence restatement of the committed direction>",
    "why": "<the single strongest reason to commit to it>",
    "prioritize": ["<concrete action to take before submitting>", ...1-8],
    "avoid": ["<thing that would dilute the positioning>", ...1-8],
    "expectedPositioning": "<how an admissions reader would describe this applicant after the roadmap is followed>",
    "longTermNarrative": "<the through-line from where they are now to where the roadmap leads>"
  }
}

FIELD NOTES (F7.1-F7.6, one JSON section per module):
- F7.1 Strategic Direction Selection ("directionOptions"/"chosenDirection"/"chosenDirectionWhy"): propose 2-6 REAL candidate directions grounded in the applicant's actual signature pattern and emerging themes — not generic majors. Score each on six 0-10 dimensions: identityFit (matches who they already are), evidenceStrength (how much of what they've already done supports it), consistency (how much it reuses one throughline vs. scattering), differentiation (how distinct vs. common applicant pools), futureAlignment (fit with the target programme and career direction), scalability (room to grow it further before submitting). "overall" is your holistic score, not a plain average. Pick the strongest as "chosenDirection".
- F7.2 Narrative Strategy ("narrative"): retell their existing experiences as a coherent story that arrives at the chosen direction. Do not invent experiences — resequence and reframe only what evidence supports.
- F7.3 Positioning Strategy ("positioningBefore"/"positioningAfter"/"positioningRationale"): contrast an unfocused self-presentation against a focused one built around the chosen direction.
- F7.4 Portfolio Strategy ("portfolioEvaluations"): evaluate the applicant's PORTFOLIO of activities against the chosen direction — both what they already have (source "existing_activity", one entry per real achievement/activity given to you) and what they are missing (source "ai_proposed", opportunities you invent that would plausibly be available to a student in their situation). Rate each highly_recommended / recommended / low_priority by how much it strengthens the chosen direction specifically, not how impressive it is in general.
- F7.5 Differentiation Strategy ("differentiationInsight"/"differentiationProposal"): name the crowded pattern this applicant currently resembles (be specific: "another coding + hackathon profile", not "typical applicant"), then propose one differentiator that breaks from it while staying consistent with the chosen direction.
- F7.6 Execution Roadmap ("roadmap"): the actionable summary — what to prioritize before submitting, what to avoid doing (because it would dilute the positioning), the positioning it produces, and the long-term narrative arc.

RULES:
- Base everything ONLY on the Personal Report, Matching Report, programme facts and activities/achievements provided. Do not invent facts about the applicant — you MAY invent plausible new opportunities for F7.4's "ai_proposed" entries, clearly labelled as such.
- Every real achievement/activity provided to you must appear as an "existing_activity" entry in "portfolioEvaluations" — do not omit any.
- Write every field in English.
- All six-dimension scores in "directionOptions" are 0-10, one decimal place is fine.
- Keep every direction's "name" short and ownable (a phrase a student could say about themselves), never a generic subject name alone.`;
}

function buildUserPrompt(
  narrative: NarrativeProfile,
  fit: ProgrammeFit,
  programme: StrategyProgrammeInput,
  achievements: StrategyAchievementInput[],
  activities: StrategyActivityInput[],
): string {
  const parts: string[] = [];

  parts.push(`TARGET PROGRAMME: ${programme.courseName} at ${programme.universityName}`);
  if (programme.degreeLevel) parts.push(`Level: ${programme.degreeLevel}`);
  if (programme.subject) parts.push(`Subject: ${programme.subject}`);
  if (programme.careerOutcomes) parts.push(`Career outcomes: ${programme.careerOutcomes}`);

  parts.push('\nPERSONAL REPORT (F1/F4 — who this applicant is):');
  parts.push(`Core identity: ${narrative.coreIdentity ?? '(not available)'}`);
  parts.push(`Driving force: ${narrative.drivingForce ?? '(not available)'}`);
  parts.push(`Signature pattern: ${narrative.signaturePattern.join(', ') || '(not available)'}`);
  parts.push(`Emerging themes: ${narrative.emergingThemes.join(', ') || '(not available)'}`);
  parts.push(`Current positioning: ${narrative.personalPositioning ?? '(not available)'}`);
  parts.push(`Academic strengths: ${narrative.academicStrengths.join(', ') || '(not available)'}`);
  parts.push(`Growth areas: ${narrative.growthAreas.join(', ') || '(not available)'}`);

  parts.push('\nMATCHING REPORT (F5 — fit against this specific programme):');
  parts.push(`Classification: ${fit.classification}`);
  for (const [key, dimension] of Object.entries(fit.dimensions)) {
    parts.push(
      `- ${key}: ${dimension.status}${dimension.score !== null ? ` (${dimension.score}/5)` : ''} — ${dimension.summary}`,
    );
  }

  parts.push('\nREAL ACHIEVEMENTS (must each appear as an "existing_activity" portfolio entry):');
  if (achievements.length > 0) {
    for (const a of achievements) {
      parts.push(`- [${a.category}] ${a.title}${a.detail ? `: ${a.detail.slice(0, 300)}` : ''}`);
    }
  } else {
    parts.push('(none recorded)');
  }

  parts.push('\nREAL ACTIVITIES (must each appear as an "existing_activity" portfolio entry):');
  if (activities.length > 0) {
    for (const a of activities) {
      parts.push(`- [${a.category}] ${a.title}${a.description ? `: ${a.description.slice(0, 300)}` : ''}`);
    }
  } else {
    parts.push('(none recorded)');
  }

  parts.push('\nWrite the Strategic Recommendation Report now. Respond with JSON only.');
  return parts.join('\n');
}

/**
 * Run the F7 call. Throws on a hard failure (no key, network, unparseable or
 * schema-invalid response) so the caller can surface an error — same
 * contract as `analyzeApplicant`/`analyzeCourseMatchInsights`.
 */
export async function generateStrategyRecommendation(args: {
  narrative: NarrativeProfile;
  fit: ProgrammeFit;
  programme: StrategyProgrammeInput;
  achievements: StrategyAchievementInput[];
  activities: StrategyActivityInput[];
  apiKey: string;
  model?: string;
}): Promise<StrategyRecommendation> {
  const {
    narrative,
    fit,
    programme,
    achievements,
    activities,
    apiKey,
    model = defaultOpenAIModel(),
  } = args;

  const content = await openAiJsonCompletion({
    apiKey,
    model,
    messages: [
      { role: 'system', content: buildSystemPrompt() },
      { role: 'user', content: buildUserPrompt(narrative, fit, programme, achievements, activities) },
    ],
    temperature: 0.4,
    maxTokens: 3500,
  });

  const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const parsed = JSON.parse(cleaned) as unknown;

  const result = strategyRecommendationSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Invalid strategy recommendation output: ${result.error.issues[0]?.message ?? 'unknown'}`);
  }
  return result.data;
}
