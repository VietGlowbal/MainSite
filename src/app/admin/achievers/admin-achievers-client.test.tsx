import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminAchieversClient } from './admin-achievers-client';

vi.mock('@/shared/ui/loading-overlay', () => ({ useLoadingIndicator: vi.fn() }));

const application = {
  id: '11111111-1111-4111-8111-111111111111',
  display_name: 'Advisor Applicant',
  subject: 'Economics',
  degree_level: 'masters',
  bio: 'A sufficiently detailed advisor biography.',
  help_topics: ['Essays'],
  languages: ['English'],
  session_price_vnd: 500000,
  session_duration_mins: 60,
  status: 'pending' as const,
  created_at: '2026-08-27T00:00:00.000Z',
  quick_signup: false,
  university: { id: 1, name: 'Example University', country: 'GB' },
};

describe('AdminAchieversClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('moves an application out of pending only after the server saves the decision', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: true,
          application: { id: application.id, status: 'approved', verified_at: 'now' },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(<AdminAchieversClient applications={[application]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

    await waitFor(() => expect(screen.getByText('Pending (0)')).toBeInTheDocument());
    expect(screen.getByText('Processed')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/admin/achievers/${application.id}`,
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ status: 'approved' }),
      }),
    );
  });

  it('keeps the application pending and shows the server error when saving fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ error: 'Database update failed' }), {
          status: 500,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );

    render(<AdminAchieversClient applications={[application]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Database update failed');
    expect(screen.getByText('Pending (1)')).toBeInTheDocument();
    expect(screen.queryByText('Processed')).not.toBeInTheDocument();
  });
});
