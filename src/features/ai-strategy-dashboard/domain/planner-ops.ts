import type { PlanningContext } from './planning-context';
import type { PlannerReadModel } from './planner-read-model';

export type PlannerOpsLifecycle = 'initializing' | 'ready' | 'waiting_for_input' | 'stale' | 'refreshing' | 'complete' | 'failed';
export type PlannerGenerationStatus = 'idle' | 'running' | 'success' | 'failed';
export type PlannerAiStatus = 'success' | 'fallback' | 'failed' | 'not_required' | null;
export type PlannerFailureCode = 'source_unavailable' | 'not_enough_data' | 'ai_enrichment_failed' | 'validation_failed' | 'persistence_failed' | 'migration_unavailable' | 'concurrency_conflict' | 'unknown';

export type PlannerHealth = {
  lifecycle: PlannerOpsLifecycle;
  entitlement: 'canonical' | 'legacy' | 'not_entitled';
  source: { currentFingerprint: string | null; planFingerprint: string | null; stale: boolean; staleSince: string | null };
  generation: { lastAttemptAt: string | null; lastSuccessAt: string | null; status: PlannerGenerationStatus; failureCode: PlannerFailureCode | null };
  ai: { lastStatus: PlannerAiStatus; provider: string | null; model: string | null; promptVersion: string | null; enrichmentVersion: string | null };
  progress: { phases: number; steps: number; microSteps: number; completedMicroSteps: number; percentage: number };
  feedback: { averageRating: number | null; totalRatings: number };
  stuckMicroSteps: number | null;
};

/**
 * Hashes an explicit planning-input schema. Unordered collections are sorted
 * at their call sites; semantic order (strategy priorities and ranked F5/F7
 * candidates) is preserved. Execution/UI/feedback/timestamp fields never
 * enter this object.
 */
export function plannerSourceFingerprint(context: PlanningContext): string {
  const material = {
    programme: pick(context.programme, ['applicationId', 'courseId', 'universityId', 'universityName', 'courseName', 'courseUrl', 'degreeLevel', 'subject', 'country', 'studyMode', 'intake', 'applicationMethod', 'applicationCode', 'applicationStatus']),
    applicantState: stableValue(context.applicantState),
    requirements: unordered(context.programmeRequirements.map((item) => pick(item, ['id', 'requirementType', 'title', 'requirementText', 'isMandatory', 'studentStatus', 'confidence', 'sourceUrl'])), 'id'),
    unresolvedRequirements: unordered(context.unresolvedRequirements ?? [], 'requirementId'),
    requirementGaps: unordered(context.requirementGaps ?? [], 'requirementId'),
    hardConstraints: unordered(context.hardConstraints ?? [], 'kind', 'description', 'confidence', 'sourceUrl'),
    gaps: unordered(context.identifiedGaps ?? [], 'id'),
    // F5 improvement actions and F7 roadmap priorities are ranked/ordered;
    // preserve their order while including their complete planning payload.
    interventions: context.interventionCandidates.map((item) => item.source === 'f5_improvement'
      ? { source: item.source, sourceAnalysisId: item.sourceAnalysisId, action: stableValue(item.action) }
      : { source: item.source, sourceAnalysisId: item.sourceAnalysisId, label: item.label, rationale: item.rationale }),
    deadlines: unordered(context.deadlines ?? [], 'date', 'kind', 'source', 'sourceReference'),
    constraints: unordered(context.userConstraints ?? [], 'kind', 'value'),
    plannerInputs: unordered((context.plannerInputs ?? []).map((item) => pick(item, ['semanticKey', 'value', 'microStepId', 'provenance'])), 'semanticKey', 'microStepId'),
    existingEvidence: {
      verified: unordered(context.existingEvidence?.verified ?? [], 'id'),
      attributable: unordered(context.existingEvidence?.attributable ?? [], 'id'),
      stated: unordered(context.existingEvidence?.stated ?? [], 'id'),
    },
    evidenceNeedsProof: unordered(context.evidenceNeedsProof ?? [], 'id'),
    missingEvidence: unordered(context.missingEvidence ?? [], 'source', 'reason', 'description'),
    missingInputSignals: unordered(context.missingInputSignals ?? [], 'frameworkContext', 'description'),
    sourceDiagnostics: unordered(context.provenance?.sourceDiagnostics ?? [], 'source', 'status', 'message'),
    sourceProvenance: {
      personalReport: sourceProvenance(context.provenance?.personalReport),
      programmeFit: sourceProvenance(context.provenance?.programmeFit),
      strategy: sourceProvenance(context.provenance?.strategy),
    },
    sourceStaleness: stableValue(context.provenance?.staleness ?? null),
    // V3 deliverables are the executable Strategy source. Keep the roadmap
    // content in the fingerprint so a changed deliverable triggers reconcile.
    strategyRoadmap: stableValue(context.strategyRoadmap),
    // Strategy priorities/avoid lists are semantically ordered and therefore
    // intentionally passed through unchanged.
    strategy: context.strategy ? stableValue(context.strategy) : null,
  };
  return `planner-fnv1a-32:${fnv1a(JSON.stringify(stableValue(material)))}`;
}

export function planFingerprint(domainPlanId: string | null | undefined): string | null {
  const match = typeof domainPlanId === 'string' ? domainPlanId.match(/:source:(planner-fnv1a-32:[0-9a-f]{8})/) : null;
  return match?.[1] ?? null;
}

export function isPlannerStale(currentSourceFingerprint: string | null, persistedPlanFingerprint: string | null): boolean {
  return Boolean(currentSourceFingerprint && persistedPlanFingerprint && currentSourceFingerprint !== persistedPlanFingerprint)
    || Boolean(currentSourceFingerprint && !persistedPlanFingerprint);
}

export function plannerLifecycle(input: { readModel: PlannerReadModel | null; stale: boolean; refreshing?: boolean; failed?: boolean }): PlannerOpsLifecycle {
  if (input.refreshing) return 'refreshing';
  if (input.failed) return 'failed';
  if (input.stale) return 'stale';
  if (!input.readModel?.plan) return 'initializing';
  if (input.readModel.lifecycle === 'waiting_for_input') return 'waiting_for_input';
  if (input.readModel.lifecycle === 'complete') return 'complete';
  return 'ready';
}

function pick(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object') return {};
  const record = value as Record<string, unknown>;
  return Object.fromEntries(keys.map((key) => [key, record[key]]));
}

function unordered<T>(items: readonly T[], ...keys: string[]): T[] {
  return [...items].sort((left, right) => {
    const a = keys.map((key) => JSON.stringify((left as Record<string, unknown>)[key])).join('|');
    const b = keys.map((key) => JSON.stringify((right as Record<string, unknown>)[key])).join('|');
    return a.localeCompare(b);
  });
}

function sourceProvenance(value: unknown): unknown {
  if (!value || typeof value !== 'object') return null;
  return pick(value, ['id', 'inputHash', 'promptVersion', 'engineVersion', 'modelName', 'sourceAnalysisId', 'sourceMatchAnalysisId']);
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([key]) => !['createdAt', 'updatedAt', 'generatedAt', 'timestamp'].includes(key))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => [key, stableValue(item)]));
  return value;
}

function fnv1a(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 0x01000193); }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
