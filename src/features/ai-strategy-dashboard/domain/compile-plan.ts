/** Core 3 Plan: pure deterministic structure over Core 2 decisions. */

import type { DecisionResult } from './decision';
import type { PlanNodeReadiness, PlanPhase, PlanReadiness, PlanResult, PlanStep } from './plan';

type PlanGroup = 'resolve_blockers' | 'resolve_information' | 'confirm_choices' | 'available_direction';

const GROUP_ORDER: Record<PlanGroup, number> = {
  resolve_blockers: 0,
  resolve_information: 1,
  confirm_choices: 2,
  available_direction: 3,
};

/**
 * Convert only decision states that have a safe structural plan meaning into a
 * Phase -> Step -> Micro-step scaffold. No source fetching, AI, or writes.
 */
export function compilePlan(decisions: readonly DecisionResult[]): PlanResult {
  const grouped = new Map<PlanGroup, DecisionResult[]>();
  for (const decision of uniqueSortedDecisions(decisions)) {
    const group = groupFor(decision);
    if (!group) continue;
    const current = grouped.get(group) ?? [];
    current.push(decision);
    grouped.set(group, current);
  }

  const phases = [...grouped.entries()]
    .sort(([left], [right]) => GROUP_ORDER[left] - GROUP_ORDER[right])
    .map(([group, groupDecisions], index) => phase(group, groupDecisions, index + 1));

  return {
    id: `plan:deterministic:${fnv1a(phases.flatMap((item) => item.sourceDecisionIds).join('|'))}`,
    readiness: planReadiness(phases),
    phases,
  };
}

function groupFor(decision: DecisionResult): PlanGroup | null {
  if (decision.status === 'blocked') return 'resolve_blockers';
  if (decision.status === 'needs_information') return 'resolve_information';
  if (decision.status === 'needs_user_choice') return 'confirm_choices';
  // Eligibility and recorded constraints are gates/context, not directions to
  // blindly turn into a plan. The existing Core 2 attention decision is the
  // only deterministic available direction supported by current semantics.
  if (decision.id === 'decision:attention-focus' && decision.status === 'available') {
    return 'available_direction';
  }
  return null;
}

function phase(group: PlanGroup, decisions: readonly DecisionResult[], order: number): PlanPhase {
  const sortedDecisions = [...decisions].sort((left, right) => compareText(left.id, right.id));
  const metadata = nodeMetadata(sortedDecisions);
  const details = phaseDetails(group);
  return {
    id: `phase:${group}`,
    title: details.title,
    objective: details.objective,
    order,
    ...metadata,
    steps: sortedDecisions.map((decision, index) => step(group, decision, index + 1)),
  };
}

function step(group: PlanGroup, decision: DecisionResult, order: number): PlanStep {
  const metadata = nodeMetadata([decision]);
  const detail = stepDetails(group, decision);
  const readiness: PlanNodeReadiness = group === 'confirm_choices'
    ? 'requires_user_input'
    : 'requires_enrichment';
  return {
    id: `step:${group}:${stableKey(decision.id)}`,
    title: detail.title,
    objective: detail.objective,
    order,
    ...metadata,
    microSteps: [{
      id: `micro-step:${group}:${stableKey(decision.id)}:resolution-detail`,
      title: detail.microStepTitle,
      order: 1,
      readiness,
      contentSchema: inputSchema(group, decision) ?? null,
      ...metadata,
    }],
  };
}

/**
 * Input contracts are deterministic and carry semantic keys.  Only these
 * values may later influence Core 1/2; task title text is never parsed.
 */
function inputSchema(group: PlanGroup, decision: DecisionResult): PlanStep['microSteps'][number]['contentSchema'] {
  if (group !== 'confirm_choices' || decision.id !== 'decision:attention-focus') return null;
  return {
    type: 'single_select',
    prompt: 'Choose one application area to focus on next.',
    semanticKey: 'planner.attention_focus',
    options: decision.options.map((option) => ({ value: option.id, label: option.label })),
  };
}

function phaseDetails(group: PlanGroup): { title: string; objective: string } {
  switch (group) {
    case 'resolve_blockers':
      return { title: 'Resolve blocking requirements', objective: 'Establish a feasible application path before downstream planning.' };
    case 'resolve_information':
      return { title: 'Resolve required information', objective: 'Obtain the information needed to plan safely.' };
    case 'confirm_choices':
      return { title: 'Confirm user choices', objective: 'Preserve unresolved choices without selecting a direction automatically.' };
    case 'available_direction':
      return { title: 'Structure available direction', objective: 'Hold a non-blocking direction for later detailed planning.' };
  }
}

function stepDetails(group: PlanGroup, decision: DecisionResult): { title: string; objective: string; microStepTitle: string } {
  switch (group) {
    case 'resolve_blockers':
      return {
        title: `Resolve: ${decision.subject}`,
        objective: decision.summary,
        microStepTitle: 'Define a valid resolution for the confirmed blocker.',
      };
    case 'resolve_information':
      return {
        title: `Clarify: ${decision.subject}`,
        objective: decision.summary,
        microStepTitle: 'Define the information required before detailed planning.',
      };
    case 'confirm_choices':
      return {
        title: `Choose: ${decision.subject}`,
        objective: decision.summary,
        microStepTitle: 'Record the user choice; no option is selected automatically.',
      };
    case 'available_direction':
      return {
        title: `Explore: ${decision.subject}`,
        objective: decision.summary,
        microStepTitle: 'Define detailed next actions through later planning enrichment.',
      };
  }
}

function nodeMetadata(decisions: readonly DecisionResult[]): Pick<PlanPhase, 'sourceDecisionIds' | 'sourceProvenances'> {
  const sourceDecisionIds = decisions.map((decision) => decision.id).sort(compareText);
  const sourceProvenances = [...new Set(
    decisions.flatMap((decision) => decision.options.flatMap((option) => option.reasons.map((reason) => reason.provenance))),
  )].sort(compareText);
  return { sourceDecisionIds, sourceProvenances };
}

function planReadiness(phases: readonly PlanPhase[]): PlanReadiness {
  if (phases.length === 0) return 'empty';
  return phases.some((phase) => phase.id === 'phase:confirm_choices' || phase.id === 'phase:resolve_information')
    ? 'requires_user_input'
    : 'requires_enrichment';
}

function uniqueSortedDecisions(decisions: readonly DecisionResult[]): DecisionResult[] {
  const seen = new Set<string>();
  return [...decisions]
    .sort((left, right) => compareText(left.id, right.id))
    .filter((decision) => {
      if (seen.has(decision.id)) return false;
      seen.add(decision.id);
      return true;
    });
}

function stableKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'unknown';
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function fnv1a(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
