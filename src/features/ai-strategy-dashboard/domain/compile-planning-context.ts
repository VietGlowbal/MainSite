/**
 * Core 1 Gate 3: deterministic PlanningContext compiler.
 *
 * This module deliberately accepts already-validated sources. It does not
 * fetch, parse raw rows, call a model, or depend on any framework runtime.
 */

import type { EvidenceItem } from '@/shared/evaluation/f3-evidence';
import type { ApplicationRequirement } from '@/lib/apply-types';
import type {
  AiProposedPortfolioOpportunity,
  DeadlineCandidate,
  ExistingEvidenceByTier,
  HardConstraint,
  MissingInputSignal,
  PlanningContext,
  PlanningContextSources,
  PlanningDeadline,
  PlanningGap,
  PlanningStrategy,
  RequirementGap,
  UnresolvedRequirement,
} from './planning-context';

const FIT_DIMENSION_KEYS = [
  'academicCompetitiveness',
  'personaAlignment',
  'financialFeasibility',
  'careerDirection',
  'applicationReadiness',
] as const;

const DEADLINE_SOURCE_ORDER: Record<DeadlineCandidate['source'], number> = {
  course_application: 0,
  university: 1,
  user: 2,
  other: 3,
};

/** Compile a fully normalized context snapshot from the Gate 2 source contract. */
export function compilePlanningContext(sources: PlanningContextSources): PlanningContext {
  const programmeRequirements = sorted(sources.requirements, compareRequirements);
  const deadlines = compileDeadlines(sources.deadlineCandidates);
  const applicantState = sources.profileEvaluation?.data ?? null;

  const contextWithoutHash: PlanningContext = {
    applicantState,
    programme: sources.programme,
    programmeRequirements,
    requirementGaps: requirementGaps(programmeRequirements),
    unresolvedRequirements: unresolvedRequirements(programmeRequirements),
    hardConstraints: hardConstraints(programmeRequirements, deadlines),
    strategy: planningStrategy(sources),
    identifiedGaps: identifiedGaps(sources),
    interventionCandidates: interventionCandidates(sources),
    existingEvidence: existingEvidence(applicantState?.evidence.items ?? []),
    evidenceNeedsProof: sortedEvidence(applicantState?.evidence.needsProof ?? []),
    // Gate 2 currently has no grounded requirement-to-document mapping. An
    // unmet requirement is intentionally not relabelled as missing evidence.
    missingEvidence: [],
    missingInputSignals: missingInputSignals(applicantState?.evidence.items ?? [], applicantState?.narrativeIdentity.base.missingInputs ?? []),
    deadlines,
    userConstraints: sorted(sources.userConstraints, (a, b) => compareText(a.kind, b.kind) || compareText(a.value, b.value)),
    plannerInputs: sorted(sources.plannerInputs ?? [], (a, b) => compareText(a.semanticKey, b.semanticKey) || compareText(a.microStepId, b.microStepId)),
    currentPlanState: {
      stages: sorted(sources.stages, (a, b) => a.orderNum - b.orderNum || compareText(a.id, b.id)),
      tasks: sorted(sources.tasks, (a, b) => a.sortOrder - b.sortOrder || compareText(a.id, b.id)),
      legacyRecommendations: sorted(sources.recommendations, (a, b) => compareText(a.id, b.id)),
    },
    provenance: {
      personalReport: sources.profileEvaluation?.provenance ?? null,
      programmeFit: sources.programmeFit?.provenance ?? null,
      strategy: sources.strategyRecommendation?.provenance ?? null,
      staleness: { personalReport: 'unknown', programmeFit: 'unknown', strategy: 'unknown' },
      sourceDiagnostics: sorted(sources.diagnostics, (a, b) => compareText(a.source, b.source) || compareText(a.status, b.status) || compareText(a.message ?? '', b.message ?? '')),
      contextHash: '',
    },
  };

  return {
    ...contextWithoutHash,
    provenance: {
      ...contextWithoutHash.provenance,
      contextHash: `core1-fnv1a-32:${fnv1a(stableStringify(contextWithoutHash))}`,
    },
  };
}

