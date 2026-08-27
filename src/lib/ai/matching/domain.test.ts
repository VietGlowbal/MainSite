import { describe, expect, it } from 'vitest';
import { programmeFitSchema } from '@/features/apply/domain';
import {
  MATCHING_REPORT_CONTRACT_VERSION,
  matchingEvidenceSchema,
  matchingReportV2Schema,
  matchingSummaryResultSchema,
  fitSignalSchema,
  type MatchingReportV2,
} from './domain';

const programmeFit = programmeFitSchema.parse({
  classification: 'match',
  confidence: 70,
  limitations: [],
  eligibility: {
    requiredSubjects: 'met',
    minimumQualification: 'met',
    languageRequirement: 'met',
    citizenshipRequirement: 'unknown',
    deadline: 'met',
  },
  dimensions: Object.fromEntries(
    [
      'academicCompetitiveness',
      'personaAlignment',
      'financialFeasibility',
      'careerDirection',
      'applicationReadiness',
    ].map((key) => [
      key,
      {
        status: 'assessed',
        score: 3,
        summary: 'Evidence-backed assessment.',
        strengths: [],
        gaps: [],
        evidence: [],
      },
    ]),
  ),
});

const criterion = {
  id: 'academic_requirement:adm-1',
  category: 'academic_requirement' as const,
  label: 'Minimum mathematics grade',
  description: 'The programme requires a minimum mathematics grade.',
  importance: 'critical' as const,
  requirementType: 'hard' as const,
  sourceRefs: ['source:admissions'],
  sourceText: 'Minimum mathematics grade: B',
  expectedSignals: ['minimum', 'mathematics', 'grade'],
  negativeSignals: [],
  metadata: {
    importanceSource: 'source' as const,
    targetRequirementId: 'adm-1',
    missingInformation: null,
  },
};

const evidence = {
  id: 'claim-1',
  category: 'academic',
  statement: 'Mathematics grade B.',
  sourceRefs: ['achievement:1'],
  interpretationRefs: [],
  status: 'verified' as const,
  competencies: [],
  criteria: [criterion.id],
  direct: true,
  rankScore: 50,
};

const fitSignal = {
  criterionId: criterion.id,
  category: criterion.category,
  criterionLabel: criterion.label,
  criterionSourceRefs: criterion.sourceRefs,
  applicantEvidenceIds: [evidence.id],
  directEvidenceIds: [evidence.id],
  supportingEvidenceIds: [],
  alignment: 'strong' as const,
  evidenceQuality: 'strong' as const,
  reasoning: 'The verified grade meets the published requirement.',
  missingEvidence: [],
  confidence: 0.95,
  opportunity: null,
  inputHash: 'criterion-input-hash',
};

function report(overrides: Partial<MatchingReportV2> = {}): MatchingReportV2 {
  return {
    contractVersion: MATCHING_REPORT_CONTRACT_VERSION,
    generatedAt: '2026-08-27T00:00:00.000Z',
    overall: {
      summary: 'Current alignment is supported by the available evidence.',
      summaryCriterionIds: [criterion.id],
      summaryEvidenceIds: [evidence.id],
      strongestAlignment: [criterion.id],
      mostImportantGaps: [],
      evidenceCoverage: 100,
      fitScore: 80,
      fitLabel: 'strong_current_alignment',
    },
    criteria: [criterion],
    academicRequirements: [
      {
        criterionId: criterion.id,
        status: 'meets',
        applicantValue: 'B',
        requiredValue: 'B',
        evidenceIds: [evidence.id],
        explanation: 'The available grade meets the stated threshold.',
      },
    ],
    programmeAlignment: [fitSignal],
    strengths: [
      {
        id: 'strength-1',
        title: 'Mathematics preparation',
        description: 'The required grade is present.',
        criterionIds: [criterion.id],
        evidenceIds: [evidence.id],
        strength: 'high',
        whyItMatters: 'It supports academic readiness.',
        positioningUse: null,
      },
    ],
    gaps: [],
    positioningOpportunities: [],
    scholarshipAlignment: null,
    programmeFit,
    dependencyIndex: { [evidence.id]: [criterion.id] },
    metadata: {
      matchingEngineVersion: 'matching-v2.0.0',
      promptVersion: 'matching-prompts-v2.0.0',
      criterionPromptVersion: 'matching-criterion-v2.0.0',
      summaryPromptVersion: 'matching-summary-v2.0.0',
      model: 'test-model',
      targetProfileVersionId: 'target-profile-1',
      personalReportVersionId: 'personal-report-1',
      sourceAnalysisVersionId: 'analysis-1',
      confirmedSnapshotId: 'snapshot-1',
      evidenceBankVersion: 'eb-v1',
      reusedCriterionIds: [],
      aiCallCount: { criterionBatches: 1, summary: 1 },
    },
    ...overrides,
  };
}

describe('matching report v2 domain contract', () => {
  it('rejects FitSignal confidence outside 0..1 and empty evidence IDs', () => {
    expect(fitSignalSchema.safeParse({ ...fitSignal, confidence: 1.01 }).success).toBe(false);
    expect(
      fitSignalSchema.safeParse({ ...fitSignal, applicantEvidenceIds: [''] }).success,
    ).toBe(false);
  });

  it('rejects empty evidence IDs at the evidence boundary', () => {
    expect(matchingEvidenceSchema.safeParse({ ...evidence, id: '' }).success).toBe(false);
  });

  it('requires every report lineage identifier', () => {
    const value = report({
      metadata: { ...report().metadata, confirmedSnapshotId: '' },
    });
    expect(matchingReportV2Schema.safeParse(value).success).toBe(false);
  });

  it('keeps scholarship criteria out of programme alignment', () => {
    const scholarshipCriterion = {
      ...criterion,
      id: 'scholarship:sch-1',
      category: 'scholarship' as const,
      requirementType: 'unknown' as const,
    };
    const scholarshipSignal = {
      ...fitSignal,
      criterionId: scholarshipCriterion.id,
      category: scholarshipCriterion.category,
      criterionLabel: scholarshipCriterion.label,
      criterionSourceRefs: [],
    };
    const value = report({
      criteria: [criterion, scholarshipCriterion],
      programmeAlignment: [fitSignal, scholarshipSignal],
    });
    expect(matchingReportV2Schema.safeParse(value).success).toBe(false);
  });

  it('keeps hard criteria out of semantic programme batches', () => {
    const value = report({ programmeAlignment: [] });
    expect(matchingReportV2Schema.safeParse(value).success).toBe(true);
    expect(
      matchingReportV2Schema.safeParse(report({ programmeAlignment: [fitSignal] })).success,
    ).toBe(false);
  });

  it('rejects unknown contract versions', () => {
    expect(
      matchingReportV2Schema.safeParse({ ...report(), contractVersion: 'matching-report-v3' }).success,
    ).toBe(false);
  });

  it('enforces the summary length contract at both boundaries', () => {
    const base = { summary: '', criterionIds: [], evidenceIds: [] };
    expect(matchingSummaryResultSchema.safeParse({ ...base, summary: 'x'.repeat(80) }).success).toBe(true);
    expect(matchingSummaryResultSchema.safeParse({ ...base, summary: 'x'.repeat(1_600) }).success).toBe(true);
    expect(matchingSummaryResultSchema.safeParse({ ...base, summary: 'x'.repeat(79) }).success).toBe(false);
    expect(matchingSummaryResultSchema.safeParse({ ...base, summary: 'x'.repeat(1_601) }).success).toBe(false);
  });
});
