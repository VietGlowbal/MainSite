import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CvReviewWorkspace } from './CvReviewWorkspace';

const summary = {
  type: 'section',
  section: 'summary',
  data: {
    communicationReadiness: 'CV truyền tải khá rõ nhưng còn dài.',
    programmeAlignment: 'Nội dung đã hướng tới Computer Science.',
    firstImpression: 'Ứng viên có định hướng kỹ thuật nhất quán.',
    biggestStrengths: [{ text: 'Experience có kết quả cụ thể.', evidenceIds: ['C001'] }],
    biggestWeaknesses: [{ text: 'Education thiếu coursework.', evidenceIds: ['C001'] }],
    priorities: [
      { text: 'Rút gọn phần giới thiệu.', evidenceIds: ['C001'] },
      { text: 'Bổ sung coursework.', evidenceIds: ['C001'] },
      { text: 'Chuẩn hóa Experience.', evidenceIds: ['C001'] },
    ],
  },
};

describe('CvReviewWorkspace', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('submits pasted CV text and progressively renders streamed feedback', async () => {
    const responseText = `${JSON.stringify(summary)}\n${JSON.stringify({
      type: 'complete',
      analysis: { overallScore: 7, detectedSections: [] },
      timing: { firstSectionMs: 800, totalMs: 9000 },
    })}\n`;
    const fetchMock = vi.fn(async () =>
      new Response(responseText, {
        headers: { 'Content-Type': 'application/x-ndjson' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    render(
      <CvReviewWorkspace
        applicationId="app-1"
        targetName="BSc Computer Science · VinUniversity"
        contextNote="Strong mathematics"
      />,
    );

    await userEvent.type(
      screen.getByPlaceholderText('Dán nội dung CV tại đây'),
      'EDUCATION\nComputer Science\nEXPERIENCE\nBuilt a robotics programme for thirty students.',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Phân tích CV' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/applications/app-1/cv-review',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );
    expect(
      await screen.findByRole('heading', {
        name: '1. CV hiện đang thể hiện điều gì?',
      }),
    ).toBeVisible();
    expect(screen.getByText('7/10')).toBeVisible();
  });

  it('aborts the active request before starting another analysis', async () => {
    let firstSignal: AbortSignal | undefined;
    const fetchMock = vi
      .fn()
      .mockImplementationOnce((_url, init) => {
        firstSignal = init?.signal;
        return new Promise<Response>(() => {});
      })
      .mockResolvedValueOnce(new Response(`${JSON.stringify(summary)}\n`));
    vi.stubGlobal('fetch', fetchMock);
    render(
      <CvReviewWorkspace
        applicationId="app-1"
        targetName="Computer Science"
      />,
    );
    const input = screen.getByPlaceholderText('Dán nội dung CV tại đây');
    await userEvent.type(input, 'A'.repeat(90));
    await userEvent.click(screen.getByRole('button', { name: 'Phân tích CV' }));
    await userEvent.click(screen.getByRole('button', { name: 'Phân tích lại' }));

    expect(firstSignal?.aborted).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
