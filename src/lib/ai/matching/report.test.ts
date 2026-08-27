import { describe, it, expect, vi } from 'vitest';
import { composeMatchingReport, partitionCriteriaForRecompute } from './report';
import { MATCHING_ENGINE_VERSION, MATCHING_PROMPT_BUNDLE_VERSION } from './domain';
import { REPORT_PROMPT_VERSIONS } from '../runtime/prompt-registry';
import type { FitSignal, MatchingCriterion, MatchingEvidence } from './domain';
import { stableHash } from '@/features/apply/api';

describe('partitionCriteriaForRecompute', () => {
  const mockCriterion: MatchingCriterion = {
    id: 'crit-1',
    category: 'academic_requirement',
    requirementType: 'soft',
    label: 'Test Criterion',
    description: 'Test description',
    sourceRefs: [],
    expectedSignals: [],
  } as any;

  const mockEvidence: MatchingEvidence = {
    id: 'ev-1',
    category: 'academic_requirement',
    statement: 'Did something',
    sourceRefs: ['src-1'],
    interpretationRefs: [],
    status: 'verified',
    competencies: [],
    criteria: [],
    direct: true,
    rankScore: 1,
  };

  const mockPersonalContext = { coreIdentity: [], motivations: [], direction: [] };

  it('reuses signal if hash matches and evidence exists', () => {
    const hash = stableHash({
      criterion: mockCriterion,
      retrievedEvidence: [{
        id: mockEvidence.id,
        category: mockEvidence.category,
        statement: mockEvidence.statement,
        sourceRefs: mockEvidence.sourceRefs,
        interpretationRefs: mockEvidence.interpretationRefs,
        status: mockEvidence.status,
        competencies: mockEvidence.competencies,
        criteria: mockEvidence.criteria,
        direct: mockEvidence.direct,
      }],
      personalContext: mockPersonalContext,
      engineVersion: MATCHING_ENGINE_VERSION,
      criterionPromptVersion: REPORT_PROMPT_VERSIONS.matching_criterion_reasoning,
    });

    const mockSignal: FitSignal = {
      criterionId: 'crit-1',
      category: 'academic_requirement',
      criterionLabel: 'Test Criterion',
      criterionSourceRefs: [],
      applicantEvidenceIds: ['ev-1'],
      directEvidenceIds: ['ev-1'],
      supportingEvidenceIds: [],
      alignment: 'strong',
      evidenceQuality: 'strong',
      reasoning: 'Matches',
      missingEvidence: [],
      confidence: 0.9,
      opportunity: null,
      inputHash: hash,
    };

    const { reusable, needsRecompute } = partitionCriteriaForRecompute({
      criteria: [mockCriterion],
      previousSignals: [mockSignal],
      currentEvidence: [mockEvidence],
      evidenceByCriterion: { 'crit-1': [mockEvidence] },
      personalContext: mockPersonalContext,
      previousMetadata: {
        contractVersion: 'matching-report-v2',
        matchingEngineVersion: MATCHING_ENGINE_VERSION,
        promptVersion: MATCHING_PROMPT_BUNDLE_VERSION,
        criterionPromptVersion: REPORT_PROMPT_VERSIONS.matching_criterion_reasoning,
      },
    });

    expect(reusable).toHaveLength(1);
    expect(reusable[0]).toBe(mockSignal);
    expect(needsRecompute).toHaveLength(0);
  });

  it('does not reuse if evidence is missing', () => {
    const mockSignal: FitSignal = {
      criterionId: 'crit-1',
      category: 'academic_requirement',
      criterionLabel: 'Test',
      criterionSourceRefs: [],
      applicantEvidenceIds: ['ev-1', 'ev-2'], // ev-2 is missing in currentEvidence
      directEvidenceIds: ['ev-1'],
      supportingEvidenceIds: [],
      alignment: 'strong',
      evidenceQuality: 'strong',
      reasoning: 'Matches',
      missingEvidence: [],
      confidence: 0.9,
      opportunity: null,
      inputHash: 'hash',
    };

    const { reusable, needsRecompute } = partitionCriteriaForRecompute({
      criteria: [mockCriterion],
      previousSignals: [mockSignal],
      currentEvidence: [mockEvidence],
      evidenceByCriterion: { 'crit-1': [mockEvidence] },
      personalContext: mockPersonalContext,
    });

    expect(reusable).toHaveLength(0);
    expect(needsRecompute).toHaveLength(1);
  });
});

