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

describe('CvReviewFeedback', () => {
  afterEach(() => vi.useRealTimers());

  it('shows an animated thinking state before the first section arrives', () => {
    render(<CvReviewFeedback events={[]} analysis={null} streaming />);

    expect(screen.getByText('Đang suy luận…')).toBeVisible();
    expect(
      screen.queryByText('Kết quả đánh giá CV sẽ xuất hiện tại đây.'),
    ).not.toBeInTheDocument();
  });

  it('uses Vietnamese labels for the strategic review', async () => {
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

    expect(screen.getByText('A. CV có đúng hướng ngành học không?')).toBeVisible();
    expect(screen.queryByText('A. Programme Alignment')).not.toBeInTheDocument();
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

    expect(screen.queryByText('B. Người đọc hiểu bạn là ai không?')).not.toBeInTheDocument();
    expect(screen.queryByText('E. CV có gọn trong một trang không?')).not.toBeInTheDocument();

    for (let index = 0; index < allStrategicEvents.length; index += 1) {
      await act(async () => {
        await vi.runAllTimersAsync();
      });
    }

    expect(screen.getByText('E. CV có gọn trong một trang không?')).toBeVisible();
  });

  it('reveals one section and one content item at a time', async () => {
    vi.useFakeTimers();
    render(<CvReviewFeedback events={events} analysis={null} streaming />);

    expect(
      screen.queryByRole('heading', { name: '1. CV hiện đang thể hiện điều gì?' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: '2. Kiểm tra 5 tiêu chí quan trọng' }),
    ).not.toBeInTheDocument();

    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      vi.advanceTimersByTime(10);
    });

    expect(
      screen.getByRole('heading', { name: '1. CV hiện đang thể hiện điều gì?' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('heading', { name: '2. Kiểm tra 5 tiêu chí quan trọng' }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByTestId('typing-text')[0].textContent?.length).toBeGreaterThan(0);
  });
});
