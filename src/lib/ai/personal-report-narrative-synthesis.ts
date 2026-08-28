import { z } from 'zod';
import type { PersonalReportV2, SignaturePatternStepKey } from '@/features/apply/domain';
import type { EvidenceRef, ProfileEvaluation, ProfileEvaluationInput } from '@/shared/evaluation';
import type { EvidenceBank } from '@/shared/evidence/domain';
import { openAiJsonCompletion } from './openai-client';
import { getReportPrompt } from './runtime/prompt-registry';

/**
 * The constrained narrative-synthesis stage (implementation spec §9, §14,
 * §25): the ONE place an LLM is allowed to touch the Personal Report's prose.
 *
 * ─── WHAT THIS DOES AND DOES NOT DO ──────────────────────────────────────────
 *
 * Every headline/paragraph/statement below is currently built by naive
 * template concatenation in `src/features/apply/domain/personal-report.ts`
 * ("Someone who ${behaviour}") — functionally correct, but exactly the
 * "low-level framework output" the redesign spec calls out. This module asks
 * a model for BETTER LANGUAGE over the SAME structured facts that module
 * already computed — it receives only already-decided structured findings
 * (recurring role/behaviour, pattern steps, positioning booleans, evidence
 * IDs) and is never shown raw free text it could invent additional facts
 * from. It cannot change a score, a confidence level, or an
 * available/insufficient-data verdict — those stay exactly what the
 * deterministic domain layer already decided; this only replaces prose for
 * sections already marked `available: true`.
 *
 * ─── VALIDATION IS THE SAFETY NET, NOT THE PROMPT ────────────────────────────
 *
 * Every evidence ID the model returns is checked against the exact set this
 * report actually has (`allowedEvidenceIds` below) — an ID outside that set
 * fails the WHOLE synthesis, not just one section, and the caller falls back
 * to the existing deterministic template copy entirely. A polished sentence
 * that cites evidence that doesn't exist is worse than a plain one that
 * doesn't, so there is no partial-acceptance path.
 */

const MAX_PARAGRAPHS = 3;
const MAX_EVIDENCE_IDS = 12;

const textSectionSchema = z.object({
  headline: z.string().min(1).max(200),
  paragraphs: z.array(z.string().min(1).max(700)).min(1).max(MAX_PARAGRAPHS),
  evidenceIds: z.array(z.string().min(1).max(160)).min(1).max(MAX_EVIDENCE_IDS),
});

const narrativeSectionSchema = z.object({
  paragraphs: z.array(z.string().min(1).max(700)).min(1).max(MAX_PARAGRAPHS),
  evidenceIds: z.array(z.string().min(1).max(160)).min(1).max(MAX_EVIDENCE_IDS),
});

const snapshotSchema = z.object({
  // The model is asked for a 150-200 word summary, but a shorter grounded
  // response must not discard the complete report. The deterministic snapshot
  // remains available when the optional AI summary is omitted.
  summary: z.string().min(1).max(1600),
});

const synthesisResponseSchema = z.object({
  snapshot: snapshotSchema.optional(),
  overview: z
    .object({
      summary: z.string().min(1).max(700),
      evidenceIds: z.array(z.string().min(1).max(160)).min(1).max(MAX_EVIDENCE_IDS),
    })
    .nullable(),
  coreIdentity: textSectionSchema.nullable(),
  drivingForce: textSectionSchema.nullable(),
  signaturePattern: narrativeSectionSchema.nullable(),
  emergingThemes: narrativeSectionSchema.nullable(),
  personalPositioning: z
    .object({
      statement: z.string().min(1).max(500),
      whyItFits: z.array(z.string().min(1).max(300)).min(1).max(5),
      evidenceIds: z.array(z.string().min(1).max(160)).min(1).max(MAX_EVIDENCE_IDS),
    })
    .nullable(),
  proofOfMe: narrativeSectionSchema.nullable(),
  overallSummary: z
    .object({
      paragraphs: z.array(z.string().min(1).max(700)).min(1).max(MAX_PARAGRAPHS),
      evidenceIds: z.array(z.string().min(1).max(160)).min(1).max(MAX_EVIDENCE_IDS),
    })
    .nullable(),
});

