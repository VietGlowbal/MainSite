import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SavedListSection, type SavedRow } from './saved-list-section';

/**
 * The saved list keeps a local copy of its rows so a removal can be optimistic.
 * That copy has to follow the server, and for a long time it did not: every
 * `router.refresh()` on /apply — attaching an award here, planning an
 * application, or (since 18/08) changing scholarships in the tracker's drawer
 * above — hands this component fresh rows, but a refresh preserves client
 * state, so the list went on rendering what it was mounted with.
 */

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

function row(overrides: Partial<SavedRow> = {}): SavedRow {
  return {
    id: 1,
    universityId: 7,
    name: 'University College London (UCL)',
    country: 'United Kingdom',
    type: null,
    qsRank: null,
    theRank: null,
    deadline: null,
    summary: null,
    imageUrl: null,
    logoUrl: null,
    website: null,
    tuition: '—',
    tuitionRaw: null,
    program: 'Law',
    programUrl: null,
    attached: [],
    options: [],
    ...overrides,
  };
}

describe('SavedListSection', () => {
  it('re-reads its rows when the server sends new ones', () => {
    const attached = [{ savedId: 5, id: 42, name: 'Chevening Scholarship', amountLabel: '£30,000' }];

    const { rerender } = render(
      <SavedListSection rows={[row()]} onPlan={vi.fn()} onGoToApplications={vi.fn()} isPlus />,
    );
    expect(screen.queryByText('Chevening Scholarship')).not.toBeInTheDocument();

    // What a `router.refresh()` after attaching an award produces: same page,
    // same mounted component, a new array from the server.
    rerender(
      <SavedListSection
        rows={[row({ attached })]}
        onPlan={vi.fn()}
        onGoToApplications={vi.fn()}
        isPlus
      />,
    );

    expect(screen.getByText('Chevening Scholarship')).toBeInTheDocument();
  });
});
