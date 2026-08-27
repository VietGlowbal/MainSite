import { describe, it, expect } from 'vitest';
import {
  analysisFromRow,
  isMigrationMissing,
  saveApplicationMatchingAnalysis,
  toMatchingAnalysisRecord,
} from './ai-reports-repository';
import { MATCHING_REPORT_CONTRACT_VERSION } from '@/lib/ai/matching/domain';
import { vi } from 'vitest';

describe('ai-reports-repository helpers', () => {
  describe('isMigrationMissing', () => {
    it('returns true for known missing column/table error codes', () => {
      expect(isMigrationMissing({ code: '42P01', message: 'relation does not exist' } as any)).toBe(true);
      expect(isMigrationMissing({ code: '42703', message: 'column does not exist' } as any)).toBe(true);
      expect(isMigrationMissing({ code: 'PGRST204', message: 'column does not exist' } as any)).toBe(true);
      expect(isMigrationMissing({ code: 'PGRST205', message: 'relation does not exist' } as any)).toBe(true);
    });

    it('returns false for other errors or null', () => {
      expect(isMigrationMissing(null)).toBe(false);
      expect(isMigrationMissing(undefined)).toBe(false);
      expect(isMigrationMissing({ code: '23505', message: 'unique violation' } as any)).toBe(false);
    });
  });

  describe('toMatchingAnalysisRecord', () => {
    const baseRow = {
      id: 'analysis-123',
      application_id: 'app-456',
      user_id: 'user-789',
      input_hash: 'hash-abc',
      prompt_version: 'v2',
      created_at: '2026-08-27T00:00:00Z',
      analysis_status: 'complete',
      current_match_score: 85,
      max_possible_match_score: 100,
      score_label: 'Strong Match',
      strengths: ['s1'],
      weaknesses: ['w1'],
      fit_classification: 'strong_match',
      fit_confidence: 90,
    };

    it('maps snake_case legacy row to camelCase and sets reportV2 to null if absent', () => {
      const record = toMatchingAnalysisRecord(baseRow);
      expect(record.id).toBe('analysis-123');
      expect(record.applicationId).toBe('app-456');
      expect(record.userId).toBe('user-789');
      expect(record.inputHash).toBe('hash-abc');
      expect(record.currentMatchScore).toBe(85);
      expect(record.fitClassification).toBe('strong_match');
      expect(record.reportV2).toBeNull();
      expect(record.reportContractVersion).toBeNull();
    });

    it('sets reportV2 to null if JSON is invalid', () => {
      const record = toMatchingAnalysisRecord({
        ...baseRow,
        report_v2: { invalid: 'schema' },
      });
      expect(record.reportV2).toBeNull();
    });

    it('parses reportV2 if JSON is valid', () => {
      const validReport = {
        contractVersion: MATCHING_REPORT_CONTRACT_VERSION,
        generatedAt: '2026-08-27T00:00:00Z',
        overall: {
          summary: 'Summary text here.',
          summaryCriterionIds: [],
          summaryEvidenceIds: [],
          strongestAlignment: [],
          mostImportantGaps: [],
          evidenceCoverage: 80,
          fitScore: 75,
          fitLabel: 'strong_current_alignment',
        },
        criteria: [],
        academicRequirements: [],
        programmeAlignment: [],
        strengths: [],
        gaps: [],
        positioningOpportunities: [],
        scholarshipAlignment: null,
        programmeFit: {
          classification: 'strong_match',
          confidence: 90,
          limitations: [],
          eligibility: {
            requiredSubjects: 'met',
            minimumQualification: 'met',
            languageRequirement: 'met',
            citizenshipRequirement: 'met',
            deadline: 'met',
          },
          dimensions: {
            academicCompetitiveness: { status: 'assessed', score: 4, summary: 's', strengths: [], gaps: [], evidence: [] },
            personaAlignment: { status: 'assessed', score: 4, summary: 's', strengths: [], gaps: [], evidence: [] },
            financialFeasibility: { status: 'assessed', score: 4, summary: 's', strengths: [], gaps: [], evidence: [] },
            careerDirection: { status: 'assessed', score: 4, summary: 's', strengths: [], gaps: [], evidence: [] },
            applicationReadiness: { status: 'assessed', score: 4, summary: 's', strengths: [], gaps: [], evidence: [] },
          },
        },
        dependencyIndex: {},
        metadata: {
          matchingEngineVersion: 'matching-v2.0.0',
          promptVersion: 'prompts-v2',
          criterionPromptVersion: 'cp-v2',
          summaryPromptVersion: 'sp-v2',
          model: 'gpt-4o',
          targetProfileVersionId: 'tp-1',
          personalReportVersionId: 'pr-1',
          sourceAnalysisVersionId: 'sa-1',
          confirmedSnapshotId: 'cs-1',
          evidenceBankVersion: 'eb-1',
          reusedCriterionIds: [],
          aiCallCount: {
            criterionBatches: 2,
            summary: 1,
          },
        },
      };

      const record = toMatchingAnalysisRecord({
        ...baseRow,
        report_v2: validReport,
        report_contract_version: validReport.contractVersion,
        matching_engine_version: validReport.metadata.matchingEngineVersion,
      });

      expect(record.reportV2).not.toBeNull();
      expect(record.reportV2?.contractVersion).toBe(MATCHING_REPORT_CONTRACT_VERSION);
      expect(record.reportContractVersion).toBe(MATCHING_REPORT_CONTRACT_VERSION);
      expect(record.matchingEngineVersion).toBe('matching-v2.0.0');

      const pageView = analysisFromRow({
        ...baseRow,
        report_v2: validReport,
      });
      expect(pageView?.reportV2?.overall.fitScore).toBe(75);
      expect(pageView?.fit.classification).toBe('strong_match');
    });

    it('falls back to the legacy F5 columns when report_v2 is invalid', () => {
      const view = analysisFromRow({
        ...baseRow,
        fit_dimensions: {
          academicCompetitiveness: { status: 'assessed', score: 4, summary: 's', strengths: [], gaps: [], evidence: [] },
          personaAlignment: { status: 'assessed', score: 4, summary: 's', strengths: [], gaps: [], evidence: [] },
          financialFeasibility: { status: 'assessed', score: 4, summary: 's', strengths: [], gaps: [], evidence: [] },
          careerDirection: { status: 'assessed', score: 4, summary: 's', strengths: [], gaps: [], evidence: [] },
          applicationReadiness: { status: 'assessed', score: 4, summary: 's', strengths: [], gaps: [], evidence: [] },
        },
        fit_eligibility: { requiredSubjects: 'met', minimumQualification: 'met', languageRequirement: 'met', citizenshipRequirement: 'met', deadline: 'met' },
        fit_classification: 'strong_match',
        fit_confidence: 90,
        report_v2: { invalid: true },
      });
      expect(view?.reportV2).toBeUndefined();
      expect(view?.fit.classification).toBe('strong_match');
    });
  });

  it('does not insert a legacy row when the V2 migration is missing', async () => {
    const insert = vi.fn();
    const insertChain = {
      select: vi.fn(() => insertChain),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { code: '42703', message: 'column report_v2 does not exist' },
      }),
    };
    insert.mockReturnValue(insertChain);
    const supabase = { from: vi.fn(() => ({ insert })) } as any;

    const result = await saveApplicationMatchingAnalysis(supabase, {
      applicationId: 'app-1',
      userId: 'user-1',
      inputHash: 'hash-1',
      promptVersion: 'matching-prompts-v2',
      legacy: {
        currentMatchScore: null,
        maxPossibleMatchScore: null,
        scoreLabel: 'Not assessed',
        maxScoreLabel: 'Not assessed',
        pillars: {},
        confidence: 0,
        inputsPresent: {},
        strengths: [],
        weaknesses: [],
        improvementActions: [],
        explanation: 'Not assessed',
      },
      reportV2: {
        contractVersion: 'matching-report-v2',
        metadata: { matchingEngineVersion: 'matching-v2.0.0' },
      } as any,
      modelName: 'test-model',
      targetProfileVersionId: 'tp-1',
      sourceAnalysisVersionId: 'sa-1',
      confirmedSnapshotId: 'cs-1',
      sourcePersonalReportVersionId: 'pr-1',
      sourcePersonalReportInputHash: 'pr-hash',
      f5EngineVersion: 'f5-v1',
      fitDimensions: {},
      fitEligibility: {},
      fitClassification: 'insufficient_data',
      fitConfidence: 0,
      fitLimitations: [],
    });

    expect(result).toEqual({ record: null, migrationMissing: true });
    expect(insert).toHaveBeenCalledTimes(1);
  });
});
