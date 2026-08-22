import { defaultOpenAIModel, isOpenAIConfigured, openAiJsonCompletion } from '@/lib/ai/openai-client';
import { AI_PLAN_ENRICHMENT_PROMPT_VERSION, AI_PLAN_ENRICHMENT_VERSION, mergePlanEnrichment, validatePlanEnrichment, type AssessmentResult, type DecisionResult, type PlanResult } from '../domain';
import type { PlanningContext } from '../domain/planning-context';

type EnrichmentResult = { plan: PlanResult; enriched: boolean; fallbackReason?: string };

/** The only Core 3 AI boundary; a failure always returns the deterministic scaffold. */
export async function generatePlanEnrichment(input: { scaffold: PlanResult; decisions: readonly DecisionResult[]; assessments: readonly AssessmentResult[]; context: PlanningContext }): Promise<EnrichmentResult> {
  const allowedDecisionIds = allowedScopes(input.decisions, input.context);
  if (allowedDecisionIds.length === 0) return { plan: input.scaffold, enriched: false };
  if (!isOpenAIConfigured()) return { plan: input.scaffold, enriched: false, fallbackReason: 'not_configured' };
  const model = defaultOpenAIModel();
  try {
    const raw = await openAiJsonCompletion({ apiKey: process.env.OPENAI_API_KEY!, model, messages: [
      { role: 'system', content: systemPrompt() }, { role: 'user', content: JSON.stringify(narrowInput(input, allowedDecisionIds)) },
    ], temperature: 0.2, maxTokens: 3_200, timeoutMs: 30_000 });
    const parsed = JSON.parse(raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()) as unknown;
    const validation = validatePlanEnrichment({ ...input, enrichment: parsed, allowedDecisionIds });
    if (!validation.ok) {
      console.warn('[planner/enrichment] rejected model output', { errorCount: validation.errors.length });
      return { plan: input.scaffold, enriched: false, fallbackReason: 'validation_failed' };
    }
    const provenance = { kind: 'ai_planning' as const, provider: 'openai' as const, model, promptVersion: AI_PLAN_ENRICHMENT_PROMPT_VERSION, enrichmentVersion: AI_PLAN_ENRICHMENT_VERSION, generatedAt: new Date().toISOString(), sourceDecisionIds: allowedDecisionIds };
    const plan = mergePlanEnrichment(input.scaffold, validation.enrichment, provenance);
    console.info('[planner/enrichment] accepted', { model, scopes: allowedDecisionIds.length });
    return { plan, enriched: true };
  } catch (error) {
    console.warn('[planner/enrichment] provider failed; using deterministic scaffold', { message: error instanceof Error ? error.message : 'unknown error' });
    return { plan: input.scaffold, enriched: false, fallbackReason: 'provider_failed' };
  }
}

function allowedScopes(decisions: readonly DecisionResult[], context: PlanningContext): string[] {
  const selectedAttention = context.plannerInputs?.some((input) => input.semanticKey === 'planner.attention_focus') ?? false;
  return decisions.filter((decision) => decision.status === 'blocked' || (decision.id === 'decision:attention-focus' && decision.status === 'available' && selectedAttention)).map((decision) => decision.id).sort();
}

function narrowInput(input: Parameters<typeof generatePlanEnrichment>[0], allowedDecisionIds: readonly string[]) {
  const allowed = new Set(allowedDecisionIds);
  const decisions = input.decisions.filter((decision) => allowed.has(decision.id)).map((decision) => ({ id: decision.id, subject: decision.subject, title: decision.title, summary: decision.summary, reasons: [...decision.supportingAssessmentIds, ...decision.blockingAssessmentIds] }));
  return {
    version: AI_PLAN_ENRICHMENT_VERSION, allowedDecisionIds,
    deterministicScaffold: input.scaffold.phases.filter((phase) => phase.sourceDecisionIds.some((id) => allowed.has(id))).map((phase) => ({ sourceDecisionIds: phase.sourceDecisionIds, title: phase.title, objective: phase.objective })),
    decisions,
    authoritativeContext: {
      programme: { courseName: input.context.programme.courseName, universityName: input.context.programme.universityName, degreeLevel: input.context.programme.degreeLevel },
      deadlines: input.context.deadlines.map((deadline) => ({ date: deadline.date, kind: deadline.kind, authority: deadline.authority })),
      userSelections: input.context.plannerInputs?.filter((selection) => selection.semanticKey === 'planner.attention_focus').map((selection) => ({ semanticKey: selection.semanticKey, value: selection.value })) ?? [],
      constraints: input.context.userConstraints.map((constraint) => ({ kind: constraint.kind, value: constraint.value })),
      assessments: input.assessments.filter((assessment) => decisions.some((decision) => decision.reasons.includes(assessment.id))).map((assessment) => ({ id: assessment.id, subject: assessment.subject, summary: assessment.summary, status: assessment.status, provenance: assessment.source.provenance })),
    },
  };
}

function systemPrompt(): string {
  return `You enrich only PLAN. ASSESS contains facts/gaps; DECIDE sets allowed direction; PLAN creates work; EXECUTE is student-owned. Return JSON only with version ${AI_PLAN_ENRICHMENT_VERSION}. Expand only allowedDecisionIds. Never infer missing facts, requirements, scores, university facts, or deadlines. Never choose for a user. Never emit status, completion, deadline, content_value, evidence, IDs, or semanticKey. Use specific small tasks. clientKey values are stable lowercase kebab-case semantic identifiers.`;
}
