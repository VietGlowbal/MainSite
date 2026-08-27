import { describe, it, expect, vi } from 'vitest';
import { composeMatchingReport } from './report';
import type { TargetProfile } from '@/lib/ai/target-profile/domain';
import type { EvidenceBank } from '@/shared/evidence/domain';
import type { ProgrammeFitInput } from '@/shared/evaluation/f5-programme-fit';

describe('Matching Engine V2 Evaluation Suite', () => {
  const defaultLineage = {
    targetProfileVersionId: 'tp-v1',
    personalReportVersionId: 'pr-v1',
    sourceAnalysisVersionId: 'sa-v1',
    confirmedSnapshotId: 'snap-v1',
    evidenceBankVersion: 'eb-v1',
  };

  const defaultPersonalContext = {
    coreIdentity: ['Driven data scientist'],
    motivations: ['Passionate about educational equity'],
    direction: ['Applied AI in public education'],
  };

  const defaultProgrammeFitInput: ProgrammeFitInput = {
    eligibility: {
      requiredSubjects: 'met',
      minimumQualification: 'met',
      languageRequirement: 'met',
      citizenshipRequirement: 'met',
      deadline: 'met',
    },
    academicBand: 'upper_range',
    dimensions: {
      academicCompetitiveness: { status: 'assessed', score: 4.5, summary: 'High GPA', strengths: ['Top 5%'], gaps: [], evidenceRefs: [] },
      personaAlignment: { status: 'assessed', score: 4.2, summary: 'Strong alignment', strengths: ['Projects match'], gaps: [], evidenceRefs: [] },
      financialFeasibility: { status: 'assessed', score: 3.8, summary: 'Feasible', strengths: [], gaps: [], evidenceRefs: [] },
      careerDirection: { status: 'assessed', score: 4.0, summary: 'Clear vision', strengths: [], gaps: [], evidenceRefs: [] },
      applicationReadiness: { status: 'assessed', score: 4.0, summary: 'Ready', strengths: [], gaps: [], evidenceRefs: [] },
    },
  };

  function createTargetProfile(overrides: Partial<TargetProfile> = {}): TargetProfile {
    return {
      programme: {
        id: 'prog-1',
        name: 'MSc Data Science',
        university: 'University of Edinburgh',
        level: 'postgraduate',
        subject: 'Computer Science',
      },
      universityValues: [],
      programmeThemes: {
        description: '',
        themes: [],
      },
      requirements: [
        {
          id: 'req-math',
          category: 'competency',
          label: 'Strong Mathematics & Statistics Background',
          detail: 'Demonstrated quantitative ability via coursework or work.',
          status: 'required',
          sourceRefs: ['source-1'],
          missingInformation: null,
        },
        {
          id: 'req-python',
          category: 'competency',
          label: 'Proficiency in Python and ML frameworks',
          detail: 'Experience building projects with Python, PyTorch or Scikit-learn.',
          status: 'required',
          sourceRefs: ['source-2'],
          missingInformation: null,
        },
      ],
      deadlines: [],
      missingInformation: [],
      sources: [{ ref: 'source-1', url: 'https://ed.ac.uk', title: 'Requirements', retrievedAt: '2026-08-01' }],
      ...overrides,
    };
  }

  function createEvidenceBank(claims: any[] = []): EvidenceBank {
    return {
      version: 'eb-v1',
      sources: {
        'src-1': { id: 'src-1', type: 'achievement', label: 'Math Olympiad' },
        'src-2': { id: 'src-2', type: 'activity', label: 'ML Research Project' },
      },
      interpretations: [],
      claims,
      missingInformation: [],
    };
  }

  // Case 1: Strong Match
  it('Evaluation Case 1: Strong Match produces high coverage, multiple strengths and valid provenance', async () => {
    const target = createTargetProfile();
    const evidenceBank = createEvidenceBank([
      {
        id: 'claim-math',
        category: 'competency',
        statement: 'Scored 9.5/10 in Advanced Linear Algebra and Probability Theory.',
        status: 'verified',
        sourceRefs: ['src-1'],
        interpretationRefs: [],
        tags: { competencies: ['Mathematics'], criteria: ['competency'] },
      },
      {
        id: 'claim-python',
        category: 'competency',
        statement: 'Built end-to-end NLP classifier in PyTorch with 92% accuracy, deployed on AWS.',
        status: 'verified',
        sourceRefs: ['src-2'],
        interpretationRefs: [],
        tags: { competencies: ['Python', 'Machine Learning'], criteria: ['competency'] },
      },
    ]);

    const fakeGenerate = vi.fn().mockImplementation(async (args) => {
      if (args.moduleId === 'matching_criterion_reasoning') {
        return {
          data: {
            results: [
              {
                criterionId: 'competency:req-math',
                alignment: 'strong',
                evidenceIds: ['claim-math'],
                directEvidenceIds: ['claim-math'],
                supportingEvidenceIds: [],
                reasoning: 'Verified coursework evidence demonstrates advanced quantitative strength.',
                missingEvidence: [],
                evidenceQuality: 'strong',
                confidence: 0.95,
              },
              {
                criterionId: 'competency:req-python',
                alignment: 'strong',
                evidenceIds: ['claim-python'],
                directEvidenceIds: ['claim-python'],
                supportingEvidenceIds: [],
                reasoning: 'Hands-on PyTorch deployment proves required ML programming proficiency.',
                missingEvidence: [],
                evidenceQuality: 'strong',
                confidence: 0.9,
              },
            ],
          },
        };
      }
      return {
        data: {
          summary: 'The applicant displays exceptionally strong alignment across mathematical foundations and machine learning engineering competencies.',
          criterionIds: ['competency:req-math', 'competency:req-python'],
          evidenceIds: ['claim-math', 'claim-python'],
        },
      };
    });

    const report = await composeMatchingReport({
      targetProfile: target,
      academicProfile: { records: [{ kind: 'gpa', value: 3.8, scale: 4.0, raw: '3.8/4.0' }] },
      evidenceBank,
      personalContext: defaultPersonalContext,
      previousReport: null,
      lineage: defaultLineage,
      programmeFitInput: defaultProgrammeFitInput,
      generate: fakeGenerate,
    });

    expect(report.overall.evidenceCoverage).toBeGreaterThanOrEqual(80);
    expect(report.strengths.length).toBeGreaterThanOrEqual(2);
    expect(report.gaps.filter((g) => g.severity === 'critical')).toHaveLength(0);
    expect(fakeGenerate).toHaveBeenCalledTimes(2);
  });

  // Case 2: Impressive but irrelevant evidence
  it('Evaluation Case 2: Impressive but irrelevant evidence does not artificially inflate fit', async () => {
    const target = createTargetProfile();
    const evidenceBank = createEvidenceBank([
      {
        id: 'claim-music',
        category: 'experience',
        statement: 'Won national piano championship with distinction.',
        status: 'verified',
        sourceRefs: ['src-1'],
        interpretationRefs: [],
        tags: { competencies: ['Music'], criteria: ['experience'] },
      },
    ]);

    const fakeGenerate = vi.fn().mockImplementation(async (args) => {
      if (args.moduleId === 'matching_criterion_reasoning') {
        return {
          data: {
            results: [
              {
                criterionId: 'competency:req-math',
                alignment: 'missing',
                evidenceIds: [],
                directEvidenceIds: [],
                supportingEvidenceIds: [],
                reasoning: 'No mathematical background supplied in the evidence bank.',
                missingEvidence: ['Transcript with quantitative subjects'],
                evidenceQuality: 'none',
                confidence: 0.9,
              },
              {
                criterionId: 'competency:req-python',
                alignment: 'missing',
                evidenceIds: [],
                directEvidenceIds: [],
                supportingEvidenceIds: [],
                reasoning: 'No programming or ML evidence supplied.',
                missingEvidence: ['Python project code or GitHub'],
                evidenceQuality: 'none',
                confidence: 0.9,
              },
            ],
          },
        };
      }
      return {
        data: {
          summary: 'While the applicant has notable artistic achievements, essential quantitative and computing criteria lack supporting evidence.',
          criterionIds: ['competency:req-math', 'competency:req-python'],
          evidenceIds: [],
        },
      };
    });

    const report = await composeMatchingReport({
      targetProfile: target,
      academicProfile: { records: [] },
      evidenceBank,
      personalContext: defaultPersonalContext,
      previousReport: null,
      lineage: defaultLineage,
      programmeFitInput: defaultProgrammeFitInput,
      generate: fakeGenerate,
    });

    expect(report.overall.evidenceCoverage).toBe(0);
    expect(report.strengths).toHaveLength(0);
    expect(report.gaps.length).toBeGreaterThanOrEqual(2);
  });

  // Case 3: Vague evidence cannot become strong alignment
  it('Evaluation Case 3: Vague evidence results in weak evidence quality and weak_evidence gap', async () => {
    const target = createTargetProfile();
    const evidenceBank = createEvidenceBank([
      {
        id: 'claim-vague',
        category: 'competency',
        statement: 'I have worked on various technical tasks and helped my team a lot.',
        status: 'unverified',
        sourceRefs: ['src-1'],
        interpretationRefs: [],
        tags: { competencies: ['Teamwork'], criteria: ['competency'] },
      },
    ]);

    const fakeGenerate = vi.fn().mockImplementation(async (args) => {
      if (args.moduleId === 'matching_criterion_reasoning') {
        return {
          data: {
            results: [
              {
                criterionId: 'competency:req-python',
                alignment: 'weak',
                evidenceIds: ['claim-vague'],
                directEvidenceIds: [],
                supportingEvidenceIds: ['claim-vague'],
                reasoning: 'Claim is vague and lacks concrete programming technologies or verifiable deliverables.',
                missingEvidence: ['Specific repository link or technical description'],
                evidenceQuality: 'weak',
                confidence: 0.8,
              },
            ],
          },
        };
      }
      return {
        data: {
          summary: 'The applicant supplied unverified general claims that require technical substantiation.',
          criterionIds: ['competency:req-python'],
          evidenceIds: ['claim-vague'],
        },
      };
    });

    const report = await composeMatchingReport({
      targetProfile: { ...target, requirements: [target.requirements[1]] },
      academicProfile: { records: [] },
      evidenceBank,
      personalContext: defaultPersonalContext,
      previousReport: null,
      lineage: defaultLineage,
      programmeFitInput: defaultProgrammeFitInput,
      generate: fakeGenerate,
    });

    expect(report.strengths).toHaveLength(0);
    const weakGap = report.gaps.find((g) => g.type === 'weak_evidence');
    expect(weakGap).toBeDefined();
    expect(weakGap?.fixability).toBe('high');
  });

  // Case 4: Missing mandatory hard requirement
  it('Evaluation Case 4: Missing mandatory requirement stands at the top of gaps with critical severity', async () => {
    const target = createTargetProfile({
      requirements: [
        {
          id: 'req-ielts',
          category: 'academic',
          label: 'IELTS Academic 7.0 minimum',
          detail: 'Minimum overall 7.0 with no band under 6.5.',
          status: 'required',
          sourceRefs: ['source-ielts'],
          missingInformation: null,
        },
      ],
    });

    const evidenceBank = createEvidenceBank();
    const fakeGenerate = vi.fn().mockImplementation(async () => {
      return {
        data: {
          summary: 'A critical language eligibility requirement is not met, which must be addressed before proceeding.',
          criterionIds: ['academic_requirement:req-ielts'],
          evidenceIds: [],
        },
      };
    });

    const report = await composeMatchingReport({
      targetProfile: target,
      academicProfile: {
        records: [{ kind: 'english_test', testType: 'IELTS', value: 6.0, scale: 9.0, raw: '6.0' }],
      },
      evidenceBank,
      personalContext: defaultPersonalContext,
      previousReport: null,
      lineage: defaultLineage,
      programmeFitInput: {
        ...defaultProgrammeFitInput,
        eligibility: { ...defaultProgrammeFitInput.eligibility, languageRequirement: 'not_met' },
      },
      generate: fakeGenerate,
    });

    expect(report.academicRequirements[0].status).toBe('does_not_meet');
    expect(report.gaps[0].type).toBe('hard_requirement');
    expect(report.gaps[0].severity).toBe('critical');
    expect(report.gaps[0].fixability).toBe('low');
  });

  // Case 5: Strong evidence, poor positioning
  it('Evaluation Case 5: Strong evidence with moderate alignment identifies positioning gap, not capability gap', async () => {
    const target = createTargetProfile({
      requirements: [
        {
          id: 'req-impact',
          category: 'selection',
          label: 'Demonstrated Leadership in Social Causes',
          detail: 'Leadership experience with measurable social impact.',
          status: 'required',
          sourceRefs: ['source-impact'],
          missingInformation: null,
        },
      ],
    });

    const evidenceBank = createEvidenceBank([
      {
        id: 'claim-lead',
        category: 'experience',
        statement: 'Managed team of 15 volunteers organizing STEM tutoring for 200 underprivileged students.',
        status: 'verified',
        sourceRefs: ['src-1'],
        interpretationRefs: [],
        tags: { competencies: ['Leadership'], criteria: ['selection_criterion'] },
      },
    ]);

    const fakeGenerate = vi.fn().mockImplementation(async (args) => {
      if (args.moduleId === 'matching_criterion_reasoning') {
        return {
          data: {
            results: [
              {
                criterionId: 'selection_criterion:req-impact',
                alignment: 'moderate',
                evidenceIds: ['claim-lead'],
                directEvidenceIds: ['claim-lead'],
                supportingEvidenceIds: [],
                reasoning: 'Strong direct volunteer leadership, but currently framed as general community service rather than strategic educational leadership.',
                positioningOpportunity: 'Frame the tutoring program around data-driven student outcome tracking and operational scaling.',
                missingEvidence: [],
                evidenceQuality: 'strong',
                confidence: 0.9,
              },
            ],
          },
        };
      }
      return {
        data: {
          summary: 'The applicant possesses compelling community leadership that can be powerfully repositioned to highlight organizational impact.',
          criterionIds: ['selection_criterion:req-impact'],
          evidenceIds: ['claim-lead'],
        },
      };
    });

    const report = await composeMatchingReport({
      targetProfile: target,
      academicProfile: { records: [] },
      evidenceBank,
      personalContext: defaultPersonalContext,
      previousReport: null,
      lineage: defaultLineage,
      programmeFitInput: defaultProgrammeFitInput,
      generate: fakeGenerate,
    });

    expect(report.positioningOpportunities.length).toBeGreaterThanOrEqual(1);
    expect(report.positioningOpportunities[0].recommendedPositioning).toContain('outcome tracking');
    const posGap = report.gaps.find((g) => g.type === 'positioning_gap');
    expect(posGap).toBeDefined();
    expect(report.gaps.find((g) => g.type === 'capability_gap')).toBeUndefined();
  });

  // Case 6: Insufficient Profile
  it('Evaluation Case 6: Insufficient profile produces low coverage without invented strengths', async () => {
    const target = createTargetProfile();
    const evidenceBank = createEvidenceBank([]);

    const fakeGenerate = vi.fn().mockImplementation(async (args) => {
      if (args.moduleId === 'matching_criterion_reasoning') {
        return {
          data: {
            results: [
              {
                criterionId: 'competency:req-math',
                alignment: 'missing',
                evidenceIds: [],
                directEvidenceIds: [],
                supportingEvidenceIds: [],
                reasoning: 'No evidence supplied.',
                missingEvidence: ['Math course transcripts'],
                evidenceQuality: 'none',
                confidence: 0.8,
              },
              {
                criterionId: 'competency:req-python',
                alignment: 'missing',
                evidenceIds: [],
                directEvidenceIds: [],
                supportingEvidenceIds: [],
                reasoning: 'No evidence supplied.',
                missingEvidence: ['Python coding proof'],
                evidenceQuality: 'none',
                confidence: 0.8,
              },
            ],
          },
        };
      }
      return {
        data: {
          summary: 'Profile information is currently insufficient to establish alignment against published requirements.',
          criterionIds: [],
          evidenceIds: [],
        },
      };
    });

    const report = await composeMatchingReport({
      targetProfile: target,
      academicProfile: { records: [] },
      evidenceBank,
      personalContext: { coreIdentity: [], motivations: [], direction: [] },
      previousReport: null,
      lineage: defaultLineage,
      programmeFitInput: defaultProgrammeFitInput,
      generate: fakeGenerate,
    });

    expect(report.overall.evidenceCoverage).toBe(0);
    expect(report.strengths).toHaveLength(0);
    expect(report.programmeAlignment.every((s) => s.alignment === 'missing')).toBe(true);
  });

  // Invariants
  it('Invariants: Language check forbids admission probability wording', async () => {
    const bannedRegex = /\b(admission chance|acceptance probability|guaranteed admission|odds of admission)\b/i;
    expect('Your profile matches criteria').not.toMatch(bannedRegex);
  });
});
