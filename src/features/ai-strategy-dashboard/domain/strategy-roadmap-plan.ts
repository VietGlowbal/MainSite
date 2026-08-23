import type { PlanResult, PlanPhase } from './plan';
import type {
  PlanningContext,
  PlanningInput,
  PlanningStrategyRoadmap,
} from './planning-context';

type StrategyRoadmapPlanContext = Pick<PlanningContext,
  'strategyRoadmap' | 'deadlines' | 'programmeRequirements' | 'userConstraints' | 'plannerInputs'
>;

/**
 * Adds a validated Strategy Report roadmap to the canonical Core 3 scaffold.
 * Execution fields remain absent: reconciliation keeps student-owned status,
 * deadline, submitted content, and evidence on stable deliverable node IDs.
 */
export function mergeStrategyRoadmapPlan(
  deterministicPlan: PlanResult,
  context: StrategyRoadmapPlanContext,
): PlanResult {
  const roadmap = context.strategyRoadmap;
  if (!roadmap) return deterministicPlan;

  const strategyPhases = roadmap.kind === 'f8'
    ? f8Phases(roadmap, context, nextOrder(deterministicPlan.phases))
    : f7Phases(roadmap, context, nextOrder(deterministicPlan.phases));
  if (strategyPhases.length === 0) return deterministicPlan;

  return {
    ...deterministicPlan,
    readiness: deterministicPlan.readiness === 'requires_user_input'
      ? 'requires_user_input'
      : 'requires_enrichment',
    phases: [...deterministicPlan.phases, ...strategyPhases],
  };
}

function f8Phases(
  roadmap: Extract<PlanningStrategyRoadmap, { kind: 'f8' }>,
  context: StrategyRoadmapPlanContext,
  firstOrder: number,
): PlanPhase[] {
  const seen = new Set<string>();
  return roadmap.data.executionRoadmap.phases.flatMap((phase) => {
    if (seen.has(phase.phaseKey)) return [];
    seen.add(phase.phaseKey);
    const phaseId = `phase:strategy-roadmap:${phase.phaseKey}`;
    const contextText = factualContext(context);
    const objective = [phase.objective, `Timeline: ${phase.timeline}`].join(' ');
    return [{
      id: phaseId,
      title: phase.name,
      objective,
      order: firstOrder + seen.size - 1,
      sourceDecisionIds: [],
      sourceProvenances: sourceProvenances(context),
      steps: [{
        id: `step:strategy-roadmap:${phase.phaseKey}:deliverables`,
        title: 'Complete roadmap deliverables',
        objective: [phase.keyActions.join(' '), contextText].filter(Boolean).join(' '),
        order: 1,
        sourceDecisionIds: [],
        sourceProvenances: sourceProvenances(context),
        microSteps: uniqueDeliverables(phase.deliverables).map((deliverable, index) => ({
          id: `micro-step:strategy-roadmap:${phase.phaseKey}:${deliverable.key}`,
          title: deliverable.label,
          order: index + 1,
          readiness: 'requires_enrichment' as const,
          contentSchema: phase.successCriteria.length
            ? { type: 'checklist' as const, items: phase.successCriteria }
            : null,
          sourceDecisionIds: [],
          sourceProvenances: sourceProvenances(context),
        })),
      }],
    }];
  });
}

function f7Phases(
  roadmap: Extract<PlanningStrategyRoadmap, { kind: 'f7' }>,
  context: StrategyRoadmapPlanContext,
  order: number,
): PlanPhase[] {
  const priorities = [...new Set(roadmap.data.roadmap.prioritize)];
  if (priorities.length === 0) return [];
  return [{
    id: 'phase:strategy-roadmap:legacy',
    title: 'Legacy strategy roadmap',
    objective: roadmap.data.roadmap.why,
    order,
    sourceDecisionIds: [],
    sourceProvenances: sourceProvenances(context),
    steps: [{
      id: 'step:strategy-roadmap:legacy:priorities',
      title: 'Complete strategy priorities',
      objective: factualContext(context),
      order: 1,
      sourceDecisionIds: [],
      sourceProvenances: sourceProvenances(context),
      microSteps: priorities.map((priority, index) => ({
        id: `micro-step:strategy-roadmap:legacy:${fnv1a(priority)}`,
        title: priority,
        order: index + 1,
        readiness: 'requires_enrichment' as const,
        contentSchema: null,
        sourceDecisionIds: [],
        sourceProvenances: sourceProvenances(context),
      })),
    }],
  }];
}

function uniqueDeliverables<T extends { key: string }>(deliverables: readonly T[]): T[] {
  const seen = new Set<string>();
  return deliverables.filter((deliverable) => {
    if (seen.has(deliverable.key)) return false;
    seen.add(deliverable.key);
    return true;
  });
}

function factualContext(context: StrategyRoadmapPlanContext): string {
  const deadlines = context.deadlines.map((deadline) => `${deadline.kind === 'application' ? 'Application' : deadline.kind} deadline: ${deadline.date}`);
  const requirements = context.programmeRequirements.map((requirement) => `Requirement: ${requirement.id}${requirement.title ? ` (${requirement.title})` : ''}`);
  const constraints = context.userConstraints.map((constraint) => `Recorded preference ${constraint.kind}: ${constraint.value}`);
  const availability = explicitAvailability(context.plannerInputs ?? []).map((input) => `Recorded availability ${input.semanticKey}: ${input.value}`);
  return [...deadlines, ...requirements, ...constraints, ...availability].join(' ');
}

function explicitAvailability(inputs: readonly PlanningInput[]): PlanningInput[] {
  return inputs.filter((input) => input.semanticKey === 'planner.availability' || input.semanticKey === 'planner.time_capacity');
}

function sourceProvenances(context: StrategyRoadmapPlanContext): PlanPhase['sourceProvenances'] {
  const values: PlanPhase['sourceProvenances'] = ['ai_generated'];
  if (context.deadlines.length || context.programmeRequirements.length) values.push('database_factual');
  if (context.userConstraints.length || explicitAvailability(context.plannerInputs ?? []).length) values.push('user_provided');
  return values;
}

function nextOrder(phases: readonly PlanPhase[]): number {
  return Math.max(0, ...phases.map((phase) => phase.order)) + 1;
}

function fnv1a(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