export type PersonalReportNarrativeSynthesis = {
  snapshot?: { summary: string };
  overview: { summary: string; evidenceRefs: EvidenceRef[] } | null;
  coreIdentity: { headline: string; paragraphs: string[]; evidenceRefs: EvidenceRef[] } | null;
  drivingForce: { headline: string; paragraphs: string[]; evidenceRefs: EvidenceRef[] } | null;
  signaturePattern: { paragraphs: string[]; evidenceRefs: EvidenceRef[] } | null;
  emergingThemes: { paragraphs: string[]; evidenceRefs: EvidenceRef[] } | null;
  personalPositioning: { statement: string; whyItFits: string[]; evidenceRefs: EvidenceRef[] } | null;
  proofOfMe: { paragraphs: string[]; evidenceRefs: EvidenceRef[] } | null;
  overallSummary: { paragraphs: string[]; evidenceRefs: EvidenceRef[] } | null;
};

export type PersonalReportNarrativeGrounding = {
  evaluationInput: ProfileEvaluationInput;
  evaluation: ProfileEvaluation;
  evidenceBank: EvidenceBank | null;
};

export type PersonalReportNarrativeFailureCode =
  | 'invalid_json'
  | 'schema_snapshot_summary'
  | 'schema_response'
  | 'missing_sections'
  | 'invalid_evidence_ids'
  | 'output_truncated'
  | 'timeout'
  | 'provider_error'
  | 'unsupported_narrative_fact'
  | 'unknown';

// Prompt text and its version live in the shared registry (Task 2).
const { systemPrompt: SYSTEM_PROMPT } = getReportPrompt('report_narrative_synthesis');

type SynthesisSectionInput = {
  coreIdentity: {
    recurringRole: string | null;
    recurringBehaviour: string | null;
    valueOrientation: string | null;
    observations: string[];
  } | null;
  drivingForce: {
    statedMotivation: string | null;
    isHypothesis: boolean;
    repeatedMotivations: string[];
    missingPersonalGrounding: string | null;
  } | null;
  signaturePattern: {
    patternStrength: 'established' | 'emerging';
    steps: { key: SignaturePatternStepKey; label: string; description: string }[];
  } | null;
  emergingThemes: {
    themes: Array<{
      theme: string;
      status: string;
      explanation: string;
      supportingExperiences: string[];
      limitation: string;
    }>;
  } | null;
  personalPositioning: {
    identity: string | null;
    motivations: string[];
    capabilities: string[];
    signatureStrength: string | null;
    theme: string | null;
    intendedDirection: string | null;
    authentic: boolean;
    differentiated: boolean;
    coherent: boolean;
    directionAligned: boolean;
    credible: boolean;
  } | null;
  proofOfMe: {
    cards: Array<{
      title: string;
      role: string | null;
      personalContribution: string | null;
      outcome: string | null;
      competenciesDemonstrated: string[];
      evidenceStrength: string;
      verificationStatus: string;
    }>;
  } | null;
  overall: {
    confidence: string;
    themes: string[];
    evidenceItemCount: number;
  };
};

