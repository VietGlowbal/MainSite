import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MatchingReportPageData } from '../domain';
import type { MatchingReportV3 } from '@/lib/ai/matching/domain';
import { MatchingReportView } from './matching-report-view';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const assessed = {
  status: 'assessed' as const,
  score: 3,
  summary: 'Có dữ liệu để đánh giá.',
  strengths: [],
  gaps: [],
  evidence: [],
};

const data: MatchingReportPageData = {
  id: 'application-1',
  universityName: 'Example University',
  courseName: 'BSc Data Science',
  country: 'United Kingdom',
  degreeLevel: 'Bachelor',
  deadline: null,
  universityId: 1,
  courseUrl: 'https://example.edu/course',
  studyMode: 'Full-time',
  intake: 'September 2027',
  status: 'planning',
  analysis: {
    createdAt: '2026-07-31T00:00:00.000Z',
    promptVersion: 'match-insights-v2-vi',
    inputHash: 'hash',
    strengths: [],
    weaknesses: [],
    fit: {
      classification: 'match',
      confidence: 61,
      limitations: ['Thiếu học phí đã xác minh.'],
      eligibility: {
        requiredSubjects: 'met',
        minimumQualification: 'met',
        languageRequirement: 'unknown',
        citizenshipRequirement: 'unknown',
        deadline: 'unknown',
      },
      dimensions: {
        academicCompetitiveness: assessed,
        personaAlignment: assessed,
        financialFeasibility: {
          status: 'not_available',
          score: null,
          summary: 'Chưa có dữ liệu học phí.',
          strengths: [],
          gaps: [],
          evidence: [],
          limitation: 'Không thể đánh giá khả năng chi trả.',
        },
        careerDirection: assessed,
        applicationReadiness: assessed,
      },
    },
  },
  course: {
    summary: null,
    duration: null,
    tuition: null,
    entryRequirements: null,
    englishRequirements: null,
    sourceConfidence: null,
    lastExtractedAt: null,
  },
  university: null,
  scholarships: [],
};

function renderReport(override?: Partial<MatchingReportPageData>) {
  return render(<MatchingReportView data={{ ...data, ...override }} migrationMissing={false} />);
}

const V3_SUBMETRICS = {
  academicReadiness: ['academicPreparation', 'curriculumReadiness', 'academicEvidence', 'academicRequirements'],
  valuesAlignment: ['missionValues', 'educationalPhilosophy', 'communityValues', 'personalPositioning'],
  communityContribution: ['contributionEvidence', 'socialProof', 'collaboration', 'communityOpportunity'],
  learningEnvironment: ['teachingModel', 'experientialLearning', 'classStructure', 'environmentPreference'],
  distinctiveOpportunity: ['namedOpportunity', 'opportunityFit', 'accessPath', 'distinctiveness'],
  interestMotivation: ['statedInterest', 'motivationGrounding', 'themeAlignment', 'subjectExploration'],
  capability: ['targetCompetencies', 'academicCapability', 'demonstratedSkills', 'capabilityEvidence'],
  experienceExposure: ['relevantExperience', 'meaningfulEngagement', 'reflectionDepth', 'exposureRange'],
  careerFutureDirection: ['futureDirection', 'pathwayAlignment', 'opportunityUse', 'directionEvidence'],
} as const;

function v3Metric(id: string, score: number | null = 80, status: 'assessed' | 'limited' | 'not_available' = 'assessed') {
  return {
    id,
    score,
    status,
    confidence: score === null ? 0 : 0.8,
    coverage: score === null ? 0 : 100,
    summary: `${id} summary`,
    submetrics: V3_SUBMETRICS[id as keyof typeof V3_SUBMETRICS].map((submetricId) => ({
      metricId: id,
      submetricId,
      status,
      score,
      confidence: score === null ? 0 : 0.8,
      reasoning: score === null ? 'More evidence is needed.' : 'The supplied evidence supports this alignment.',
      applicantEvidenceIds: score === null ? [] : ['claim-1'],
      targetSourceRefs: ['source-1'],
      missingEvidence: score === null ? ['Add a concrete example.'] : [],
      limitations: [],
    })),
  } as MatchingReportV3['universityFit']['metrics']['academicReadiness'];
}