describe('composeMatchingReport', () => {
  const fakeLineage = {
    targetProfileVersionId: 'tp-1',
    personalReportVersionId: 'pr-1',
    sourceAnalysisVersionId: 'sa-1',
    confirmedSnapshotId: 'cs-1',
    evidenceBankVersion: 'eb-1',
  };

  const emptyPersonalContext = { coreIdentity: [], motivations: [], direction: [] };

  const fakeTargetProfile: any = {
    id: 'tp-1',
    title: 'Profile',
    type: 'university',
    requirements: [],
    universityValues: [],
    programmeThemes: { themes: [] },
    hardRequirements: [],
    preferredBackground: [],
    academicCompetitiveness: { status: 'not_available', score: null },
    strategicContext: '',
  };

  const fakeAcademicProfile: any = {
    qualifications: [],
    tests: [],
  };

  const fakeEvidenceBank: any = {
    version: 'eb-1',
    sources: {
      'src-1': { id: 'src-1', type: 'achievement', label: 'Test' },
    },
    claims: [],
    achievements: [],
    activities: [],
    englishTests: [],
    standardizedTests: [],
    documents: [],
    profile: {},
  };

  const fakeProgrammeFitInput: any = {
    eligibility: { requiredSubjects: 'unknown', minimumQualification: 'unknown', languageRequirement: 'unknown', citizenshipRequirement: 'unknown', deadline: 'unknown' },
    academicBand: 'unknown',
    dimensions: {
      academicCompetitiveness: { status: 'not_available', score: null, summary: '', strengths: [], gaps: [], evidenceRefs: [] },
      personaAlignment: { status: 'not_available', score: null, summary: '', strengths: [], gaps: [], evidenceRefs: [] },
      financialFeasibility: { status: 'not_available', score: null, summary: '', strengths: [], gaps: [], evidenceRefs: [] },
      careerDirection: { status: 'not_available', score: null, summary: '', strengths: [], gaps: [], evidenceRefs: [] },
      applicationReadiness: { status: 'not_available', score: null, summary: '', strengths: [], gaps: [], evidenceRefs: [] },
    }
  };

  it('completes the pipeline with empty criteria', async () => {
    const fakeGenerate = vi.fn().mockResolvedValue({
      data: {
        summary: 'This is a valid summary that is over eighty characters long to meet the schema length requirements.',
        criterionIds: [],
        evidenceIds: [],
      }
    });

    const report = await composeMatchingReport({
      targetProfile: fakeTargetProfile,
      academicProfile: fakeAcademicProfile,
      evidenceBank: fakeEvidenceBank,
      personalContext: emptyPersonalContext,
      previousReport: null,
      lineage: fakeLineage,
      programmeFitInput: fakeProgrammeFitInput,
      generate: fakeGenerate,
    });

    expect(report.contractVersion).toBe('matching-report-v2');
    expect(report.overall.evidenceCoverage).toBe(0);
    expect(fakeGenerate).toHaveBeenCalledTimes(1); // Only generate summary
    expect(report.metadata.targetProfileVersionId).toBe(fakeLineage.targetProfileVersionId);
  });

  it('handles scholarship isolation', async () => {
    const targetWithScholarship: any = {
      ...fakeTargetProfile,
      requirements: [
        {
          id: 'crit-scholarship',
          category: 'scholarship',
          label: 'Needs funding',
          detail: 'Must need funding',
          status: 'required',
          sourceRefs: [],
          expectedSignals: [],
        }
      ]
    };

    const fakeGenerate = vi.fn().mockImplementation(async (args) => {
      if (args.moduleId === 'matching_criterion_reasoning') {
        return {
          data: {
            results: [
              {
                criterionId: 'scholarship:crit-scholarship',
                alignment: 'strong',
                evidenceIds: [],
                directEvidenceIds: [],
                supportingEvidenceIds: [],
                reasoning: 'Has funding needs.',
                missingEvidence: [],
                evidenceQuality: 'strong',
                confidence: 0.9,
              }
            ]
          }
        };
      }
      return {
        data: {
          summary: 'This is a valid summary that is over eighty characters long to meet the schema length requirements.',
          criterionIds: [],
          evidenceIds: [],
        }
      };
    });


    const report = await composeMatchingReport({
      targetProfile: targetWithScholarship,
      academicProfile: fakeAcademicProfile,
      evidenceBank: fakeEvidenceBank,
      personalContext: emptyPersonalContext,
      previousReport: null,
      lineage: fakeLineage,
      programmeFitInput: fakeProgrammeFitInput,
      generate: fakeGenerate,
    });

    expect(report.scholarshipAlignment).not.toBeNull();
    expect(report.scholarshipAlignment?.hardRequirements?.[0]?.criterionId).toBe('scholarship:crit-scholarship');
    expect(report.scholarshipAlignment?.criteria).toHaveLength(0);
    expect(report.programmeAlignment).toHaveLength(0);
  });

  it('filters hallucinated evidence from reasoner output', async () => {
    const fakeGenerate = vi.fn()
      .mockResolvedValueOnce({
        data: {
          results: [
            {
              criterionId: 'competency:crit-1',
              alignment: 'strong',
              evidenceIds: ['ev-1', 'fake-1'],
              directEvidenceIds: ['ev-1', 'fake-2'],
              supportingEvidenceIds: ['fake-3'],
              reasoning: 'hallucinated stuff',
              missingEvidence: [],
              evidenceQuality: 'strong',
              confidence: 0.9,
            }
          ]
        }
      })
      .mockResolvedValueOnce({
        data: {
          summary: 'This is a valid summary of the matching analysis report that meets the eighty characters minimum length requirement.',
          criterionIds: [],
          evidenceIds: [],
        }
      });

    const targetWithCrit: any = {
      ...fakeTargetProfile,
      requirements: [
        {
          id: 'crit-1',
          category: 'competency',
          label: 'Test',
          detail: 'Test detail',
          status: 'required',
          sourceRefs: [],
          expectedSignals: [],
        }
      ]
    };

    const mockEvBank: any = {
      ...fakeEvidenceBank,
      claims: [
        {
          id: 'ev-1',
          category: 'competency',
          statement: 'Legit evidence',
          status: 'verified',
          relevanceContext: '',
          timestamp: '',
          sourceRefs: ['src-1'],
          interpretationRefs: [],
          tags: { competencies: ['Test'], criteria: ['competency'] },
        }
      ]
    };

    await expect(composeMatchingReport({
      targetProfile: targetWithCrit,
      academicProfile: fakeAcademicProfile,
      evidenceBank: mockEvBank,
      personalContext: emptyPersonalContext,
      previousReport: null,
      lineage: fakeLineage,
      programmeFitInput: fakeProgrammeFitInput,
      generate: fakeGenerate,
    })).rejects.toThrow('Failed to process');
  });
});