/** Everything the deterministic report already decided, reduced to what the synthesis stage is allowed to see. */
export function synthesisInputFromReport(
  report: PersonalReportV2,
  intendedDirection: string | null,
): SynthesisSectionInput {
  return {
    coreIdentity: report.coreIdentity.available
      ? {
          recurringRole: report.coreIdentity.recurringRole,
          recurringBehaviour: report.coreIdentity.recurringBehaviours[0] ?? null,
          valueOrientation: report.coreIdentity.valueOrientation,
          observations: report.coreIdentity.observations,
        }
      : null,
    drivingForce: report.drivingForce.available
      ? {
          statedMotivation: report.drivingForce.repeatedMotivations[0] ?? null,
          isHypothesis: report.drivingForce.isHypothesis,
          repeatedMotivations: report.drivingForce.repeatedMotivations,
          missingPersonalGrounding: report.drivingForce.missingPersonalGrounding,
        }
      : null,
    signaturePattern: report.signaturePattern.available
      ? {
          patternStrength:
            report.signaturePattern.patternStrength === 'established' ? 'established' : 'emerging',
          steps: report.signaturePattern.steps.map((step) => ({
            key: step.key,
            label: step.label,
            description: step.description,
          })),
        }
      : null,
    emergingThemes: report.emergingThemes.available
      ? {
          themes: report.emergingThemes.themes.map((theme) => ({
            theme: theme.theme,
            status: theme.statusLabel,
            explanation: theme.explanation,
            supportingExperiences: theme.supportingExperiences,
            limitation: theme.limitation,
          })),
        }
      : null,
    personalPositioning: report.personalPositioning.available
      ? {
          identity: report.coreIdentity.recurringBehaviours[0] ?? report.coreIdentity.recurringRole,
          motivations: report.drivingForce.repeatedMotivations,
          capabilities: Array.from(
            new Set(report.proofOfMe.cards.flatMap((card) => card.competenciesDemonstrated)),
          ),
          signatureStrength: report.signaturePattern.available
            ? report.signaturePattern.steps.find((step) => step.key === 'method')?.description ?? null
            : null,
          theme: report.emergingThemes.themes[0]?.theme ?? null,
          intendedDirection,
          authentic: report.personalPositioning.authentic,
          differentiated: report.personalPositioning.differentiated,
          coherent: report.personalPositioning.coherent,
          directionAligned: report.personalPositioning.directionAligned,
          credible: report.personalPositioning.credible,
        }
      : null,
    proofOfMe: report.proofOfMe.available
      ? {
          cards: report.proofOfMe.cards.map((card) => ({
            title: card.title,
            role: card.role,
            personalContribution: card.personalContribution,
            outcome: card.outcome,
            competenciesDemonstrated: card.competenciesDemonstrated,
            evidenceStrength: card.evidenceStrength,
            verificationStatus: card.verificationStatus,
          })),
        }
      : null,
    overall: {
      confidence: report.overallEvidenceConfidence,
      themes: report.emergingThemes.themes.map((theme) => theme.theme),
      evidenceItemCount: report.proofOfMe.cards.length,
    },
  };
}

/** Every evidence id this report actually has — the only ids the model is allowed to cite. */
export function allowedEvidenceIdsFor(report: PersonalReportV2): Map<string, EvidenceRef> {
  const all: EvidenceRef[] = [
    ...report.coreIdentity.evidenceRefs,
    ...report.drivingForce.evidenceRefs,
    ...report.signaturePattern.evidenceRefs,
    ...report.emergingThemes.themes.flatMap((theme) => theme.evidenceRefs),
    ...report.personalPositioning.evidenceRefs,
    ...report.proofOfMe.cards.flatMap((card) => card.evidenceRefs),
  ];
  return new Map(all.map((ref) => [ref.id, ref]));
}

function evidenceMap(refs: readonly EvidenceRef[]): Map<string, EvidenceRef> {
  return new Map(refs.map((ref) => [ref.id, ref]));
}

function allowedEvidenceIdsBySection(report: PersonalReportV2) {
  return {
    coreIdentity: evidenceMap(report.coreIdentity.evidenceRefs),
    drivingForce: evidenceMap(report.drivingForce.evidenceRefs),
    signaturePattern: evidenceMap(report.signaturePattern.evidenceRefs),
    emergingThemes: evidenceMap(report.emergingThemes.themes.flatMap((theme) => theme.evidenceRefs)),
    personalPositioning: evidenceMap(report.personalPositioning.evidenceRefs),
    proofOfMe: evidenceMap(report.proofOfMe.cards.flatMap((card) => card.evidenceRefs)),
  };
}

function reasoningBundle(
  grounding: PersonalReportNarrativeGrounding,
  report: PersonalReportV2,
  intendedDirection: string | null,
) {
  return {
    // Only deterministic findings are exposed to the prose model. Raw
    // activity/reflection text stays in the extraction/grounding stages, so
    // the narrative model cannot promote an unseen fact into the report.
    structuredFindings: {
      input: synthesisInputFromReport(report, intendedDirection),
      report: {
        overallEvidenceConfidence: report.overallEvidenceConfidence,
        availableSections: Object.entries(report)
          .filter(([, value]) => Boolean(value && typeof value === 'object' && 'available' in value && (value as { available: boolean }).available))
          .map(([key]) => key),
      },
    },
    evidenceBank: grounding.evidenceBank
      ? {
          claims: grounding.evidenceBank.claims,
          missingInformation: grounding.evidenceBank.missingInformation,
        }
      : null,
  };
}

