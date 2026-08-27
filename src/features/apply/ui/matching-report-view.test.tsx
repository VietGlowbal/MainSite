import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MatchingReportPageData } from '../domain';
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
    expect(screen.getByText('Strongest Alignment Areas')).toBeDefined();
    expect(screen.getByText('Important Gaps')).toBeDefined();
    expect(screen.getByText('Programme Criteria Breakdown')).toBeDefined();
    expect(screen.getByText('Positioning Opportunities')).toBeDefined();
    expect(screen.getByText('Scholarship Alignment')).toBeDefined();
    expect(screen.getByText('Evidence That Would Improve This Assessment')).toBeDefined();
  });
});



