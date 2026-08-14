import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DirectoryScholarship } from '@/lib/scholarships-data';
import { TID } from '@/shared/lib/testids';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
}));
vi.mock('next/dynamic', () => ({ default: () => () => null }));
vi.mock('@/lib/i18n', () => ({
  useLanguage: () => ({
    t: (value: string, vars?: Record<string, string | number>) =>
      vars ? value.replace('{count}', String(vars.count ?? '')) : value,
  }),
}));
vi.mock('@/lib/use-auto-translate', () => ({
  AutoTranslate: ({ text }: { text: string }) => <span>{text}</span>,
}));
vi.mock('@/lib/selection-cache', () => ({
  clearFocusUniversity: vi.fn(),
  getFocusUniversity: vi.fn(() => null),
  setFocusUniversity: vi.fn(),
}));
vi.mock('@/shared/hooks/use-directory-navigation', () => ({
  useDirectoryNavigation: ({ initialData }: { initialData: unknown }) => ({
    data: initialData,
    busy: false,
    error: null,
    navigate: vi.fn(),
  }),
}));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: vi.fn() },
    from: mocks.from,
  }),
}));

import { ScholarshipDirectoryClient } from './scholarship-directory-client';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function query(result: Promise<unknown>) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  Object.assign(builder, {
    select: chain,
    order: chain,
    limit: chain,
    in: chain,
    then: result.then.bind(result),
  });
  return builder;
}

function scholarship(
  id: number,
  universityIds: number[] = [],
  universities: DirectoryScholarship['universities'] = [],
): DirectoryScholarship {
  return {
    id,
    name: `Scholarship ${id}`,
    slug: null,
    scope: universityIds.length > 0 ? 'university' : 'provider',
    country: 'Canada',
    countryFlag: null,
    provider: 'Test Provider',
    funding_type: [],
    coverage: null,
    amount_min: null,
    amount_max: null,
    amount_currency: null,
    slots: null,
    slots_text: null,
    eligibility: null,
    applies_to_text: null,
    conditions: null,
    insight: null,
    deadline_date: null,
    deadline_text: null,
    source_url: null,
    source_lang: 'en',
    ranking_note: null,
    universities,
    universityIds,
    universityCountries: universities
      .map((university) => university.country)
      .filter((country): country is string => country != null),
    amountLabel: null,
    deadlineLabel: null,
    deadlineSortValue: Infinity,
  };
}

function renderDirectory(items: DirectoryScholarship[]) {
  const queryState = {
    search: '',
    universitySearch: '',
    major: 'all' as const,
    degree: 'all' as const,
    country: 'all',
    funding: [],
    sort: 'relevance' as const,
    page: 1,
    universityId: null,
    countryPage: 1,
    view: 'directory' as const,
  };
  render(
    <ScholarshipDirectoryClient
      queryState={queryState}
      directoryPage={{ items, total: items.length, page: 1, pageSize: 9, hasMore: false }}
      focusPage={null}
      countryPage={null}
      facets={{ countries: [], total: items.length }}
      savedUniversityIds={[]}
      savedCountries={[]}
      applications={[]}
      existingScholarships={[]}
      focusUniversity={null}
      savedScholarships={[]}
      canonicalSearch=""
    />,
  );
}

describe('ScholarshipDirectoryClient save picker coordination', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ignores university options returned by a picker request that was superseded', async () => {
    const user = userEvent.setup();
    const first = deferred<{ data: Array<{ id: number; name: string; country: string }>; error: null }>();
    const second = deferred<{ data: Array<{ id: number; name: string; country: string }>; error: null }>();
    mocks.from
      .mockImplementationOnce(() => query(first.promise))
      .mockImplementationOnce(() => query(second.promise));
    renderDirectory([scholarship(1), scholarship(2)]);

    const saveButtons = screen.getAllByRole('button', { name: 'Save to My Universities' });
    await user.click(saveButtons[0]!);
    await waitFor(() => expect(mocks.from).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.click(saveButtons[1]!);
    await waitFor(() => expect(mocks.from).toHaveBeenCalledTimes(2));

    await act(async () => {
      first.resolve({ data: [{ id: 10, name: 'Stale University', country: 'Canada' }], error: null });
      await first.promise;
    });
    expect(screen.queryByText('Stale University')).not.toBeInTheDocument();
    expect(screen.getByText('Loading universities...')).toBeInTheDocument();

    await act(async () => {
      second.resolve({ data: [{ id: 20, name: 'Current University', country: 'Canada' }], error: null });
      await second.promise;
    });
    expect(await screen.findByText('Current University')).toBeInTheDocument();
  });

  it('replaces the scholarship detail dialog before opening the university picker', async () => {
    const user = userEvent.setup();
    const universities = [
      { id: 10, name: 'Alpha University', country: 'Canada', logo_url: null },
      { id: 20, name: 'Beta University', country: 'Canada', logo_url: null },
    ];
    renderDirectory([scholarship(1, [10, 20], universities)]);

    await user.click(screen.getByTestId(TID.scholarshipCard));
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
    await user.click(screen.getByText('Save to My Universities'));

    expect(screen.getByTestId(TID.scholarshipUniversityPicker)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByTestId(TID.scholarshipUniversityPicker)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
  });
});