function narrativeNumbers(value: string): string[] {
  return value.match(/\d+(?:[.,]\d+)?/g) ?? [];
}

/** Rejects a prose response that introduces a numeric fact absent from the
 * deterministic section findings (e.g. an invented team size or outcome). */
function assertNarrativeNumbersAreGrounded(
  parsed: z.infer<typeof synthesisResponseSchema>,
  sectionInput: SynthesisSectionInput,
): void {
  const allowed = new Set(narrativeNumbers(JSON.stringify(sectionInput)));
  const prose: string[] = [
    parsed.snapshot?.summary,
    parsed.overview?.summary,
    parsed.coreIdentity?.headline,
    ...(parsed.coreIdentity?.paragraphs ?? []),
    parsed.drivingForce?.headline,
    ...(parsed.drivingForce?.paragraphs ?? []),
    ...(parsed.signaturePattern?.paragraphs ?? []),
    ...(parsed.emergingThemes?.paragraphs ?? []),
    parsed.personalPositioning?.statement,
    ...(parsed.personalPositioning?.whyItFits ?? []),
    ...(parsed.proofOfMe?.paragraphs ?? []),
    ...(parsed.overallSummary?.paragraphs ?? []),
  ].filter((value): value is string => Boolean(value));
  if (prose.some((value) => narrativeNumbers(value).some((number) => !allowed.has(number)))) {
    throw new Error('Narrative synthesis introduced an unsupported numeric fact.');
  }
}

function hydrate(ids: readonly string[], allowed: ReadonlyMap<string, EvidenceRef>): EvidenceRef[] | null {
  const refs: EvidenceRef[] = [];
  for (const id of ids) {
    const ref = allowed.get(id);
    if (!ref) return null; // an unknown id fails the whole synthesis — see module header.
    refs.push(ref);
  }
  return refs;
}

function normalizeEmptyOptionalSections(
  value: Record<string, unknown>,
  sectionInput: SynthesisSectionInput,
): Record<string, unknown> {
  const normalized = { ...value };
  for (const key of [
    'coreIdentity',
    'drivingForce',
    'signaturePattern',
    'emergingThemes',
    'personalPositioning',
    'proofOfMe',
  ] as const) {
    const section = normalized[key];
    if (!sectionInput[key] && section && typeof section === 'object') normalized[key] = null;
  }
  for (const key of ['overview', 'overallSummary'] as const) {
    const section = normalized[key];
    if (
      section &&
      typeof section === 'object' &&
      Array.isArray((section as { evidenceIds?: unknown }).evidenceIds) &&
      (section as { evidenceIds: unknown[] }).evidenceIds.length === 0
    ) {
      normalized[key] = null;
    }
  }
  return normalized;
}

function failureCode(error: unknown): PersonalReportNarrativeFailureCode {
  if (error instanceof SyntaxError) return 'invalid_json';
  if (error instanceof z.ZodError) {
    return error.issues.some((issue) => issue.path.join('.') === 'snapshot.summary')
      ? 'schema_snapshot_summary'
      : 'schema_response';
  }
  const message = error instanceof Error ? error.message : '';
  if (/cover every available report section/i.test(message)) return 'missing_sections';
  if (/cited evidence outside its section/i.test(message)) return 'invalid_evidence_ids';
  if (/unsupported numeric fact/i.test(message)) return 'unsupported_narrative_fact';
  if (/exceeded the token limit/i.test(message)) return 'output_truncated';
  if (/request timed out/i.test(message)) return 'timeout';
  if (/OpenAI request failed/i.test(message)) return 'provider_error';
  return 'unknown';
}

