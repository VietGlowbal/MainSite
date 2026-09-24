import { z } from 'zod';
import type { CmcaitfFields, ReflectionRecord } from '@/shared/evaluation';
import { openAiJsonCompletion, defaultOpenAIModel } from '../openai-client';
import { getReportPrompt } from '../runtime/prompt-registry';
import { sanitizeExtractedField } from './sanitize-extracted-field';

/**
 * F1 support — CMCAITF field extraction.
 *
 * The ONE genuinely semantic step F1 (`src/shared/evaluation/f1-reflection.ts`)
 * needs and does not perform itself: deciding which sentence of a student's
 * free-text achievement/activity `detail` maps to which CMCAITF slot (Context,
 * Motivation, Challenge, Action, Impact, Transformation, Future). Scoring what
 * comes out of this is deterministic (see f1-reflection.ts); only the mapping
 * from free text to structured fields is a model's job — core principle 9.
 *
 * ─── EVIDENCE-FIRST, EXTRACTION-ONLY ──────────────────────────────────────────
 *
 * This is an extractor, not a writer. The model is explicitly told to leave a
 * CMCAITF field null rather than paraphrase or invent one — the whole point of
 * `structuredCapture: false` on the resulting `ReflectionRecord` is that a
 * caller can see when a field was inferred from unstructured text rather than
 * captured directly, and F1 already discounts confidence when fields are
 * sparse regardless. Nothing here computes a score; that stays in
 * f1-reflection.ts.
 */

const cmcaitfFieldSchema = z.string().min(1).max(500).nullable();

const extractionItemSchema = z.object({
  activityId: z.string().min(1).max(160),
  context: cmcaitfFieldSchema,
  motivation: cmcaitfFieldSchema,
  challenge: cmcaitfFieldSchema,
  action: cmcaitfFieldSchema,
  impact: cmcaitfFieldSchema,
  transformation: cmcaitfFieldSchema,
  future: cmcaitfFieldSchema,
});

const extractionResponseSchema = z.object({
  items: z.array(extractionItemSchema).max(40),
});

export type CmcaitfExtractionInput = {
  id: string;
  title: string;
  /** Whatever free text exists for this activity/achievement — the only thing the model reads. */
  freeText: string;
};

// Prompt text and its version live in the shared registry (Task 2) so every
// generated record can name the exact instructions that produced it.
const { systemPrompt: SYSTEM_PROMPT } = getReportPrompt('cmcaitf_extraction');

function buildUserPrompt(inputs: readonly CmcaitfExtractionInput[]): string {
  return `Extract CMCAITF fields for each activity below. Respond with JSON only.\n${JSON.stringify(
    inputs.map((input) => ({ activityId: input.id, title: input.title, text: input.freeText })),
  )}`;
}

function toEmptyFields(): CmcaitfFields {
  return {
    context: null,
    motivation: null,
    challenge: null,
    action: null,
    impact: null,
    transformation: null,
    future: null,
  };
}

/**
 * Run the extraction call and return `ReflectionRecord`s ready for
 * `buildReflectionProfile`/`scoreReflection` — the extraction and the scoring
 * are two separate steps on purpose; this function does no scoring.
 *
 * Throws on a hard failure (no key, network, unparseable response) so the
 * caller can decide how to degrade — same contract as the rest of `lib/ai/*`.
 */
export async function extractCmcaitfFields(args: {
  inputs: readonly CmcaitfExtractionInput[];
  apiKey: string;
  model?: string | undefined;
}): Promise<ReflectionRecord[]> {
  const { inputs, apiKey, model = defaultOpenAIModel() } = args;

  const withText = inputs.filter((input) => input.freeText.trim().length > 0);
  if (withText.length === 0) {
    // Nothing to extract from — every record comes back with all-null
    // CMCAITF fields, which F1 correctly reports as `unassessed`. No model
    // call is made; there is nothing for one to read.
    return inputs.map((input) => ({
      id: input.id,
      title: input.title,
      cmcaitf: toEmptyFields(),
      structuredCapture: false,
    }));
  }

  const content = await openAiJsonCompletion({
    apiKey,
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(withText) },
    ],
    temperature: 0,
    maxTokens: 1800,
  });

  const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const parsed = extractionResponseSchema.parse(JSON.parse(cleaned));
  const byId = new Map(parsed.items.map((item) => [item.activityId, item]));

  return inputs.map((input) => {
    const extracted = byId.get(input.id);
    return {
      id: input.id,
      title: input.title,
      cmcaitf: extracted
        ? {
            context: sanitizeExtractedField(extracted.context),
            motivation: sanitizeExtractedField(extracted.motivation),
            challenge: sanitizeExtractedField(extracted.challenge),
            action: sanitizeExtractedField(extracted.action),
            impact: sanitizeExtractedField(extracted.impact),
            transformation: sanitizeExtractedField(extracted.transformation),
            future: sanitizeExtractedField(extracted.future),
          }
        : toEmptyFields(),
      structuredCapture: false,
    };
  });
}