function requirementGaps(requirements: readonly ApplicationRequirement[]): RequirementGap[] {
  return requirements.flatMap((requirement) => {
    if (requirement.studentStatus !== 'not_met' && requirement.studentStatus !== 'partially_met') return [];
    return [{
      requirementId: requirement.id,
      requirementType: requirement.requirementType,
      title: requirement.title ?? null,
      requirementText: requirement.requirementText,
      status: requirement.studentStatus,
      isMandatory: requirement.isMandatory,
      confidence: requirement.confidence,
      sourceUrl: requirement.sourceUrl ?? null,
    }];
  });
}

function unresolvedRequirements(requirements: readonly ApplicationRequirement[]): UnresolvedRequirement[] {
  return requirements.flatMap((requirement) => {
    if (requirement.studentStatus !== 'needs_review' && requirement.studentStatus !== 'unknown') return [];
    return [{
      requirementId: requirement.id,
      requirementType: requirement.requirementType,
      title: requirement.title ?? null,
      requirementText: requirement.requirementText,
      status: requirement.studentStatus,
      isMandatory: requirement.isMandatory,
      confidence: requirement.confidence,
      sourceUrl: requirement.sourceUrl ?? null,
    }];
  });
}

function compileDeadlines(candidates: readonly DeadlineCandidate[]): PlanningDeadline[] {
  const byKind = new Map<string, DeadlineCandidate[]>();
  for (const candidate of candidates) {
    const group = byKind.get(candidate.kind) ?? [];
    group.push(candidate);
    byKind.set(candidate.kind, group);
  }

  return [...byKind.entries()]
    .sort(([left], [right]) => compareText(left, right))
    .flatMap(([, group]) => {
      const ordered = sorted(group, compareDeadlineCandidate);
      const highestPriority = DEADLINE_SOURCE_ORDER[ordered[0]?.source ?? 'other'];
      return ordered.map((candidate) => ({
        ...candidate,
        // Retain same-source conflicts as primary rather than silently choosing
        // whichever database row happened to arrive first.
        precedence: DEADLINE_SOURCE_ORDER[candidate.source] === highestPriority ? 'primary' : 'fallback',
      }));
    });
}

function hardConstraints(requirements: readonly ApplicationRequirement[], deadlines: readonly PlanningDeadline[]): HardConstraint[] {
  const constraints: HardConstraint[] = [
    ...requirements
      .filter((requirement) => requirement.isMandatory)
      .map((requirement) => ({
        kind: 'mandatory_requirement' as const,
        description: requirement.title ?? requirement.requirementText,
        confidence: requirement.confidence,
        sourceUrl: requirement.sourceUrl ?? null,
      })),
    ...deadlines
      .filter((deadline) => deadline.kind === 'application' && deadline.precedence === 'primary')
      .map((deadline) => ({
        kind: 'application_deadline' as const,
        description: `Application deadline: ${deadline.date}`,
        confidence: deadline.confidence ?? 0,
        sourceUrl: deadline.sourceReference,
      })),
  ];
  return uniqueSorted(constraints, (item) => `${item.kind}|${item.description}|${item.sourceUrl ?? ''}`, (a, b) =>
    compareText(a.kind, b.kind) || compareText(a.description, b.description) || compareText(a.sourceUrl ?? '', b.sourceUrl ?? ''),
  );
}

function identifiedGaps(sources: PlanningContextSources): PlanningGap[] {
  const gaps: PlanningGap[] = [];
  const fit = sources.programmeFit;
  if (fit) {
    for (const dimensionKey of FIT_DIMENSION_KEYS) {
      const dimension = fit.data.dimensions[dimensionKey];
      for (const description of [...dimension.gaps].sort(compareText)) {
        gaps.push({ id: `f5_dimension:${dimensionKey}:${description}`, source: 'f5_dimension', description, dimensionKey, sourceAnalysisId: fit.provenance.id });
      }
    }
    for (const description of [...fit.data.limitations].sort(compareText)) {
      gaps.push({ id: `f5_limitation:${description}`, source: 'f5_limitation', description, dimensionKey: null, sourceAnalysisId: fit.provenance.id });
    }
  }

  const profile = sources.profileEvaluation;
  if (profile) {
    for (const description of [...profile.data.narrativeIdentity.base.limitations].sort(compareText)) {
      gaps.push({ id: `f4_limitation:${description}`, source: 'f4_limitation', description, dimensionKey: null, sourceAnalysisId: profile.provenance.id });
    }
  }
  return uniqueSorted(gaps, (item) => `${item.source}|${item.dimensionKey ?? ''}|${item.description}`, (a, b) => compareText(a.id, b.id));
}