export async function synthesizePersonalReportNarrative(args: {
  report: PersonalReportV2;
  intendedDirection: string | null;
  apiKey: string;
  model: string;
  grounding: PersonalReportNarrativeGrounding;
  onFailure?: (code: PersonalReportNarrativeFailureCode) => void;
}): Promise<PersonalReportNarrativeSynthesis | null> {
  const { report, intendedDirection, apiKey, model } = args;
  const sectionInput = synthesisInputFromReport(report, intendedDirection);
  const allowed = allowedEvidenceIdsFor(report);
  const allowedBySection = allowedEvidenceIdsBySection(report);

  // Nothing available to write about yet — do not call the model for an
  // empty report; every section would come back null anyway.
  if (
    !sectionInput.coreIdentity &&
    !sectionInput.drivingForce &&
    !sectionInput.signaturePattern &&
    !sectionInput.emergingThemes &&
    !sectionInput.personalPositioning &&
    !sectionInput.proofOfMe
  ) {
    return null;
  }

  const userPrompt = JSON.stringify({
    input: sectionInput,
    reasoningBundle: reasoningBundle(args.grounding, report, intendedDirection),
    allowedEvidenceIds: {
      all: [...allowed.keys()],
      coreIdentity: [...allowedBySection.coreIdentity.keys()],
      drivingForce: [...allowedBySection.drivingForce.keys()],
      signaturePattern: [...allowedBySection.signaturePattern.keys()],
      emergingThemes: [...allowedBySection.emergingThemes.keys()],
      personalPositioning: [...allowedBySection.personalPositioning.keys()],
      proofOfMe: [...allowedBySection.proofOfMe.keys()],
    },
  });

  try {
    const content = await openAiJsonCompletion({
      apiKey,
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.4,
      maxTokens: 1800,
    });

    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const raw = JSON.parse(cleaned) as Record<string, unknown>;
    const parsed = synthesisResponseSchema.parse(normalizeEmptyOptionalSections(raw, sectionInput));
    assertNarrativeNumbersAreGrounded(parsed, sectionInput);

    if (
      Boolean(parsed.coreIdentity) !== Boolean(sectionInput.coreIdentity) ||
      Boolean(parsed.drivingForce) !== Boolean(sectionInput.drivingForce) ||
      Boolean(parsed.signaturePattern) !== Boolean(sectionInput.signaturePattern) ||
      Boolean(parsed.emergingThemes) !== Boolean(sectionInput.emergingThemes) ||
      Boolean(parsed.personalPositioning) !== Boolean(sectionInput.personalPositioning) ||
      Boolean(parsed.proofOfMe) !== Boolean(sectionInput.proofOfMe)
    ) {
      throw new Error('Narrative synthesis must cover every available report section.');
    }

    const snapshot = parsed.snapshot ? { summary: parsed.snapshot.summary } : undefined;
    const overview = parsed.overview
      ? (() => {
          const evidenceRefs = hydrate(parsed.overview!.evidenceIds, allowed);
          return evidenceRefs ? { summary: parsed.overview!.summary, evidenceRefs } : null;
        })()
      : null;

    const coreIdentity =
      parsed.coreIdentity && sectionInput.coreIdentity
        ? (() => {
          const evidenceRefs = hydrate(parsed.coreIdentity!.evidenceIds, allowedBySection.coreIdentity);
            return evidenceRefs
              ? { headline: parsed.coreIdentity!.headline, paragraphs: parsed.coreIdentity!.paragraphs, evidenceRefs }
              : null;
          })()
        : null;

    const drivingForce =
      parsed.drivingForce && sectionInput.drivingForce
        ? (() => {
          const evidenceRefs = hydrate(parsed.drivingForce!.evidenceIds, allowedBySection.drivingForce);
            return evidenceRefs
              ? { headline: parsed.drivingForce!.headline, paragraphs: parsed.drivingForce!.paragraphs, evidenceRefs }
              : null;
          })()
        : null;

    const signaturePattern =
      parsed.signaturePattern && sectionInput.signaturePattern
        ? (() => {
            const evidenceRefs = hydrate(parsed.signaturePattern!.evidenceIds, allowedBySection.signaturePattern);
            return evidenceRefs ? { paragraphs: parsed.signaturePattern!.paragraphs, evidenceRefs } : null;
          })()
        : null;

    const emergingThemes =
      parsed.emergingThemes && sectionInput.emergingThemes
        ? (() => {
            const evidenceRefs = hydrate(parsed.emergingThemes!.evidenceIds, allowedBySection.emergingThemes);
            return evidenceRefs ? { paragraphs: parsed.emergingThemes!.paragraphs, evidenceRefs } : null;
          })()
        : null;

    const personalPositioning =
      parsed.personalPositioning && sectionInput.personalPositioning
        ? (() => {
          const evidenceRefs = hydrate(parsed.personalPositioning!.evidenceIds, allowedBySection.personalPositioning);
            return evidenceRefs
              ? {
                  statement: parsed.personalPositioning!.statement,
                  whyItFits: parsed.personalPositioning!.whyItFits,
                  evidenceRefs,
                }
              : null;
          })()
        : null;

    const proofOfMe =
      parsed.proofOfMe && sectionInput.proofOfMe
        ? (() => {
            const evidenceRefs = hydrate(parsed.proofOfMe!.evidenceIds, allowedBySection.proofOfMe);
            return evidenceRefs ? { paragraphs: parsed.proofOfMe!.paragraphs, evidenceRefs } : null;
          })()
        : null;

    const overallSummary = parsed.overallSummary
      ? (() => {
          const evidenceRefs = hydrate(parsed.overallSummary!.evidenceIds, allowed);
          return evidenceRefs ? { paragraphs: parsed.overallSummary!.paragraphs, evidenceRefs } : null;
        })()
      : null;

    if (
      (sectionInput.coreIdentity && !coreIdentity) ||
      (sectionInput.drivingForce && !drivingForce) ||
      (sectionInput.signaturePattern && !signaturePattern) ||
      (sectionInput.emergingThemes && !emergingThemes) ||
      (sectionInput.personalPositioning && !personalPositioning) ||
      (sectionInput.proofOfMe && !proofOfMe)
    ) {
      throw new Error('Narrative synthesis cited evidence outside its section.');
    }

    return {
      ...(snapshot ? { snapshot } : {}),
      overview,
      coreIdentity,
      drivingForce,
      signaturePattern,
      emergingThemes,
      personalPositioning,
      proofOfMe,
      overallSummary,
    };
  } catch (error) {
    const code = failureCode(error);
    args.onFailure?.(code);
    const detail = error instanceof Error ? error.message.slice(0, 240) : String(error).slice(0, 240);
    console.error('[personal-report-narrative-synthesis] rejected', {
      code,
      detail: code === 'provider_error' ? detail : undefined,
      model,
    });
    return null;
  }
}

