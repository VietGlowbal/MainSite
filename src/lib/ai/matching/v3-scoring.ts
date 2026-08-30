import type { TargetProfile } from '../target-profile/domain';
import type {
  MatchingReportV3,
  MatchingV3MetricResult,
  MatchingV3MetricStatus,
} from './domain';

export type V3MetricDefinition = {
  id: string;
  label: string;
  weight: number;
  submetrics: Array<{ id: string; label: string; weight: number }>;
};

export const UNIVERSITY_FIT_METRICS: readonly V3MetricDefinition[] = [
  {
    id: 'academicReadiness', label: 'Academic Readiness', weight: 25,
    submetrics: [
      { id: 'academicPerformance', label: 'Academic Performance', weight: 40 },
      { id: 'requirementCoverage', label: 'Requirement Coverage', weight: 25 },
      { id: 'programmePreparation', label: 'Programme Preparation', weight: 20 },
      { id: 'academicChallenge', label: 'Academic Challenge', weight: 15 },
    ],
  },
  {
    id: 'valuesAlignment', label: 'Values Alignment', weight: 25,
    submetrics: [
      { id: 'valueMatch', label: 'Value Match', weight: 35 },
      { id: 'behaviouralEvidence', label: 'Behavioural Evidence', weight: 30 },
      { id: 'motivationMatch', label: 'Motivation Match', weight: 20 },
      { id: 'consistency', label: 'Consistency', weight: 15 },
    ],
  },
  {
    id: 'communityContribution', label: 'Community & Contribution', weight: 20,
    submetrics: [
      { id: 'contributionEvidence', label: 'Contribution Evidence', weight: 35 },
      { id: 'leadershipInitiative', label: 'Leadership & Initiative', weight: 25 },
      { id: 'collaboration', label: 'Collaboration', weight: 20 },
      { id: 'communityImpact', label: 'Community Impact', weight: 20 },
    ],
  },
  {
    id: 'learningEnvironment', label: 'Learning Environment', weight: 15,
    submetrics: [
      { id: 'learningStyleMatch', label: 'Learning Style Match', weight: 35 },
      { id: 'academicExperienceMatch', label: 'Academic Experience Match', weight: 25 },
      { id: 'collaborationCommunityMatch', label: 'Collaboration & Community Match', weight: 20 },
      { id: 'developmentOpportunityMatch', label: 'Development Opportunity Match', weight: 20 },
    ],
  },
  {
    id: 'distinctiveOpportunity', label: 'Distinctive Opportunity', weight: 15,
    submetrics: [
      { id: 'opportunityRelevance', label: 'Opportunity Relevance', weight: 35 },
      { id: 'capabilityOpportunityMatch', label: 'Capability–Opportunity Match', weight: 25 },
      { id: 'futureGoalRelevance', label: 'Future Goal Relevance', weight: 25 },
      { id: 'specificityUniqueness', label: 'Specificity / Uniqueness', weight: 15 },
    ],
  },
] as const;

export const PROGRAMME_FIT_METRICS: readonly V3MetricDefinition[] = [
  {
    id: 'interestMotivation', label: 'Interest & Motivation', weight: 30,
    submetrics: [
      { id: 'interestEvidence', label: 'Interest Evidence', weight: 30 },
      { id: 'personalMotivation', label: 'Personal Motivation', weight: 30 },
      { id: 'problemFieldConnection', label: 'Problem–Field Connection', weight: 25 },
      { id: 'consistencyAcrossEvidence', label: 'Consistency Across Evidence', weight: 15 },
    ],
  },
  {
    id: 'capability', label: 'Capability', weight: 25,
    submetrics: [
      { id: 'coreCapabilityMatch', label: 'Core Capability Match', weight: 40 },
      { id: 'evidenceStrength', label: 'Evidence Strength', weight: 30 },
      { id: 'capabilityDepth', label: 'Capability Depth', weight: 20 },
      { id: 'transferability', label: 'Transferability', weight: 10 },
    ],
  },
  {
    id: 'experienceExposure', label: 'Experience & Exposure', weight: 20,
    submetrics: [
      { id: 'fieldRelevance', label: 'Field Relevance', weight: 40 },
      { id: 'depthOfEngagement', label: 'Depth of Engagement', weight: 25 },
      { id: 'applicationPractice', label: 'Application / Practice', weight: 20 },
      { id: 'breadthOfExploration', label: 'Breadth of Exploration', weight: 15 },
    ],
  },
  {
    id: 'careerFutureDirection', label: 'Career & Future Direction', weight: 25,
    submetrics: [
      { id: 'goalProgrammeRelevance', label: 'Goal–Programme Relevance', weight: 40 },
      { id: 'skillGoalConnection', label: 'Skill–Goal Connection', weight: 25 },
      { id: 'trajectoryConsistency', label: 'Trajectory Consistency', weight: 20 },
      { id: 'futureOpportunityRelevance', label: 'Future Opportunity Relevance', weight: 15 },
    ],
  },
] as const;

