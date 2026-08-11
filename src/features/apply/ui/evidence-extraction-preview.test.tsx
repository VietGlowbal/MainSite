import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EvidenceExtractionPreview } from './evidence-extraction-preview';

const candidates = [
  {
    candidateId: 'a-1',
    kind: 'achievement' as const,
    confidence: 'high' as const,
    data: { category: 'competition' as const, title: 'First Prize', year: 2025 },
    sourceRefs: [
      {
        documentId: '11111111-1111-4111-8111-111111111111',
        page: 1,
        quote: 'FIRST PRIZE 2025',
      },
    ],
  },
  {
    candidateId: 'activity-1',
    kind: 'activity' as const,
    confidence: 'medium' as const,
    data: { category: 'mentoring' as const, title: 'Coding Tutor' },
    sourceRefs: [
      {
        documentId: '11111111-1111-4111-8111-111111111111',
        page: 2,
        quote: 'Volunteer Coding Tutor',
      },
    ],
  },
];

describe('EvidenceExtractionPreview', () => {
  it('shows unpdf coverage and applies only selected candidates', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    render(
      <EvidenceExtractionPreview
        result={{
          documents: [
            {
              documentId: '11111111-1111-4111-8111-111111111111',
              fileName: 'profile.pdf',
              totalPages: 2,
              pagesReadable: 2,
              pagesNeedingOcr: [],
              charactersExtracted: 120,
              coverage: 1,
            },
          ],
          candidates,
          rejectedCount: 0,
          ocrRequired: false,
          partial: false,
          ocrProvider: 'not_configured',
        }}
        onApply={onApply}
        onDismiss={() => undefined}
      />,
    );

    expect(screen.getByText('profile.pdf').parentElement).toHaveTextContent(
      'unpdf read 2/2 pages',
    );
    await user.click(screen.getByRole('checkbox', { name: /Coding Tutor/i }));
    await user.click(screen.getByRole('button', { name: /Add 1 selected item/i }));

    expect(onApply).toHaveBeenCalledWith([candidates[0]]);
  });
});
