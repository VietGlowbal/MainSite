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

describe('MatchingReportView', () => {
  it('renders five dimensions and keeps unavailable values as N/A', () => {
    render(<MatchingReportView data={data} migrationMissing={false} />);

    expect(screen.getByText('Match')).toBeInTheDocument();
    expect(screen.getByText('N/A')).toBeInTheDocument();
    expect(screen.getByText('Không thể đánh giá khả năng chi trả.')).toBeInTheDocument();
    expect(screen.queryByText(/xác suất|admission probability/i)).not.toBeInTheDocument();
  });
});
