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
  stuckMicroSteps: number;
};

/** Hashes only normalized planning inputs; execution state and timestamps are excluded. */
export function plannerSourceFingerprint(context: PlanningContext): string {
  const material = {
    programme: pick(context.programme, ['applicationId', 'courseId', 'universityId', 'universityName', 'courseName', 'degreeLevel', 'subject', 'country', 'studyMode', 'intake', 'applicationMethod', 'applicationCode', 'applicationStatus']),
    requirements: context.programmeRequirements.map((item) => pick(item, ['id', 'requirementType', 'title', 'requirementText', 'isMandatory', 'studentStatus', 'confidence', 'sourceUrl'])),
    gaps: context.identifiedGaps.map((item) => pick(item, ['id', 'subject', 'kind', 'status', 'decisionBasis', 'source'])),
    interventions: context.interventionCandidates.map((item) => pick(item, ['id', 'subject', 'kind', 'status', 'source'])),
    deadlines: context.deadlines.map((item) => pick(item, ['date', 'kind', 'source', 'authority', 'confidence', 'precedence'])),
    constraints: context.userConstraints.map((item) => pick(item, ['kind', 'value'])),
    plannerInputs: (context.plannerInputs ?? []).map((item) => pick(item, ['semanticKey', 'value', 'microStepId'])),
    // F5/F7 normalized output is represented in these planning candidates; the
    // raw model payload, timestamps, and execution rows are intentionally absent.
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

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return [...value].map(stableValue).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stableValue(item)]));
  return value;
}

function fnv1a(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 0x01000193); }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
