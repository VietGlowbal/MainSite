import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { AdminAiReportReview } from '@/features/ai-strategy-dashboard/api';
import { AdminAiReportReviewClient } from './admin-ai-report-review-client';

const review: AdminAiReportReview = {
  application: {
    applicationId: '11111111-1111-4111-8111-111111111111',
    courseName: 'Computer Science',
    universityName: 'Example University',
    subject: 'Engineering',
    lastGeneratedAt: '2026-09-12T00:00:00.000Z',
    availableReports: ['personal', 'matching', 'strategy'],
  },
  nodes: [
    { id: 'personal', kind: 'personal' as const, title: 'Personal Report', available: true, generatedAt: '2026-09-10T00:00:00.000Z', modelName: 'gpt-test', promptVersion: 'personal-v1', inputHash: 'personal-hash', sources: [{ label: 'Candidate snapshot', value: 'snapshot-1' }], output: { report: 'personal output' } },
    { id: 'matching', kind: 'matching' as const, title: 'Matching Report', available: true, generatedAt: '2026-09-11T00:00:00.000Z', modelName: 'gpt-test', promptVersion: 'matching-v1', inputHash: 'matching-hash', sources: [{ label: 'Personal Report version', value: 'personal-1' }], output: { report: 'matching output' } },
    { id: 'strategy', kind: 'strategy' as const, title: 'Strategy Report', available: true, generatedAt: '2026-09-12T00:00:00.000Z', modelName: 'gpt-test', promptVersion: 'strategy-v1', inputHash: 'strategy-hash', sources: [{ label: 'Matching Report', value: 'matching-1' }], output: { report: 'strategy output' } },
  ],
};

describe('AdminAiReportReviewClient', () => {
  it('shows the selected report output when an admin follows the graph', () => {
    render(<AdminAiReportReviewClient items={[review.application]} initialReview={review} />);

    expect(screen.getByText(/personal output/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View Matching Report' }));

    expect(screen.getByText(/matching output/)).toBeInTheDocument();
    expect(screen.getByText('matching-hash')).toBeInTheDocument();
  });
});
