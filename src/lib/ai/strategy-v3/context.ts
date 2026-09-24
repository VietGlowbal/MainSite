import type { MatchingReportV3 } from '@/lib/ai/matching/domain';
import type { StoredApplicationProfileAnalysis } from '@/features/apply/api/application-analysis-repository';
import type { PersonalReportV2 } from '@/features/apply/domain';
import type { ApplicantAIState, ActivityAnalysisItem } from '@/lib/ai/applicant-state/domain';
import type { TargetProfile } from '@/lib/ai/target-profile/domain';
import type {
  StrategyEvidenceIndexItem,
  StrategyTargetSourceIndexItem,
} from './domain';

export type StrategyActivityContext = {
  activityId: string;
  title: string;
  category: string | null;
  organisation: string | null;
  level: string | null;
  period: string | null;
  description: string | null;
  reflection: Record<string, unknown> | null;
  evidenceIds: string[];
};

export type StrategyInputContext = {
  lineage: {
    applicationId: string;
    personalReportVersionId: string;
    personalReportInputHash: string | null;
    sourceAnalysisVersionId: string | null;
    confirmedSnapshotId: string | null;
    matchingReportId: string;
    matchingInputHash: string | null;
    matchingContractVersion: string;
    matchingEngineVersion: string;
    targetProfileVersionId: string | null;
    selectedScholarshipVersionId: string | null;
  };
  applicant: {
    personalReport: Record<string, unknown>;
    sourceAnalysis: Record<string, unknown> | null;
    directionSignals: Record<string, string | null>;
  };
  activities: StrategyActivityContext[];
  matching: MatchingReportV3;
  target: {
    university: Record<string, unknown>;
    programme: Record<string, unknown>;
    requirements: unknown[];
    opportunities: unknown[];
    scholarship: Record<string, unknown> | null;
    sources: StrategyTargetSourceIndexItem[];
  };
  application: {
    status: string | null;
    deadline: string | null;
    daysUntilDeadline: number | null;
    intake: string | null;
  };
  evidenceIndex: StrategyEvidenceIndexItem[];
  targetSourceIndex: StrategyTargetSourceIndexItem[];
};

export function buildStrategyInputContext(args: {
  applicationId: string;
  application: Record<string, unknown>;
  personalReport: PersonalReportV2;
  matching: MatchingReportV3;
  snapshotState: ApplicantAIState;
  sourceAnalysis: StoredApplicationProfileAnalysis | null;
  targetProfile: { id: string; profile: TargetProfile } | null;
  now?: Date;
}): StrategyInputContext {
  const { application, personalReport, matching, snapshotState, sourceAnalysis, targetProfile } = args;
  const activities = [...snapshotState.achievements, ...snapshotState.activities].map(activityContext);
  const evidenceIndex = buildEvidenceIndex(snapshotState, sourceAnalysis, matching, personalReport);
  const targetSourceIndex = buildTargetSourceIndex(targetProfile?.profile, matching);
  const deadline = stringValue(application.deadline);
  const daysUntilDeadline = deadline ? daysBetween(args.now ?? new Date(), deadline) : null;
  const selectedScholarshipVersionId =
    stringValue(application.selected_scholarship_version_id) ??
    stringValue(application.scholarship_version_id) ??
    matching.metadata.selectedScholarshipVersionId ??
    null;

  const structuredReport = Object.fromEntries(
    Object.entries(personalReport).filter(([key]) => key !== 'narrativeDetails'),
  );
  return {
    lineage: {
      applicationId: args.applicationId,
      personalReportVersionId: '',
      personalReportInputHash: null,
      sourceAnalysisVersionId: sourceAnalysis?.id ?? null,
      confirmedSnapshotId: snapshotState.snapshotId,
      matchingReportId: '',
      matchingInputHash: null,
      matchingContractVersion: matching.contractVersion,
      matchingEngineVersion: matching.metadata.matchingEngineVersion,
      targetProfileVersionId: targetProfile?.id ?? null,
      selectedScholarshipVersionId,
    },
    applicant: {
      personalReport: structuredReport as Record<string, unknown>,
      sourceAnalysis: sourceAnalysis
        ? { structuredOutputs: sourceAnalysis.structuredOutputs, evidenceBank: sourceAnalysis.evidenceBank }
        : null,
      directionSignals: {
        intendedDirection: snapshotState.directionSignals?.intendedDirection ?? null,
        academicDirection: snapshotState.directionSignals?.academicDirection ?? null,
        careerDirection: snapshotState.directionSignals?.careerDirection ?? null,
        preferredEnvironment: snapshotState.directionSignals?.preferredEnvironment ?? null,
      },
    },
    activities,
    matching,
    target: {
      university: targetProfile?.profile.universityProfile ?? {
        name: stringValue(application.university_name) ?? '',
      },
      programme: targetProfile?.profile.programme ?? {
        id: stringValue(application.course_id) ?? '',
        name: stringValue(application.course_name) ?? '',
        university: stringValue(application.university_name) ?? '',
        level: stringValue(application.degree_level),
        subject: stringValue(application.subject),
      },
      requirements: targetProfile?.profile.requirements ?? matching.hardRequirements,
      opportunities: targetProfile?.profile.programmeProfile?.opportunities ?? [],
      scholarship: targetProfile?.profile.scholarshipProfile ?? null,
      sources: targetSourceIndex,
    },
    application: {
      status: stringValue(application.status),
      deadline,
      daysUntilDeadline,
      intake: stringValue(application.intake),
    },
    evidenceIndex,
    targetSourceIndex,
  };
}

