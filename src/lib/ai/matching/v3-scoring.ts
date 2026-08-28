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
      { id: 'academicPreparation', label: 'Academic preparation', weight: 40 },
      { id: 'curriculumReadiness', label: 'Curriculum readiness', weight: 25 },
      { id: 'academicEvidence', label: 'Academic evidence', weight: 20 },
      { id: 'academicRequirements', label: 'Academic requirements', weight: 15 },
    ],
  },
  {
    id: 'valuesAlignment', label: 'Values Alignment', weight: 25,
    submetrics: [
      { id: 'missionValues', label: 'Mission and values', weight: 35 },
      { id: 'educationalPhilosophy', label: 'Educational philosophy', weight: 30 },
      { id: 'communityValues', label: 'Community values', weight: 20 },
      { id: 'personalPositioning', label: 'Personal positioning', weight: 15 },
    ],
  },
  {
    id: 'communityContribution', label: 'Community & Contribution', weight: 20,
    submetrics: [
      { id: 'contributionEvidence', label: 'Contribution evidence', weight: 35 },
      { id: 'socialProof', label: 'Social proof', weight: 25 },
      { id: 'collaboration', label: 'Collaboration', weight: 20 },
      { id: 'communityOpportunity', label: 'Community opportunity', weight: 20 },
    ],
  },
  {
    id: 'learningEnvironment', label: 'Learning Environment', weight: 15,
    submetrics: [
      { id: 'teachingModel', label: 'Teaching model', weight: 35 },
      { id: 'experientialLearning', label: 'Experiential learning', weight: 25 },
      { id: 'classStructure', label: 'Class structure', weight: 20 },
      { id: 'environmentPreference', label: 'Environment preference', weight: 20 },
    ],
  },
  {
    id: 'distinctiveOpportunity', label: 'Distinctive Opportunity', weight: 15,
    submetrics: [
      { id: 'namedOpportunity', label: 'Named opportunity', weight: 35 },
      { id: 'opportunityFit', label: 'Opportunity fit', weight: 25 },
      { id: 'accessPath', label: 'Access path', weight: 25 },
      { id: 'distinctiveness', label: 'Distinctiveness', weight: 15 },
    ],
  },
] as const;

export const PROGRAMME_FIT_METRICS: readonly V3MetricDefinition[] = [
  {
    id: 'interestMotivation', label: 'Interest & Motivation', weight: 30,
    submetrics: [
      { id: 'statedInterest', label: 'Stated interest', weight: 30 },
      { id: 'motivationGrounding', label: 'Motivation grounding', weight: 30 },
      { id: 'themeAlignment', label: 'Theme alignment', weight: 25 },
      { id: 'subjectExploration', label: 'Subject exploration', weight: 15 },
    ],
  },
  {
    id: 'capability', label: 'Capability', weight: 25,
    submetrics: [
      { id: 'targetCompetencies', label: 'Target competencies', weight: 40 },
      { id: 'academicCapability', label: 'Academic capability', weight: 30 },
      { id: 'demonstratedSkills', label: 'Demonstrated skills', weight: 20 },
      { id: 'capabilityEvidence', label: 'Capability evidence', weight: 10 },
    ],
  },
  {
    id: 'experienceExposure', label: 'Experience & Exposure', weight: 20,
    submetrics: [
      { id: 'relevantExperience', label: 'Relevant experience', weight: 40 },
      { id: 'meaningfulEngagement', label: 'Meaningful engagement', weight: 25 },
      { id: 'reflectionDepth', label: 'Reflection depth', weight: 20 },
      { id: 'exposureRange', label: 'Exposure range', weight: 15 },
    ],
  },
  {
    id: 'careerFutureDirection', label: 'Career & Future Direction', weight: 25,
    submetrics: [
      { id: 'futureDirection', label: 'Future direction', weight: 40 },
      { id: 'pathwayAlignment', label: 'Pathway alignment', weight: 25 },
      { id: 'opportunityUse', label: 'Opportunity use', weight: 20 },
      { id: 'directionEvidence', label: 'Direction evidence', weight: 15 },
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
  return [...refs].filter((ref) => known.has(ref));
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