function interventionCandidates(sources: PlanningContextSources): PlanningContext['interventionCandidates'] {
  const candidates: PlanningContext['interventionCandidates'] = [];
  if (sources.programmeFit) {
    for (const action of sorted(sources.programmeFit.improvementActions, (a, b) => compareText(a.id, b.id))) {
      candidates.push({ source: 'f5_improvement', sourceAnalysisId: sources.programmeFit.provenance.id, action });
    }
  }
  if (sources.strategyRecommendation) {
    for (const label of sources.strategyRecommendation.data.roadmap.prioritize) {
      candidates.push({ source: 'f7_priority', sourceAnalysisId: sources.strategyRecommendation.provenance.id, label, rationale: sources.strategyRecommendation.data.roadmap.why });
    }
  }
  return candidates;
}

function planningStrategy(sources: PlanningContextSources): PlanningStrategy | null {
  const strategy = sources.strategyRecommendation?.data;
  if (!strategy) return null;
  const aiProposedOpportunities: AiProposedPortfolioOpportunity[] = strategy.portfolioEvaluations
    .filter((opportunity) => opportunity.source === 'ai_proposed')
    .map((opportunity) => ({ ...opportunity, source: 'ai_proposed' }));
  return {
    direction: strategy.chosenDirection,
    rationale: strategy.chosenDirectionWhy,
    targetPositioning: strategy.positioningAfter,
    priorities: [...strategy.roadmap.prioritize],
    avoid: [...strategy.roadmap.avoid],
    expectedPositioning: strategy.roadmap.expectedPositioning,
    differentiation: { insight: strategy.differentiationInsight, proposal: strategy.differentiationProposal },
    aiProposedOpportunities,
  };
}

function existingEvidence(items: readonly EvidenceItem[]): ExistingEvidenceByTier {
  return {
    verified: sortedEvidence(items.filter((item) => item.tier === 'verified')),
    attributable: sortedEvidence(items.filter((item) => item.tier === 'attributable')),
    stated: sortedEvidence(items.filter((item) => item.tier === 'stated')),
  };
}

function missingInputSignals(items: readonly EvidenceItem[], narrativeMissingInputs: readonly string[]): MissingInputSignal[] {
  const signals: MissingInputSignal[] = [
    ...items.flatMap((item) => item.missingInputs.map((missingInput) => ({ description: `${item.title}: ${missingInput}`, frameworkContext: `f3_item:${item.itemId}` }))),
    ...narrativeMissingInputs.map((description) => ({ description, frameworkContext: 'f4_base' })),
  ];
  return uniqueSorted(signals, (item) => `${item.frameworkContext}|${item.description}`, (a, b) => compareText(a.frameworkContext, b.frameworkContext) || compareText(a.description, b.description));
}

function compareRequirements(a: ApplicationRequirement, b: ApplicationRequirement): number {
  return compareText(a.id, b.id);
}

function compareDeadlineCandidate(a: DeadlineCandidate, b: DeadlineCandidate): number {
  return DEADLINE_SOURCE_ORDER[a.source] - DEADLINE_SOURCE_ORDER[b.source]
    || compareText(a.date, b.date)
    || compareText(a.authority, b.authority)
    || compareText(a.sourceReference ?? '', b.sourceReference ?? '');
}

function sortedEvidence(items: readonly EvidenceItem[]): EvidenceItem[] {
  return sorted(items, (a, b) => compareText(a.itemId, b.itemId));
}

function uniqueSorted<T>(items: readonly T[], key: (item: T) => string, compare: (a: T, b: T) => number): T[] {
  const seen = new Set<string>();
  return sorted(items, compare).filter((item) => {
    const itemKey = key(item);
    if (seen.has(itemKey)) return false;
    seen.add(itemKey);
    return true;
  });
}

function sorted<T>(items: readonly T[], compare: (a: T, b: T) => number): T[] {
  return [...items].sort(compare);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort(compareText).filter((key) => record[key] !== undefined).map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
}

function fnv1a(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
