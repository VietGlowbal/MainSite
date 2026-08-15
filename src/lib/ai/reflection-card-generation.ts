import { reflectionCardSchema, type ActivityReflectionValues, type ReflectionCardValues } from '@/features/apply/domain';
import { defaultOpenAIModel, openAiJsonCompletion } from './openai-client';

/**
 * Turns one activity's raw seven-dimension reflection into an AI-generated
 * Reflection Card — Story / My Contribution / Evidence / Demonstrated Skills
 * / Key Takeaway / Future Connection.
 *
 * ─── THE ONE RULE THAT MATTERS MORE THAN THE SHAPE ───────────────────────────
 *
 * The card must never state a fact the student did not. No invented numbers,
 * roles, outcomes, awards, quotes, organisations, or skills without a
 * behaviour in the student's own answers to back them. The system prompt
 * says this four different ways because a single instruction is exactly the
 * kind of constraint a model relaxes under a vague or thin input — better to
 * over-state the rule than have it generate a plausible-sounding fabrication
 * for a two-sentence answer.
 *
 * This is a plain request/response call (`openAiJsonCompletion`), not a new
 * provider integration — same infra `match-insights.ts` and
 * `personal-report-narrative-synthesis.ts` already use.
 */

export type ReflectionCardGenerationInput = {
  title: string;
  organisation?: string | undefined;
  /** The human label for the activity/achievement category, e.g. "Leadership & Initiative". */
  categoryLabel: string;
  reflection: ActivityReflectionValues;
  apiKey: string;
  model?: string;
};

function buildSystemPrompt(): string {
  return `You write a short, grounded "Reflection Card" summarising one student's account of a single activity or achievement, for a university application platform (GlowBal).

You will be given the student's own answers to seven reflection questions (Context, Motivation, Challenge, Action, Impact, Transformation, Future). Some answers may be missing — that is fine, work with what is there.

ABSOLUTE RULE — GROUNDING. Every claim in your output must be directly supported by the student's own words. Do not invent, estimate, or embellish:
- Do NOT invent numbers, statistics, or metrics the student did not state (no "40+ students", no percentages, no counts) unless that exact figure appears in the student's answers.
- Do NOT invent roles, titles, responsibilities, organisations, awards, or outcomes.
- Do NOT invent quotes or attribute opinions to other people the student did not mention.
- If the student gave no quantitative evidence, use qualitative evidence instead ("received positive feedback that the sessions made the material easier to understand" rather than a fabricated percentage).
- Every entry in "demonstratedSkills" must include an "evidence" string that paraphrases the specific behaviour in the student's answers that shows that skill — a skill with no supporting behaviour must not be included.
- Prefer 3-5 of the strongest, best-evidenced skills rather than a long generic list.
- If an answer is too thin to support a section (e.g. no impact was described), leave that output field empty rather than filling it with something generic.

Return ONLY a JSON object with this exact shape, no markdown fences, no commentary:
{
  "story": "2-4 sentences setting the scene — what this was and why it mattered, grounded in Context/Motivation.",
  "contributions": ["short phrase describing one thing the student personally did", ...],
  "evidence": ["a concrete, student-stated outcome or piece of evidence", ...],
  "demonstratedSkills": [{"skill": "Leadership", "evidence": "what in the student's answers shows this"}, ...],
  "keyTakeaway": "1-2 sentences on what the student learned or how they changed, grounded in Transformation.",
  "futureConnection": "1-2 sentences on how this connects to what the student wants to do next, grounded in Future."
}

"contributions" and "evidence" should have at most 6 entries each. Every field may be an empty string or empty array if the underlying answer was not provided — never pad with a placeholder.`;
}

function buildUserPrompt(input: ReflectionCardGenerationInput): string {
  const { title, organisation, categoryLabel, reflection } = input;
  const lines = [
    `Activity: ${title}`,
    organisation ? `Organisation: ${organisation}` : undefined,
    `Category: ${categoryLabel}`,
    '',
    'Student\'s reflection answers (their own words — do not add to them):',
    reflection.context ? `Context: ${reflection.context}` : undefined,
    reflection.motivation ? `Motivation: ${reflection.motivation}` : undefined,
    reflection.challenge ? `Challenge: ${reflection.challenge}` : undefined,
    reflection.action ? `Action: ${reflection.action}` : undefined,
    reflection.impact ? `Impact: ${reflection.impact}` : undefined,
    reflection.transformation ? `Transformation: ${reflection.transformation}` : undefined,
    reflection.future ? `Future: ${reflection.future}` : undefined,
  ].filter((line): line is string => line !== undefined);
  return lines.join('\n');
}

/** Throws on a hard failure (no key, network, unparsable/invalid response). */
export async function generateReflectionCard(
  input: ReflectionCardGenerationInput,
): Promise<ReflectionCardValues> {
  const { apiKey, model = defaultOpenAIModel() } = input;

  const content = await openAiJsonCompletion({
    apiKey,
    model,
    messages: [
      { role: 'system', content: buildSystemPrompt() },
      { role: 'user', content: buildUserPrompt(input) },
    ],
    temperature: 0.4,
    maxTokens: 1200,
  });

  const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const parsed = JSON.parse(cleaned) as Record<string, unknown>;

  const result = reflectionCardSchema.safeParse({
    story: typeof parsed.story === 'string' && parsed.story.trim() ? parsed.story.trim() : undefined,
    contributions: Array.isArray(parsed.contributions)
      ? parsed.contributions.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
      : [],
    evidence: Array.isArray(parsed.evidence)
      ? parsed.evidence.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
      : [],
    demonstratedSkills: Array.isArray(parsed.demonstratedSkills)
      ? parsed.demonstratedSkills
          .filter(
            (v): v is { skill: string; evidence?: string } =>
              Boolean(v) && typeof v === 'object' && typeof (v as { skill?: unknown }).skill === 'string',
          )
          .map((v) => ({
            skill: v.skill,
            ...(typeof v.evidence === 'string' && v.evidence.trim() ? { evidence: v.evidence } : {}),
          }))
      : [],
    keyTakeaway:
      typeof parsed.keyTakeaway === 'string' && parsed.keyTakeaway.trim()
        ? parsed.keyTakeaway.trim()
        : undefined,
    futureConnection:
      typeof parsed.futureConnection === 'string' && parsed.futureConnection.trim()
        ? parsed.futureConnection.trim()
        : undefined,
    status: 'generated',
  });

  if (!result.success) {
    throw new Error(`Reflection Card generation returned an invalid shape: ${result.error.message}`);
  }

  return result.data;
}
