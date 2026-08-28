import { z } from 'zod';
import { openAiJsonCompletion, defaultOpenAIModel } from '../openai-client';
import { getReportPrompt } from '../runtime/prompt-registry';
import { sanitizeExtractedField } from './sanitize-extracted-field';

/**
 * F4 support — role and domain-theme extraction.
 *
 * `NarrativeActivity` (`src/shared/evaluation/f4-narrative-identity.ts`) needs
 * five fields per activity: role, behaviour, domainTheme, statedMotivation,
 * outcome. Three of those are already produced by F1's CMCAITF extraction
 * (`cmcaitf-extraction.ts`) reading the exact same free text —
 * `behaviour` = `cmcaitf.action`, `statedMotivation` = `cmcaitf.motivation`,
 * `outcome` = `cmcaitf.impact` (falling back to `cmcaitf.transformation`) —
 * and the Personal Report pipeline composes those deterministically rather
 * than asking a model to re-derive fields it has already extracted once.
 *
 * The two fields CMCAITF has no slot for are genuinely new semantic
 * judgements:
 *
 *   role         the capacity the student acted in — "ran weekly sessions
 *                for the club", not a job title like "Leader".
 *   domainTheme  the problem/domain this activity relates to — "education
 *                access", "environmental sustainability" — NEVER a
 *                competency label like "leadership" or "communication"
 *                (see f4-narrative-identity.ts's own warning on this).
 *
 * This module extracts only those two, from the same free text CMCAITF
 * reads. Grouping activities into theme-maturity buckets (F4.4) and scoring
 * pattern consistency (F4.3) stay entirely deterministic, downstream of this
 * extraction, in `src/features/apply/domain/personal-report.ts`.
 */

const roleThemeItemSchema = z.object({
  activityId: z.string().min(1).max(160),
  role: z.string().min(1).max(200).nullable(),
  domainTheme: z.string().min(1).max(120).nullable(),
});

const extractionResponseSchema = z.object({
  items: z.array(roleThemeItemSchema).max(40),
});

export type RoleThemeExtractionInput = {
  id: string;
  title: string;
  /** Whatever free text exists for this activity/achievement. */
  freeText: string;
};

export type RoleThemeExtractionResult = {
  id: string;
  role: string | null;
  domainTheme: string | null;
};

// Prompt text and its version live in the shared registry (Task 2).
const { systemPrompt: SYSTEM_PROMPT } = getReportPrompt('narrative_activity_extraction');

function buildUserPrompt(inputs: readonly RoleThemeExtractionInput[]): string {
  return `Extract role and domainTheme for each activity below. Respond with JSON only.\n${JSON.stringify(
    inputs.map((input) => ({ activityId: input.id, title: input.title, text: input.freeText })),
  )}`;
}

/**
 * Run the extraction call. Throws on a hard failure (no key, network,
 * unparseable response) so the caller can decide how to degrade — same
 * contract as `extractCmcaitfFields` and `extractCompetencyClaims`.
 */
export async function extractRoleAndTheme(args: {
  inputs: readonly RoleThemeExtractionInput[];
  apiKey: string;
  model?: string | undefined;
}): Promise<RoleThemeExtractionResult[]> {
  const { inputs, apiKey, model = defaultOpenAIModel() } = args;

  const withText = inputs.filter((input) => input.freeText.trim().length > 0);
  if (withText.length === 0) {
    return inputs.map((input) => ({ id: input.id, role: null, domainTheme: null }));
  }

  const content = await openAiJsonCompletion({
    apiKey,
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(withText) },
    ],
    temperature: 0,
    maxTokens: 1200,
  });

  const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const parsed = extractionResponseSchema.parse(JSON.parse(cleaned));
  const byId = new Map(parsed.items.map((item) => [item.activityId, item]));

  return inputs.map((input) => {
    const extracted = byId.get(input.id);
    return {
      id: input.id,
      role: sanitizeExtractedField(extracted?.role ?? null),
      domainTheme: sanitizeExtractedField(extracted?.domainTheme ?? null),
    };
  });
}
