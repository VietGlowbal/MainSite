import type { RecommendationSeed } from './recommendation';
import { strategyToolHref, type StrategyToolKey } from './strategy-tool';
import type { StrategyReportV3 } from '@/lib/ai/strategy-v3/domain';

/** One stable Planner seed per V3 roadmap deliverable. */
export function recommendationsFromStrategyReportV3(
  applicationId: string,
  report: Pick<StrategyReportV3, 'strategicRoadmap'>,
): RecommendationSeed[] {
  return report.strategicRoadmap.flatMap((phase) =>
    phase.deliverables.map((deliverable) => {
      const tool = deliverable.tool === 'cv_builder' ? 'cv' : deliverable.tool === 'statement_writer' ? 'statement' : null;
      const target = tool ? strategyToolHref(tool as StrategyToolKey, applicationId) : null;
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
        contentSchema: null,
        submitChecklist: phase.successCriteria.slice(0, 4),
        tips: [],
        suggestedQuestions: [],
        sourceAnalysisId: null,
      } satisfies RecommendationSeed;
    }),
  );
}
