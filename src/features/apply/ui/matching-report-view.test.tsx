import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MatchingReportNarrative, MatchingReportPageData } from '../domain';
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

const NARRATIVE: MatchingReportNarrative = {
  fitStatement: 'Hồ sơ ở mức phù hợp vừa phải vì còn thiếu học phí đã xác minh.',
  topAlignments: [
    { aspect: 'Nền tảng toán học', evidence: 'GPA 3.8', interpretation: 'Đáp ứng yêu cầu đầu vào.' },
    { aspect: 'Kinh nghiệm dự án', evidence: 'Dự án dữ liệu cộng đồng', interpretation: 'Chứng minh kỹ năng thực hành.' },
  ],
  criticalGaps: [
    {
      gap: 'Thiếu chứng chỉ IELTS',
      evidence: 'Không có điểm tiếng Anh trong hồ sơ',
      whyItMatters: 'Chương trình yêu cầu IELTS 6.5',
      impactLevel: 4,
      suggestedDirection: 'Đăng ký thi trong 2 tháng tới',
    },
  ],
  competitiveGaps: ['Thiếu hoạt động lãnh đạo'],
  hiddenRisks: ['Hồ sơ hơi phân tán giữa nhiều lĩnh vực'],
  admissionsPerspective: {
    firstImpression: 'Ứng viên tiềm năng nhưng chưa hoàn thiện chứng chỉ.',
    strengthens: ['Điểm toán mạnh'],
    questions: ['Vì sao chọn ngành này?'],
    desiredAdditions: ['Thư giới thiệu từ giáo viên toán'],
  },
  finalRecommendation: {
    conclusion: 'Nên hoàn thiện chứng chỉ trước hạn.',
    biggestStrength: 'Nền tảng học thuật',
    biggestOpportunity: 'Hoàn thiện IELTS sớm',
  },
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
    narrative: null,
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
  it('renders five dimensions and keeps unavailable values honest', () => {
    render(<MatchingReportView data={data} migrationMissing={false} />);

    expect(screen.getAllByText('Match').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Not assessed').length).toBeGreaterThan(0);
    expect(screen.getByText('Không thể đánh giá khả năng chi trả.')).toBeInTheDocument();
    // The match score must never read as an admission probability.
    expect(
      screen.getByText(/It is not an admission probability or acceptance chance/i),
    ).toBeInTheDocument();
  });

  it('renders all six canonical sections with the semantic narrative', () => {
    render(
      <MatchingReportView
        data={{ ...data, analysis: { ...data.analysis!, narrative: NARRATIVE } }}
        migrationMissing={false}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Overall Match Summary' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Fit breakdown and why you match' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Hard criteria assessment' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Gap and risk analysis' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Admissions perspective' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Final recommendation' })).toBeInTheDocument();

    // Narrative content flows into its sections (raw data is rendered verbatim).
    expect(screen.getByText(NARRATIVE.fitStatement!)).toBeInTheDocument();
    expect(screen.getByText('Thiếu chứng chỉ IELTS')).toBeInTheDocument();
    expect(screen.getByText(NARRATIVE.admissionsPerspective!.firstImpression)).toBeInTheDocument();

    // CTA preserves application context.
    const cta = screen.getByRole('link', { name: 'Continue to the Strategy Report' });
    expect(cta).toHaveAttribute('href', `/ai-strategy/${data.id}/strategy-report`);
  });

  it('degrades gracefully when the narrative is absent (pre-migration rows)', () => {
    render(<MatchingReportView data={data} migrationMissing={false} />);

    // Deterministic sections still render; narrative-only blocks do not.
    expect(screen.queryByRole('heading', { name: 'Admissions perspective' })).not.toBeInTheDocument();
    expect(
      screen.getByText('Regenerate the report with a complete profile for a personalised recommendation.'),
    ).toBeInTheDocument();
  });

  it('labels a failed hard gate and unknown gates honestly', () => {
    const ineligible = {
      ...data,
      analysis: {
        ...data.analysis!,
        fit: {
          ...data.analysis!.fit,
          classification: 'currently_ineligible' as const,
          eligibility: {
            requiredSubjects: 'not_met' as const,
            minimumQualification: 'met' as const,
            languageRequirement: 'unknown' as const,
            citizenshipRequirement: 'unknown' as const,
            deadline: 'unknown' as const,
          },
        },
      },
    };
    render(<MatchingReportView data={ineligible} migrationMissing={false} />);

    expect(screen.getAllByText('Currently ineligible').length).toBeGreaterThan(0);
    expect(screen.getByText('Not met')).toBeInTheDocument();
    expect(screen.getAllByText('Not verified').length).toBeGreaterThan(0);
  });
});
