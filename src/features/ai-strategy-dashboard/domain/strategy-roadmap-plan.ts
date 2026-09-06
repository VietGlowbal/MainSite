import type { PlanResult, PlanPhase } from './plan';
import type {
  PlanningContext,
  PlanningInput,
  PlanningStrategyRoadmap,
} from './planning-context';
import {
  isPlannerAvailabilityInputKey,
  PLANNER_AVAILABILITY_INPUT_KEYS,
  type PlannerAvailabilityInputKey,
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
  const strategyPhases = !roadmap
    ? []
    : roadmap.kind === 'v3'
      ? v3Phases(roadmap, context, nextOrder(deterministicPlan.phases))
      : roadmap.kind === 'f8'
        ? f8Phases(roadmap, context, nextOrder(deterministicPlan.phases))
        : f7Phases(roadmap, context, nextOrder(deterministicPlan.phases));
  const withRoadmap = strategyPhases.length === 0
    ? deterministicPlan
    : {
      ...deterministicPlan,
      readiness: deterministicPlan.readiness === 'requires_user_input'
        ? 'requires_user_input' as const
        : 'requires_enrichment' as const,
      phases: [...deterministicPlan.phases, ...strategyPhases],
    };
  return mergeMissingAvailabilityInputs(withRoadmap, context.plannerInputs ?? []);
}

const PLANNER_INPUT_DETAILS: Record<PlannerAvailabilityInputKey, { id: string; title: string; prompt: string; order: number }> = {
  'planner.availability': {
    id: 'micro-step:planner-inputs:availability',
    title: 'Record when you are available',
    prompt: 'Describe the days and times you can work on this application.',
    order: 1,
  },
  'planner.time_capacity': {
    id: 'micro-step:planner-inputs:time-capacity',
    title: 'Record your weekly time capacity',
    prompt: 'Describe how much time you can realistically spend on this application each week.',
    order: 2,
  },
};

function mergeMissingAvailabilityInputs(plan: PlanResult, inputs: readonly PlanningInput[]): PlanResult {
  const missing = PLANNER_AVAILABILITY_INPUT_KEYS.filter((semanticKey) => !inputs.some((input) =>
    input.provenance === 'user_provided' && input.semanticKey === semanticKey && input.value.trim().length > 0,
  ));
  if (missing.length === 0) return plan;
  return {
    ...plan,
    readiness: 'requires_user_input',
    phases: [...plan.phases, {
      id: 'phase:planner-inputs',
      title: 'Record planning availability',
      objective: 'Use only the student’s explicitly recorded availability and time capacity for planning.',
      order: nextOrder(plan.phases),
      sourceDecisionIds: [],
      sourceProvenances: [],
      steps: [{
        id: 'step:planner-inputs:availability',
        title: 'Share available planning time',
        objective: 'Record only the time you can commit to this application.',
        order: 1,
        sourceDecisionIds: [],
        sourceProvenances: [],
        microSteps: missing.map((semanticKey) => {
          const detail = PLANNER_INPUT_DETAILS[semanticKey];
          return {
            id: detail.id,
            title: detail.title,
            guidance: detail.prompt,
            order: detail.order,
            readiness: 'requires_user_input' as const,
            contentSchema: { type: 'long_text' as const, prompt: detail.prompt, semanticKey },
            sourceDecisionIds: [],
            sourceProvenances: [],
          };
        }),
      }],
    }],
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
          guidance: `Complete this deliverable: ${deliverable.label} ${phase.objective}`,
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

function v3Phases(
  roadmap: Extract<PlanningStrategyRoadmap, { kind: 'v3' }>,
  context: StrategyRoadmapPlanContext,
  firstOrder: number,
): PlanPhase[] {
  const seen = new Set<string>();
  const seenDeliverables = new Set<string>();
  return roadmap.data.strategicRoadmap.flatMap((phase) => {
    if (seen.has(phase.phaseKey)) return [];
    seen.add(phase.phaseKey);
    const contextText = factualContext(context);
    return [{
      id: `phase:strategy-roadmap:${phase.phaseKey}`,
      title: phase.name,
      objective: [phase.goal, `Timeline: ${phase.estimatedTimeline}`].join(' '),
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
        microSteps: uniqueDeliverables(phase.deliverables, seenDeliverables).map((deliverable, index) => ({
          id: `micro-step:strategy-roadmap:${phase.phaseKey}:${deliverable.key}`,
          title: deliverable.label,
          guidance: `Complete this deliverable: ${deliverable.label} ${phase.goal}`,
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
        guidance: `Complete this strategy priority: ${priority} ${roadmap.data.roadmap.why}`,
        order: index + 1,
        readiness: 'requires_enrichment' as const,
        contentSchema: null,
        sourceDecisionIds: [],
        sourceProvenances: sourceProvenances(context),
      })),
    }],
  }];
}

function uniqueDeliverables<T extends { key: string }>(deliverables: readonly T[], seen = new Set<string>()): T[] {
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
  return inputs.filter((input) =>
    input.provenance === 'user_provided' && isPlannerAvailabilityInputKey(input.semanticKey) && input.value.trim().length > 0,
  );
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
