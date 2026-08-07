import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EnglishForm } from '@/app/profile/english/english-form';
import { PreferencesForm } from '@/app/profile/preferences/preferences-form';

const mocks = vi.hoisted(() => {
  const terminalEq = vi.fn().mockResolvedValue({ error: null });
  const firstEq = vi.fn(() => ({ eq: terminalEq }));
  const update = vi.fn(() => ({ eq: firstEq }));
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const from = vi.fn(() => ({ update, upsert }));
  return { firstEq, from, terminalEq, update, upsert };
});

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ from: mocks.from }),
}));

vi.mock('@/shared/ui/loading-overlay', () => ({
  useLoadingIndicator: () => {},
}));

describe('profile editors for onboarding answers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('preserves an unknown support answer and saves an onboarding-compatible choice', async () => {
    render(
      <PreferencesForm
        userId="user-1"
        initialProfile={{ support_needs: 'Legacy tailored help' }}
      />,
    );

    const support = screen.getByLabelText('Where you want support most');
    expect(support).toHaveValue('Legacy tailored help');

    fireEvent.change(support, { target: { value: 'Scholarships and funding' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save preferences' }));

    await waitFor(() =>
      expect(mocks.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          support_needs: 'Scholarships and funding',
        }),
        { onConflict: 'user_id' },
      ),
    );
  });

  it('updates both English and standardized test rows', async () => {
    render(
      <EnglishForm
        userId="user-1"
        initialEnglishScores={[
          {
            id: 'english-1',
            user_id: 'user-1',
            test_type: 'IELTS Academic',
            overall_score: 7.5,
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
          },
        ]}
        initialStandardizedScores={[
          {
            id: 'standardized-1',
            user_id: 'user-1',
            test_type: 'SAT',
            score: '1450',
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
          },
        ]}
      />,
    );

    expect(screen.getByLabelText('Overall score')).toHaveValue(7.5);
    expect(screen.getByLabelText('Total score')).toHaveValue('1450');

    fireEvent.click(screen.getByRole('button', { name: 'Save test scores' }));

    expect(await screen.findByText('Saved successfully.')).toBeVisible();
    expect(mocks.from).toHaveBeenCalledWith('english_test_scores');
    expect(mocks.from).toHaveBeenCalledWith('standardized_test_scores');
    expect(mocks.update).toHaveBeenCalledTimes(2);
  });
});