export function weightedScore(
  results: readonly MatchingV3MetricResult[],
  definitions: readonly { id: string; weight: number }[],
): { score: number | null; status: MatchingV3MetricStatus; confidence: number; coverage: number } {
  const byId = new Map(results.map((result) => [result.submetricId, result]));
  const assessed = definitions.flatMap((definition) => {
    const result = byId.get(definition.id);
    if (!result || result.score === null || result.status === 'not_available') return [];
    return [{ definition, result }];
  });
  const availableWeight = assessed.reduce((sum, item) => sum + item.definition.weight, 0);
  const totalWeight = definitions.reduce((sum, definition) => sum + definition.weight, 0);
  if (availableWeight === 0) return { score: null, status: 'not_available', confidence: 0, coverage: 0 };
  const score = Math.round(
    assessed.reduce((sum, item) => sum + (item.result.score ?? 0) * item.definition.weight, 0) / availableWeight,
  );
  const confidence = Number(
    (assessed.reduce((sum, item) => sum + item.result.confidence * item.definition.weight, 0) / availableWeight).toFixed(3),
  );
  const coverage = Math.round((availableWeight / totalWeight) * 100);
  return {
    score,
    status: coverage === 100 && results.every((result) => result.status === 'assessed') ? 'assessed' : 'limited',
    confidence,
    coverage,
  };
}

/** Academic rubric scores are intentionally discrete to keep them auditable. */
export function normalizeAcademicRubricScore(score: number | null): number | null {
  if (score === null) return null;
  return [0, 25, 50, 75, 100].reduce((closest, value) =>
    Math.abs(value - score) < Math.abs(closest - score) ? value : closest,
  );
}

export function sourceKind(profile: TargetProfile, ref: string): MatchingReportV3['targetSourceIndex'][number]['kind'] {
  if (profile.requirements.some((item) => item.category === 'scholarship' && item.sourceRefs.includes(ref))) return 'scholarship';
  if (profile.requirements.some((item) => item.sourceRefs.includes(ref))) return 'requirement';
  return 'programme';
}

export function targetSourceIndex(profile: TargetProfile): MatchingReportV3['targetSourceIndex'] {
  return profile.sources.map((source) => ({
    ref: source.ref,
    label: source.title ?? source.ref,
    title: source.title,
    url: source.url,
    kind: sourceKind(profile, source.ref),
  }));
}

export function targetRefsForMetric(profile: TargetProfile, metricId: string): string[] {
  const refs = new Set<string>();
  for (const requirement of profile.requirements) {
    if (requirement.category === 'scholarship') continue;
    const text = `${requirement.category} ${requirement.label} ${requirement.detail ?? ''}`.toLowerCase();
    const relevant = metricId === 'academicReadiness'
      ? requirement.category === 'academic'
      : metricId === 'distinctiveOpportunity'
        ? /opportun|research|entrepreneur|intern|mentor|programme/.test(text)
        : metricId === 'careerFutureDirection'
          ? /career|outcome|pathway|employ/.test(text)
          : metricId === 'learningEnvironment'
            ? /teach|class|campus|learn|interdisciplin|community/.test(text)
            : metricId === 'valuesAlignment' || metricId === 'communityContribution'
              ? /value|mission|ethos|culture|community|student/.test(text)
              : true;
    if (relevant) requirement.sourceRefs.forEach((ref) => refs.add(ref));
  }
  for (const source of profile.sources) {
    if (sourceKind(profile, source.ref) !== 'scholarship') refs.add(source.ref);
  }
  const known = new Set(profile.sources.map((source) => source.ref));
  return [...refs].filter((ref) => known.has(ref) && sourceKind(profile, ref) !== 'scholarship');
}

export function targetStructuredFacts(profile: TargetProfile): Array<{ id: string; label: string; value: string; sourceRefs: string[] }> {
  const facts: Array<{ id: string; label: string; value: string; sourceRefs: string[] }> = [];
  const visit = (value: unknown, label: string, id: string) => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, label, `${id}:${index}`));
      return;
    }
    if (!value || typeof value !== 'object') return;
    const record = value as Record<string, unknown>;
    if (typeof record.value === 'string' && Array.isArray(record.sourceRefs)) {
      const sourceRefs = record.sourceRefs.filter((ref): ref is string => typeof ref === 'string');
      if (sourceRefs.length > 0) facts.push({ id, label, value: record.value, sourceRefs });
      return;
    }
    for (const [key, item] of Object.entries(record)) visit(item, `${label} ${key}`, `${id}:${key}`);
  };
  visit(profile.universityProfile, 'University', 'university');
  visit(profile.programmeProfile, 'Programme', 'programme');
  return facts.slice(0, 100);
}