/**
 * Overlays a validated synthesis onto the deterministic report — prose only,
 * never a score, confidence, or availability verdict. `synthesis === null`
 * (not configured, call failed, or validation rejected it) returns `report`
 * completely unchanged, which is what makes this safe to call unconditionally
 * from the generation orchestration.
 */
export function applyNarrativeSynthesis(
  report: PersonalReportV2,
  synthesis: PersonalReportNarrativeSynthesis | null,
): PersonalReportV2 {
  if (!synthesis) return report;

  return {
    ...report,
    ...(synthesis.snapshot ? { snapshot: synthesis.snapshot } : {}),
    overview: synthesis.overview ?? report.overview ?? null,
    coreIdentity:
      synthesis.coreIdentity && report.coreIdentity.available
        ? {
            ...report.coreIdentity,
            headline: synthesis.coreIdentity.headline,
            interpretation: synthesis.coreIdentity.paragraphs.join('\n\n'),
          }
        : report.coreIdentity,
    drivingForce:
      synthesis.drivingForce && report.drivingForce.available
        ? {
            ...report.drivingForce,
            headline: synthesis.drivingForce.headline,
            explanation: synthesis.drivingForce.paragraphs.join('\n\n'),
          }
        : report.drivingForce,
    signaturePattern:
      synthesis.signaturePattern && report.signaturePattern.available
        ? {
            ...report.signaturePattern,
            distinctiveness: synthesis.signaturePattern.paragraphs.join('\n\n'),
          }
        : report.signaturePattern,
    emergingThemes:
      synthesis.emergingThemes && report.emergingThemes.available
        ? {
            ...report.emergingThemes,
            narrative: synthesis.emergingThemes.paragraphs.join('\n\n'),
          }
        : report.emergingThemes,
    personalPositioning:
      synthesis.personalPositioning && report.personalPositioning.available
        ? {
            ...report.personalPositioning,
            statement: synthesis.personalPositioning.statement,
            whyThisFits: synthesis.personalPositioning.whyItFits,
          }
        : report.personalPositioning,
    proofOfMe:
      synthesis.proofOfMe && report.proofOfMe.available
        ? {
            ...report.proofOfMe,
            narrative: synthesis.proofOfMe.paragraphs.join('\n\n'),
          }
        : report.proofOfMe,
    overallSummary: synthesis.overallSummary ?? report.overallSummary ?? null,
  };
}