const V3_REPORT: MatchingReportV3 = {
  contractVersion: 'matching-report-v3',
  generatedAt: '2026-08-28T00:00:00.000Z',
  overall: {
    summary: 'Grounded alignment summary.',
    overallAlignmentScore: 80,
    evidenceCoverage: 88,
    confidence: 0.8,
    strongestAlignment: ['academicReadiness'],
    criticalGaps: ['gap:capability'],
    summaryEvidenceIds: ['claim-1'],
    summaryTargetSourceRefs: ['source-1'],
  },
  universityFit: {
    score: 80,
    status: 'assessed',
    confidence: 0.8,
    coverage: 100,
    summary: 'University alignment summary.',
    metrics: {
      academicReadiness: v3Metric('academicReadiness'),
      valuesAlignment: v3Metric('valuesAlignment'),
      communityContribution: v3Metric('communityContribution'),
      learningEnvironment: v3Metric('learningEnvironment', null, 'not_available'),
      distinctiveOpportunity: v3Metric('distinctiveOpportunity'),
    },
  },
  programmeFit: {
    score: 80,
    status: 'limited',
    confidence: 0.8,
    coverage: 88,
    summary: 'Programme alignment summary.',
    metrics: {
      interestMotivation: v3Metric('interestMotivation'),
      capability: v3Metric('capability', 55, 'limited'),
      experienceExposure: v3Metric('experienceExposure'),
      careerFutureDirection: v3Metric('careerFutureDirection'),
    },
    strongestAlignment: ['interestMotivation'],
    potentialGap: 'Capability evidence is limited.',
    strategicInterpretation: 'Position the project evidence around the programme direction.',
  },
  hardRequirements: [{
    id: 'language-1',
    kind: 'language',
    label: 'English language',
    status: 'not_met',
    applicantValue: null,
    requiredValue: 'IELTS 6.5',
    explanation: 'An English test result is still needed.',
    evidenceIds: [],
    targetSourceRefs: ['source-1'],
  }],
  scholarshipAlignment: null,
  strengths: [{ id: 'strength:academicReadiness', title: 'Academic readiness', description: 'Strong academic evidence.', evidenceIds: ['claim-1'], targetSourceRefs: ['source-1'] }],
  gaps: [{ id: 'gap:capability', title: 'Capability gap', description: 'Capability evidence is limited.', evidenceIds: ['claim-1'], targetSourceRefs: ['source-1'] }],
  positioningOpportunities: [{ id: 'positioning:academicReadiness', title: 'Use academic readiness', description: 'Use the cited academic evidence.', evidenceIds: ['claim-1'], targetSourceRefs: ['source-1'] }],
  keyTakeaways: {
    strongestFit: { title: 'Strongest fit', body: 'Academic readiness is the strongest fit.', evidenceIds: ['claim-1'], targetSourceRefs: ['source-1'], metricIds: ['academicReadiness'] },
    competitiveAdvantage: { title: 'Competitive advantage', body: 'The project is supported by verified evidence.', evidenceIds: ['claim-1'], targetSourceRefs: ['source-1'], metricIds: ['capability'] },
    criticalGap: { title: 'Critical gap', body: 'Language evidence is still required.', evidenceIds: [], targetSourceRefs: ['source-1'], metricIds: ['capability'] },
    strategicDirection: { title: 'Strategic direction', body: 'Use the strongest fit carefully.', evidenceIds: ['claim-1'], targetSourceRefs: ['source-1'], metricIds: ['academicReadiness'] },
  },
  evidenceIndex: [{ id: 'claim-1', label: 'Verified project', statement: 'The applicant completed a project.', kind: 'applicant', status: 'verified', sourceRefs: ['raw-1'], direct: true }],
  targetSourceIndex: [{ ref: 'source-1', label: 'Programme page', title: 'Programme page', url: 'https://example.edu/programme', kind: 'programme' }],
  metadata: {
    matchingEngineVersion: 'matching-v3.0.0',
    promptVersion: 'matching-prompts-v3.0.0',
    metricPromptVersion: 'matching-metric-v3.0.0',
    summaryPromptVersion: 'matching-summary-v3.0.0',
    formulaVersion: 'matching-formula-v3.0.0',
    model: 'test-model',
    targetProfileVersionId: 'target-1',
    targetProfileSchemaVersion: 'tp-v1',
    personalReportVersionId: 'personal-1',
    personalReportInputHash: 'personal-hash',
    sourceAnalysisVersionId: 'analysis-1',
    confirmedSnapshotId: 'snapshot-1',
    evidenceBankVersion: 'eb-v1',
    selectedScholarshipKey: null,
    selectedScholarshipVersionId: null,
    reusedMetricIds: [],
    metricInputHashes: {},
    aiCallCount: { metricBatches: 2, providerCalls: 3, summary: 1 },
  },
};

