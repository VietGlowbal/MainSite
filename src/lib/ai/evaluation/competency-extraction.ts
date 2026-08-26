import { z } from 'zod';
import type { CompetencyClaim, CompetencyType, EvidenceRef } from '@/shared/evaluation';
import { openAiJsonCompletion, defaultOpenAIModel } from '../openai-client';
import { getReportPrompt } from '../runtime/prompt-registry';
import { sanitizeExtractedField } from './sanitize-extracted-field';

/**
 * F2 support — competency claim extraction.
 *
 * The genuinely semantic step F2 (`src/shared/evaluation/f2-competency.ts`)
 * needs: recognising WHICH named competency a piece of student evidence
 * demonstrates, and writing the grounding sentence describing the concrete
 * situation. Deciding how well-grounded that claim actually is — and
 * therefore how much it should score — is deterministic and happens entirely
 * in f2-competency.ts's `scoreGroundedness`, not here. This module produces
 * candidate claims; it never scores them.
 *
 * ─── WHY THE MODEL CANNOT SET ITS OWN GROUNDEDNESS ───────────────────────────
 *
 * Core principle 4: assumptions are never allowed in scoring. If this module
 * asked the model to also rate how well-grounded its own claim was, the
 * engine would be trusting a model's confidence in its own output — exactly
 * the failure this whole engine exists to avoid. So the extractor's only job
 * is to propose { type, label, situation, evidenceRefs }; `scoreGroundedness`
 * independently checks whether `situation` actually contains a concrete
 * detail and whether `evidenceRefs` backs it, and would down-score a claim
 * the model over-stated just as readily as one it under-stated.
 */

const claimSchema = z.object({
  id: z.string().min(1).max(160),
  type: z.enum(['hard', 'soft', 'meta']),
  label: z.string().min(1).max(120),
  situation: z.string().max(600).nullable(),
  evidenceIds: z.array(z.string().min(1).max(160)).max(4),
});

const extractionResponseSchema = z.object({
  claims: z.array(claimSchema).max(30),
});

export type CompetencyExtractionSource = {
  id: string;
  kind: string;
  /** Everything the model is allowed to read for this source — title, detail, description. */
  text: string;
};

// Prompt text and its version live in the shared registry (Task 2).
const { systemPrompt: SYSTEM_PROMPT } = getReportPrompt('competency_extraction');

function buildUserPrompt(sources: readonly CompetencyExtractionSource[]): string {
  return `Extract competency claims from the evidence below. Respond with JSON only.\n${JSON.stringify(
    sources.map((source) => ({ sourceId: source.id, kind: source.kind, text: source.text })),
  )}`;
}

export async function extractCompetencyClaims(args: {
  sources: readonly CompetencyExtractionSource[];
  apiKey: string;
  model?: string | undefined;
}): Promise<CompetencyClaim[]> {
  const { sources, apiKey, model = defaultOpenAIModel() } = args;

  const withText = sources.filter((source) => source.text.trim().length > 0);
  if (withText.length === 0) return [];

  const content = await openAiJsonCompletion({
    apiKey,
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(withText) },
    ],
    temperature: 0.2,
    maxTokens: 2400,
  });

  const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const parsed = extractionResponseSchema.parse(JSON.parse(cleaned));
  const sourceById = new Map(withText.map((source) => [source.id, source]));

  return parsed.claims.map((claim, index) => {
    const evidenceRefs: EvidenceRef[] = claim.evidenceIds
      .filter((id) => sourceById.has(id))
      .map((id) => {
        const source = sourceById.get(id) as CompetencyExtractionSource;
        return { id: source.id, kind: source.kind, label: source.text.slice(0, 120) };
      });

    return {
      id: claim.id || `claim-${index + 1}`,
      type: claim.type as CompetencyType,
      label: claim.label,
      situation: sanitizeExtractedField(claim.situation),
      evidenceRefs,
    };
  });
}
