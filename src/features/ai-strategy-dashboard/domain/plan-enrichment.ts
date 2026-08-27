import { z } from 'zod';
import type { AssessmentResult } from './assessment';
import type { DecisionResult } from './decision';
import type { ContentBlock } from '@/lib/match-insights';
import type { AiPlanningProvenance, PlanPhase, PlanResult, PlanStep } from './plan';

export const AI_PLAN_ENRICHMENT_VERSION = 'core3-plan-enrichment-v1';
export const AI_PLAN_ENRICHMENT_PROMPT_VERSION = 'core3-plan-enrichment-v1';

const clientKey = z.string().regex(/^[a-z][a-z0-9-]{0,47}$/);
const text = z.string().trim().min(3).max(220);
const contentSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('long_text'), prompt: text, minWords: z.number().int().min(1).max(2_000).optional() }).strict(),
  z.object({ type: z.literal('checklist'), items: z.array(text).min(1).max(12) }).strict(),
  z.object({
    type: z.literal('structured_table'),
    columns: z.array(z.object({
      key: clientKey, label: text, type: z.enum(['text', 'number', 'date', 'select']), options: z.array(text).min(1).max(12).optional(),
    }).strict()).min(1).max(6),
  }).strict(),
]);

const enrichmentSchema = z.object({
  version: z.literal(AI_PLAN_ENRICHMENT_VERSION),
  phases: z.array(z.object({
    sourceDecisionId: z.string().min(1).max(160),
    steps: z.array(z.object({
      clientKey,
      title: text,
      objective: z.string().trim().min(3).max(500),
      microSteps: z.array(z.object({
        clientKey,
        title: text,
        guidance: z.string().trim().min(3).max(500).optional(),
        contentSchema: contentSchema.nullable().optional(),
      }).strict()).min(1).max(6),
    }).strict()).min(1).max(6),
  }).strict()).max(4),
}).strict();

export type AiPlanEnrichment = z.infer<typeof enrichmentSchema>;
export type PlanEnrichmentValidationResult =
  | { ok: true; enrichment: AiPlanEnrichment }
  | { ok: false; errors: string[] };

/**
 * Pure boundary around untrusted model JSON. No output can carry execution
 * fields, a deadline, a semantic key, or a decision that Core 2 did not allow.
 */
export function validatePlanEnrichment(input: {
  scaffold: PlanResult;
  enrichment: unknown;
  decisions: readonly DecisionResult[];
  assessments: readonly AssessmentResult[];
  allowedDecisionIds: readonly string[];
}): PlanEnrichmentValidationResult {
  const parsed = enrichmentSchema.safeParse(input.enrichment);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map((issue) => issue.message) };
  const allowed = new Set(input.allowedDecisionIds);
  const decisionIds = new Set(input.decisions.map((decision) => decision.id));
  const scaffoldIds = new Set(input.scaffold.phases.flatMap((phase) => phase.sourceDecisionIds));
  const errors: string[] = [];
  const phaseKeys = new Set<string>();
  let microCount = 0;

  for (const phase of parsed.data.phases) {
    if (!decisionIds.has(phase.sourceDecisionId)) errors.push(`Unknown decision ${phase.sourceDecisionId}.`);
    if (!allowed.has(phase.sourceDecisionId)) errors.push(`Decision ${phase.sourceDecisionId} is not allowed to be enriched.`);
    if (!scaffoldIds.has(phase.sourceDecisionId)) errors.push(`Decision ${phase.sourceDecisionId} has no deterministic scaffold phase.`);
    if (phaseKeys.has(phase.sourceDecisionId)) errors.push(`Duplicate enrichment phase ${phase.sourceDecisionId}.`);
    phaseKeys.add(phase.sourceDecisionId);
    const stepKeys = new Set<string>();
    for (const step of phase.steps) {
      if (stepKeys.has(step.clientKey)) errors.push(`Duplicate step clientKey ${step.clientKey}.`);
      stepKeys.add(step.clientKey);
      const microKeys = new Set<string>();
      for (const micro of step.microSteps) {
        microCount += 1;
        if (microKeys.has(micro.clientKey)) errors.push(`Duplicate micro-step clientKey ${micro.clientKey}.`);
        microKeys.add(micro.clientKey);
        if (micro.contentSchema?.type === 'structured_table') {
          const columns = new Set(micro.contentSchema.columns.map((column) => column.key));
          if (columns.size !== micro.contentSchema.columns.length) errors.push(`Duplicate table column key on ${micro.clientKey}.`);
        }
      }
    }
  }
  if (microCount > 24) errors.push('Enrichment exceeds the maximum of 24 micro-steps.');
  return errors.length > 0 ? { ok: false, errors } : { ok: true, enrichment: parsed.data };
}

/** Purely replaces an explicitly enrichable deterministic placeholder. */
export function mergePlanEnrichment(
  scaffold: PlanResult,
  enrichment: AiPlanEnrichment,
  provenance: AiPlanningProvenance,
): PlanResult {
  const enrichedByDecision = new Map(enrichment.phases.map((phase) => [phase.sourceDecisionId, phase]));
  const phases = scaffold.phases.map((phase) => {
    const sourceDecisionId = phase.sourceDecisionIds.find((id) => enrichedByDecision.has(id));
    if (!sourceDecisionId) return phase;
    const proposal = enrichedByDecision.get(sourceDecisionId)!;
    return {
      ...phase,
      sourceProvenances: appendProvenance(phase.sourceProvenances, provenance),
      steps: proposal.steps.map((step, index) => enrichedStep(phase, sourceDecisionId, step, index + 1, provenance)),
    };
  });
  return { ...scaffold, id: `${scaffold.id}:enriched:${AI_PLAN_ENRICHMENT_VERSION}`, phases };
}

function enrichedStep(
  phase: PlanPhase,
  decisionId: string,
  proposal: AiPlanEnrichment['phases'][number]['steps'][number],
  order: number,
  provenance: AiPlanningProvenance,
): PlanStep {
  const stepId = `ai:${stable(decisionId)}:step:${proposal.clientKey}`;
  return {
    id: stepId,
    title: proposal.title,
    objective: proposal.objective,
    order,
    sourceDecisionIds: [decisionId],
    sourceProvenances: appendProvenance(phase.sourceProvenances, provenance),
    microSteps: proposal.microSteps.map((micro, microOrder) => ({
      id: `ai:${stable(decisionId)}:micro:${proposal.clientKey}:${micro.clientKey}`,
      title: micro.title,
      guidance: micro.guidance ?? `Complete this task: ${micro.title} ${proposal.objective}`,
      order: microOrder + 1,
      readiness: micro.contentSchema ? 'requires_user_input' : 'requires_enrichment',
      contentSchema: (micro.contentSchema ?? null) as ContentBlock | null,
      sourceDecisionIds: [decisionId],
      sourceProvenances: appendProvenance(phase.sourceProvenances, provenance),
    })),
  };
}

function appendProvenance<T>(items: readonly T[], provenance: AiPlanningProvenance): Array<T | AiPlanningProvenance> {
  return [...items, provenance];
}

function stable(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'unknown';
}
