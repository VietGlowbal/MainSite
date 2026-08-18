import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApplicationScholarships,
  type ApplicationScholarship,
} from './application-scholarships';

/**
 * The scholarship drawer on an application row.
 *
 * The cases here are the two that a plain "it renders" test would miss, and
 * both come from live data (measured 18/08):
 *
 *  - a student's chosen award is frequently NOT among the directory's options
 *    for the university it was saved under (39 of 84 saved rows). Building the
 *    drawer from `options` alone would drop their own choice;
 *  - several awards can be chosen for one university, so the picker ticks a set
 *    rather than selecting one.
 */

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh, prefetch: vi.fn(), push: vi.fn() }),
}));

/**
 * The browser Supabase client, which the component imports dynamically at write
 * time. Recorded rather than stubbed away: what these writes say is the whole
 * contract with `user_scholarships`, and getting the delete's filters wrong
 * would silently clear a student's awards at OTHER universities.
 */
type WriteResult = Promise<{ error: { message: string } | null }>;

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  // Signatures are declared rather than inferred: `vi.fn(() => …)` types itself
  // as taking no arguments, and `npm run build` type-checks test files too.
  upsert: vi.fn<(rows: unknown, options: unknown) => WriteResult>(),
  del: vi.fn(),
  eq: vi.fn(),
  in: vi.fn<(column: string, values: unknown) => WriteResult>(),
}));

vi.mock('@/lib/supabase/client', () => {
  const chain = {
    delete: () => {
      mocks.del();
      return chain;
    },
    eq: (column: string, value: unknown) => {
      mocks.eq(column, value);
      return chain;
    },
    in: (column: string, values: unknown) => mocks.in(column, values),
    upsert: (rows: unknown, options: unknown) => mocks.upsert(rows, options),
  };
  return {
    createClient: () => ({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: 'user-1' } } }) },
      from: () => chain,
    }),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.upsert.mockResolvedValue({ error: null });
  mocks.in.mockResolvedValue({ error: null });
});

const chevening: ApplicationScholarship = {
  id: 1,
  name: 'Chevening Scholarship at University College London (UCL) 2026',
  scope: 'country',
  amountLabel: '£30,000',
  deadlineLabel: '5 Nov 2026',
  coverage: 'Covers 100% of tuition plus a living stipend',
  fundingType: ['full-ride'],
  sourceUrl: 'https://example.org/chevening',
};

const globalExcellence: ApplicationScholarship = {
  id: 2,
  name: 'UCL Global Excellence Award',
  scope: 'university',
  amountLabel: '£5,000',
  deadlineLabel: null,
  coverage: null,
  fundingType: ['merit'],
  sourceUrl: null,
};

describe('ApplicationScholarships', () => {
  it('shows the chosen awards, their count and the best stated coverage', () => {
    render(
      <ApplicationScholarships
        universityId={7}
        universityName="University College London (UCL)"
        chosen={[chevening, globalExcellence]}
        options={[chevening, globalExcellence]}
      />,
    );

    // The name is printed without the university the row above already names.
    expect(screen.getByTitle(chevening.name)).toHaveTextContent('Chevening Scholarship');
    expect(screen.getByText('£30,000')).toBeInTheDocument();
    expect(screen.getByText('UCL Global Excellence Award')).toBeInTheDocument();

    // Count and coverage are split from their labels so both halves are
    // separately translatable — assert the label, not a joined sentence.
    expect(screen.getByText('chosen')).toBeInTheDocument();
    expect(screen.getByText('Covers up to')).toBeInTheDocument();
  });

  it('keeps a chosen award the directory no longer links to that university', () => {
    render(
      <ApplicationScholarships
        universityId={7}
        universityName="University College London (UCL)"
        chosen={[chevening]}
        options={[globalExcellence]}
      />,
    );

    expect(screen.getByTitle(chevening.name)).toBeInTheDocument();

    // …and it is ticked in the picker, alongside the one that is still linked.
    fireEvent.click(screen.getByRole('button', { name: /change scholarships/i }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByLabelText(`Choose ${chevening.name}`)).toBeChecked();
    expect(within(dialog).getByLabelText(`Choose ${globalExcellence.name}`)).not.toBeChecked();
  });

  it('invites a choice, and counts what is available, when nothing is chosen', () => {
    render(
      <ApplicationScholarships
        universityId={7}
        universityName="University College London (UCL)"
        chosen={[]}
        options={[chevening, globalExcellence]}
      />,
    );

    expect(screen.getByText('Nothing chosen yet')).toBeInTheDocument();
    expect(screen.getByText('available at this university')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /choose scholarships/i })).toBeInTheDocument();
  });

  it('removes one award without touching the same student’s awards elsewhere', async () => {
    render(
      <ApplicationScholarships
        universityId={7}
        universityName="University College London (UCL)"
        chosen={[chevening, globalExcellence]}
        options={[chevening, globalExcellence]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: `Remove ${chevening.name}` }));

    await waitFor(() => expect(mocks.in).toHaveBeenCalledWith('scholarship_id', [chevening.id]));
    // Scoped to this student AND this university — a delete filtered by
    // scholarship id alone would drop the award from another university too.
    expect(mocks.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(mocks.eq).toHaveBeenCalledWith('university_id', 7);
    expect(mocks.upsert).not.toHaveBeenCalled();
    // Gone from the drawer straight away, before the server round trip lands.
    expect(screen.queryByTitle(chevening.name)).not.toBeInTheDocument();
  });

  it('saves a newly ticked award against this university', async () => {
    render(
      <ApplicationScholarships
        universityId={7}
        universityName="University College London (UCL)"
        chosen={[chevening]}
        options={[chevening, globalExcellence]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /change scholarships/i }));
    fireEvent.click(screen.getByLabelText(`Choose ${globalExcellence.name}`));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(mocks.upsert).toHaveBeenCalledWith(
        [{ user_id: 'user-1', scholarship_id: globalExcellence.id, university_id: 7 }],
        { onConflict: 'user_id,scholarship_id' },
      ),
    );
    expect(mocks.del).not.toHaveBeenCalled();
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
  });

  it('does not delete the old award when adding the new one failed', async () => {
    mocks.upsert.mockResolvedValueOnce({ error: { message: 'insert failed' } });

    render(
      <ApplicationScholarships
        universityId={7}
        universityName="University College London (UCL)"
        chosen={[chevening]}
        options={[chevening, globalExcellence]}
      />,
    );

    // Swap one award for the other in a single Save.
    fireEvent.click(screen.getByRole('button', { name: /change scholarships/i }));
    fireEvent.click(screen.getByLabelText(`Choose ${globalExcellence.name}`));
    fireEvent.click(screen.getByLabelText(`Choose ${chevening.name}`));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.getAllByRole('alert').length).toBeGreaterThan(0));
    // The half that failed must not take the other half with it: without the
    // early exit, the student would be left with neither award.
    expect(mocks.del).not.toHaveBeenCalled();
    // …and the drawer still shows what the database still holds. Asserted via
    // its ticket's Remove control: the dialog stays open on failure, so the
    // name itself now appears both there and on the ticket.
    expect(
      screen.getByRole('button', { name: `Remove ${chevening.name}` }),
    ).toBeInTheDocument();
  });

  it('says so plainly when the university has no scholarships listed', () => {
    render(
      <ApplicationScholarships
        universityId={7}
        universityName="University College London (UCL)"
        chosen={[]}
        options={[]}
      />,
    );

    expect(
      screen.getByText('No scholarships are listed for this university yet.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /choose scholarships/i })).not.toBeInTheDocument();
  });
});