export function withStrategyLineage(
  context: StrategyInputContext,
  lineage: Partial<StrategyInputContext['lineage']>,
): StrategyInputContext {
  return { ...context, lineage: { ...context.lineage, ...lineage } };
}

function activityContext(item: ActivityAnalysisItem): StrategyActivityContext {
  return {
    activityId: item.id,
    title: item.title,
    category: item.category ?? null,
    organisation: item.organisation ?? null,
    level: item.level ?? null,
    period: item.period ?? (item.year ? String(item.year) : null),
    description: item.freeText,
    reflection: item.reflectionCard ?? item.reflection ?? null,
    evidenceIds: [item.id],
  };
}

function buildEvidenceIndex(
  state: ApplicantAIState,
  sourceAnalysis: StoredApplicationProfileAnalysis | null,
  matching: MatchingReportV3,
  personalReport: PersonalReportV2,
): StrategyEvidenceIndexItem[] {
  const items: StrategyEvidenceIndexItem[] = state.evidenceBank.map((item) => {
    const raw = record(item.raw);
    const hasDocument = item.kind === 'document' ||
      (item.kind === 'achievement' && (
        stringValue(raw.evidenceKey ?? raw.evidence_key) !== null ||
        ['uploaded_document', 'document'].includes(stringValue(raw.sourceType ?? raw.source_type) ?? '')
      ));
    return {
      id: item.id,
      label: item.label,
      statement: item.label,
      kind: 'applicant',
      status: hasDocument ? 'verified' : 'unverified',
      sourceRefs: [item.id],
      direct: hasDocument,
    };
  });
  const known = new Set(items.map((item) => item.id));
  const addReportOnly = (item: { id: string; label: string; sourceRefs?: string[]; kind?: string }) => {
    if (known.has(item.id)) return;
    items.push({
      id: item.id,
      label: item.label,
      statement: item.label,
      kind: item.kind === 'hard_requirement' ? 'hard_requirement' : 'applicant',
      status: 'report_only',
      sourceRefs: item.sourceRefs ?? [],
      direct: false,
    });
    known.add(item.id);
  };
  for (const item of matching.evidenceIndex) addReportOnly(item);
  const storedEvidenceBank = sourceAnalysis?.evidenceBank;
  const analysisEvidence = Array.isArray(storedEvidenceBank)
    ? storedEvidenceBank
    : storedEvidenceBank && typeof storedEvidenceBank === 'object' && !Array.isArray(storedEvidenceBank)
      ? Array.isArray((storedEvidenceBank as Record<string, unknown>).claims)
        ? ((storedEvidenceBank as Record<string, unknown>).claims as unknown[])
        : []
      : [];
  for (const raw of analysisEvidence) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Record<string, unknown>;
    const id = stringValue(item.id);
    if (id) addReportOnly({ id, label: stringValue(item.label) ?? stringValue(item.statement) ?? id });
  }
  for (const item of [...state.achievements, ...state.activities]) {
    addReportOnly({ id: experienceEvidenceId(item.id), label: item.title });
  }
  for (const item of state.evidenceBank) {
    const [kind] = item.id.split(':');
    if (item.kind === 'achievement' || item.kind === 'activity' || kind === 'achievement' || kind === 'activity') {
      addReportOnly({ id: experienceEvidenceId(item.id), label: item.label });
    }
  }
  addPersonalReportEvidence(personalReport, addReportOnly);
  return items;
}

function experienceEvidenceId(id: string): string {
  const parts = id.split(':');
  while (parts.length > 1 && ['achievement', 'activity', 'experience'].includes(parts[0] ?? '')) parts.shift();
  return `experience:${parts.join(':')}`;
}

function addPersonalReportEvidence(
  report: PersonalReportV2,
  add: (item: { id: string; label: string }) => void,
): void {
  const visit = (value: unknown, field?: string): void => {
    if (Array.isArray(value)) {
      if (field === 'evidenceRefs') {
        for (const raw of value) {
          if (!raw || typeof raw !== 'object') continue;
          const item = raw as Record<string, unknown>;
          const id = stringValue(item.id);
          if (id) add({ id, label: stringValue(item.label) ?? id });
        }
        return;
      }
      if (field === 'evidenceIds' || field?.endsWith('EvidenceIds')) {
        for (const raw of value) {
          if (typeof raw === 'string' && raw.trim()) add({ id: raw.trim(), label: raw.trim() });
        }
        return;
      }
      for (const item of value) visit(item, field);
      return;
    }
    if (!value || typeof value !== 'object') return;
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (key !== 'narrativeDetails') visit(item, key);
    }
  };

  visit(report);
}

function buildTargetSourceIndex(
  profile: TargetProfile | undefined,
  matching: MatchingReportV3,
): StrategyTargetSourceIndexItem[] {
  const result = matching.targetSourceIndex.map((source) => ({ ...source }));
  const known = new Set(result.map((source) => source.ref));
  for (const source of profile?.sources ?? []) {
    if (known.has(source.ref)) continue;
    result.push({
      ref: source.ref,
      label: source.title ?? source.ref,
      title: source.title,
      url: source.url,
      kind: 'programme',
    });
    known.add(source.ref);
  }
  return result;
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function daysBetween(now: Date, deadline: string): number | null {
  const parsed = Date.parse(deadline);
  if (!Number.isFinite(parsed)) return null;
  return Math.ceil((parsed - now.getTime()) / 86_400_000);
}
