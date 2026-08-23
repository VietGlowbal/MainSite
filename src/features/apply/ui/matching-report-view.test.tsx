import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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
});
