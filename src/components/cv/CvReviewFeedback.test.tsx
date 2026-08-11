import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CvReviewSectionEvent } from '@/lib/ai/cv-review';
import { CvReviewFeedback } from './CvReviewFeedback';

const bullet = (text: string) => ({ text, evidenceIds: ['C001'] });
const events: CvReviewSectionEvent[] = [
  {
    type: 'section',
    section: 'summary',
    data: {
      communicationReadiness: 'CV truyền tải khá rõ nhưng còn dài.',
      programmeAlignment: 'Nội dung đã hướng tới Computer Science.',
      firstImpression: 'Ứng viên có định hướng kỹ thuật nhất quán.',
      biggestStrengths: [bullet('Experience có hành động và kết quả cụ thể.')],
      biggestWeaknesses: [bullet('Education thiếu coursework liên quan.')],
      priorities: [
        bullet('Rút gọn phần giới thiệu.'),
        bullet('Bổ sung coursework phù hợp.'),
        bullet('Chuẩn hóa các bullet Experience.'),
      ],
    },
  },
  {
    type: 'section',
    section: 'strategic',
    criterion: 'programme_alignment',
    data: {
      score: 7,
      strengths: [bullet('Kinh nghiệm kỹ thuật phù hợp chương trình.')],
      weaknesses: [bullet('Chưa nêu rõ định hướng học thuật.')],
    },
  },
];

const strategicCriteria = [
  'programme_alignment',
  'story_positioning',
  'evidence_quality',
  'content_prioritization',
  'one_page_efficiency',
] as const;

const allStrategicEvents: CvReviewSectionEvent[] = strategicCriteria.map(
  (criterion, index) => ({
    type: 'section',
    section: 'strategic',
    criterion,
    data: {
      score: 7 + (index % 2),
      strengths: [bullet(`Điểm mạnh ${index + 1}.`)],
      weaknesses: [bullet(`Điểm cần sửa ${index + 1}.`)],
    },
  }),
);

const experienceSection: CvReviewSectionEvent = {
  type: 'section',
  section: 'cv_section',
  sectionKey: 'experience',
  sectionName: 'Experience',
  data: {
    score: 6,
    strengths: [bullet('Có kinh nghiệm phù hợp.')],
    improvements: [bullet('Cần nêu rõ kết quả.')],
    missingOpportunities: [],
    recommendations: [bullet('Thêm một số liệu cụ thể.')],
  },
};

describe('CvReviewFeedback', () => {
  afterEach(() => vi.useRealTimers());

  it('shows an animated thinking state before the first section arrives', () => {
    render(<CvReviewFeedback events={[]} analysis={null} streaming />);

    expect(screen.getByText('Reasoning…')).toBeVisible();
    expect(
      screen.queryByText('Your CV review will appear here.'),
    ).not.toBeInTheDocument();
  });

  it('uses the default English labels for the strategic review', async () => {
    vi.useFakeTimers();
    render(
      <CvReviewFeedback
        events={[allStrategicEvents[0]]}
        analysis={null}
        streaming
      />,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20);
    });

    expect(screen.getByText('A. Is your CV aligned with the course?')).toBeVisible();
  });

  it('shows score rings and section bars from streamed review data', () => {
    vi.useFakeTimers();
    render(
      <CvReviewFeedback
        events={[...allStrategicEvents, experienceSection]}
        analysis={null}
        streaming
      />,
    );

    expect(screen.getByTestId('cv-score-dashboard')).toBeVisible();
    expect(
      screen.getByRole('img', { name: 'Overall score: 7.4/10, Fair' }),
    ).toBeVisible();
    expect(
      screen.getByRole('img', { name: 'Aligned direction: 7/10, Fair' }),
    ).toBeVisible();
    expect(
      screen.getByRole('img', { name: 'Experience: 6/10' }),
    ).toBeVisible();
  });

  it('shows the score gap to a strong CV target', () => {
    render(
      <CvReviewFeedback
        events={allStrategicEvents}
        analysis={null}
        streaming
      />,
    );

    expect(screen.getByTestId('cv-readiness-gap')).toBeVisible();
    expect(
      screen.getByRole('img', {
        name: 'Aligned direction: currently 7/10, target 8/10, short by 1 points',
      }),
    ).toBeVisible();
  });

  it('does not mount later sections until the active section finishes typing', async () => {
    vi.useFakeTimers();
    render(
      <CvReviewFeedback
        events={allStrategicEvents}
        analysis={null}
        streaming
      />,
    );

    expect(screen.queryByText('B. Does the reader understand who you are?')).not.toBeInTheDocument();
    expect(screen.queryByText('E. Is the CV concise enough for one page?')).not.toBeInTheDocument();

    for (let index = 0; index < allStrategicEvents.length; index += 1) {
      await act(async () => {
        await vi.runAllTimersAsync();
      });
    }

    expect(screen.getByText('E. Is the CV concise enough for one page?')).toBeVisible();
  });

  it('reveals one section and one content item at a time', async () => {
    vi.useFakeTimers();
    render(<CvReviewFeedback events={events} analysis={null} streaming />);

    expect(
      screen.queryByRole('heading', { name: '1. What does the CV show right now?' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: '2. Check the five key criteria' }),
    ).not.toBeInTheDocument();

    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      vi.advanceTimersByTime(10);
    });

    expect(
      screen.getByRole('heading', { name: '1. What does the CV show right now?' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('heading', { name: '2. Check the five key criteria' }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByTestId('typing-text')[0].textContent?.length).toBeGreaterThan(0);
  });
});
