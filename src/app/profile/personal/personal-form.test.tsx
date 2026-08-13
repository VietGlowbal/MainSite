import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PersonalForm } from './personal-form';

const mocks = vi.hoisted(() => ({
  updateUser: vi.fn().mockResolvedValue({ error: null }),
  upsert: vi.fn().mockResolvedValue({ error: null }),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { updateUser: mocks.updateUser },
    from: () => ({ upsert: mocks.upsert }),
  }),
}));

vi.mock('@/shared/ui/loading-overlay', () => ({
  useLoadingIndicator: () => {},
}));

describe('PersonalForm account details', () => {
  beforeEach(() => vi.clearAllMocks());

  it('edits and saves the account name and email with the personal profile', async () => {
    render(
      <PersonalForm
        userId="user-1"
        displayName="Old Name"
        email="old@example.com"
        initialProfile={null}
      />,
    );

    const name = screen.getByLabelText(/Full name/);
    const email = screen.getByLabelText(/Email address/);
    expect(name).not.toHaveAttribute('readonly');
    expect(email).not.toHaveAttribute('readonly');

    fireEvent.change(name, { target: { value: 'New Name' } });
    fireEvent.change(email, { target: { value: 'new@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(mocks.updateUser).toHaveBeenCalledWith({
        email: 'new@example.com',
        data: { full_name: 'New Name' },
      }),
    );
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1' }),
      { onConflict: 'user_id' },
    );
    expect(await screen.findByText(/check your inbox/i)).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(mocks.upsert).toHaveBeenCalledTimes(2));
    expect(mocks.updateUser).toHaveBeenCalledTimes(1);
  });
});
