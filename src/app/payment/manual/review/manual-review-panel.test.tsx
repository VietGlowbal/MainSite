import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ManualReviewPanel } from './manual-review-panel';

describe('ManualReviewPanel', () => {
  it('shows the student identity and immutable product summary before confirmation', () => {
    render(
      <ManualReviewPanel
        token="review.1.signature"
        review={{
          state: 'claimed',
          transaction: {
            reference: 'GLOWMANUALABC123',
            amount_vnd: 125000,
            product_type: 'mentorship',
            status: 'pending',
            expires_at: '2026-08-16T12:00:00.000Z',
            recipient_name: 'Student Name',
            recipient_email: 'student@example.test',
            summary: 'Advisor mentorship session',
          },
        }}
      />,
    );

    expect(screen.getByText('Student Name')).toBeInTheDocument();
    expect(screen.getByText('student@example.test')).toBeInTheDocument();
    expect(screen.getByText('Advisor mentorship session')).toBeInTheDocument();
  });
});
