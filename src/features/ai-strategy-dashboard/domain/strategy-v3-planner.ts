import type { RecommendationSeed } from './recommendation';
import { strategyToolHref } from './strategy-tool';
import type { StrategyReportV3 } from '@/lib/ai/strategy-v3/domain';

/** One stable Planner seed per V3 roadmap deliverable. */
export function recommendationsFromStrategyReportV3(
  applicationId: string,
  report: Pick<StrategyReportV3, 'strategicRoadmap'>,
): RecommendationSeed[] {
  const seenDeliverables = new Set<string>();
  return report.strategicRoadmap.flatMap((phase) =>
    phase.deliverables.flatMap((deliverable) => {
      if (seenDeliverables.has(deliverable.key)) return [];
      seenDeliverables.add(deliverable.key);
      const target = deliverable.tool ? strategyToolHref(deliverable.tool, applicationId) : null;
      return {
        applicationId,
        category: 'strategy-roadmap',
        pillar: null,
        sourceKey: `strategy-roadmap::${phase.phaseKey}::${deliverable.key}`,
        title: deliverable.label,
        reason: `${phase.name}: ${phase.goal}`,
        priority: phase.phaseKey === 'finalise_optimise' ? 'high' : 'medium',
        estimatedImpact: null,
        estimatedEffort: null,
        deadline: null,
        evidenceRequired: deliverable.kind === 'evidence',
        relatedRequirement: null,
        actionLabel: target ? 'Open tool' : null,
        actionType: target ? 'internal_route' : 'none',
        actionTarget: target,
        contentSchema: phase.successCriteria.length
          ? { type: 'checklist' as const, items: phase.successCriteria }
          : null,
        submitChecklist: phase.successCriteria,
        tips: [],
        suggestedQuestions: [],
        sourceAnalysisId: null,
      } satisfies RecommendationSeed;
    }),
  );
}