describe('MatchingReportView', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders all six sections', () => {
    renderReport();

    for (const heading of [
      'Overall match',
      'Why you match',
      'Entry requirements',
      'Gaps and risks',
      'How this reads to an admissions reader',
      'What to do next',
    ]) {
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    }
  });

  it('renders legacy analyses that do not carry a report_v2 payload', () => {
    renderReport();

    expect(screen.getByRole('heading', { name: 'Overall match' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'What to do next' })).toBeInTheDocument();
  });

  it('renders the canonical nextRegenerationAt cooldown field', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({
          error: 'Try again later',
          nextRegenerationAt: '2026-08-28T12:00:00.000Z',
        }),
      }),
    );
    renderReport();

    fireEvent.click(screen.getByRole('button', { name: 'Update report' }));

    await waitFor(() => expect(screen.getByText(/Next free generation/)).toBeInTheDocument());
  });

  it('names every one of the five dimensions', () => {
    renderReport();

    for (const label of [
      'Academic fit',
      'Programme and values fit',
      'Career vision fit',
      'Financial feasibility',
      'Application readiness',
    ]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it('shows an unassessed dimension as not assessed, never as 0%', () => {
    renderReport();

    // Financial feasibility is not_available in the fixture. It must not be
    // rendered as a score — "not assessed" and 0% mean opposite things.
    expect(screen.getAllByText('Not assessed').length).toBeGreaterThan(0);
    expect(screen.getByText('Không thể đánh giá khả năng chi trả.')).toBeInTheDocument();
  });

  it('states that the match score is not a prediction of admission', () => {
    renderReport();

    expect(
      screen.getByText(/It is not a prediction of whether you will be admitted/i),
    ).toBeInTheDocument();
  });

  it('never presents the score as a chance, odds or probability of admission', () => {
    const { container } = renderReport();

    expect(container.textContent).not.toMatch(
      /xác suất|admission probability|chance of (being )?admi|odds of/i,
    );
  });

  it('surfaces an unmet requirement as blocking, above the scored dimensions', () => {
    renderReport({
      analysis: {
        ...data.analysis!,
        fit: {
          ...data.analysis!.fit,
          classification: 'currently_ineligible',
          eligibility: { ...data.analysis!.fit.eligibility, languageRequirement: 'not_met' },
        },
      },
    });

    expect(screen.getByText('These requirements are not met yet')).toBeInTheDocument();
    expect(
      screen.getByText(/Fixing these matters more than raising any score below/i),
    ).toBeInTheDocument();
  });

  it('does not imply an unknown requirement was failed', () => {
    renderReport();

    expect(screen.getAllByText('We could not check this').length).toBeGreaterThan(0);
    expect(screen.queryByText('Not met')).not.toBeInTheDocument();
  });

  it('offers the Strategy Report as the next step', () => {
    renderReport();

    expect(screen.getByRole('link', { name: 'Open my Strategy Report' })).toHaveAttribute(
      'href',
      '/ai-strategy/application-1/strategy-report',
    );
  });

  it('renders V2 report when present, with separated missing evidence and scholarship', () => {
    const v2Data = {
      ...data,
      analysis: {
        ...data.analysis,
        reportV2: {
          contractVersion: 'matching-report-v2',
          overall: { fitScore: 90, fitLabel: 'strong_current_alignment', summary: '', summaryCriterionIds: [], summaryEvidenceIds: [], strongestAlignment: [], mostImportantGaps: [], evidenceCoverage: 90 },
          academicRequirements: [
            { criterionId: 'hard1', status: 'does_not_meet', explanation: 'Missing GPA', applicantValue: null, requiredValue: null, evidenceIds: [] }
          ],
          strengths: [ { id: 's1', title: 'Strong Math', description: '', whyItMatters: 'Math', criterionIds: [], evidenceIds: [], strength: 'high', positioningUse: null } ],
          gaps: [
            { id: 'g1', type: 'capability_gap', title: 'Real Gap', whyItMatters: 'Gap', description: '', criterionIds: [], currentEvidenceIds: [], severity: 'critical', fixability: 'low', evidenceNeeded: [], priority: 1 },
            { id: 'g2', type: 'missing_evidence', title: 'Missing Proof', whyItMatters: 'Proof', description: '', criterionIds: [], currentEvidenceIds: [], severity: 'medium', fixability: 'high', evidenceNeeded: [], priority: 2 }
          ],
          criteria: [],
          programmeAlignment: [],
          positioningOpportunities: [],
          scholarshipAlignment: { criteria: [], strengths: [], gaps: [] },
          metadata: {} as any,
          programmeFit: {} as any,
          dependencyIndex: {}
        }
      }
    } as any;

    render(<MatchingReportView data={v2Data} migrationMissing={false} />);
    
    // It should render V2 headings
    expect(screen.getByText('Critical Requirements')).toBeDefined();
    expect(screen.getAllByText('Strongest Alignment Areas').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Important Gaps').length).toBeGreaterThan(0);
    expect(screen.getByText('Programme Criteria Breakdown')).toBeDefined();
    expect(screen.getByText('Positioning Opportunities')).toBeDefined();
    expect(screen.getByText('Scholarship Alignment')).toBeDefined();
    expect(screen.getByText('Evidence that improves assessment')).toBeDefined();
  });

  it('renders the canonical V3 fits, takeaways, hard requirements and provenance', () => {
    renderReport({ analysis: { ...data.analysis!, reportV2: null, reportV3: V3_REPORT } });

    for (const label of ['University Fit', 'Programme Fit', 'Academic Readiness', 'Values Alignment', 'Community & Contribution', 'Learning Environment', 'Distinctive Opportunity', 'Interest & Motivation', 'Capability', 'Experience & Exposure', 'Career & Future Direction']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    for (const label of ['Strongest fit', 'Competitive advantage', 'Critical gap', 'Strategic direction', 'Strongest alignment', 'Potential gap', 'Strategic interpretation']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(screen.getByText('English language')).toBeInTheDocument();
    expect(screen.getAllByText(/Programme page/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Verified project/).length).toBeGreaterThan(0);
    expect(screen.getByText(/scholarship alignment was not assessed/i)).toBeInTheDocument();
    expect(screen.getByText(/Overall evidence coverage/)).toBeInTheDocument();
    expect(screen.getAllByText('Not assessed').length).toBeGreaterThan(0);
    expect(screen.getByText(/do not predict admission decisions/i)).toBeInTheDocument();
    expect(screen.queryByText(/^0%$/)).not.toBeInTheDocument();
  });
});



