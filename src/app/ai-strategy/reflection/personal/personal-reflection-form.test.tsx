import { fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PERSONAL_REFLECTION_QUESTIONS } from '@/features/apply/domain';
import { LanguageProvider } from '@/lib/i18n';
import { LanguageSwitcher } from '@/shared/ui/language-switcher';
import { PersonalReflectionForm } from './personal-reflection-form';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/ai-strategy/reflection/personal',
}));

describe('PersonalReflectionForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
  });

  it('renders all 7 questions simultaneously with guidance, sample answers, and initial values', () => {
    render(
      <PersonalReflectionForm
        initial={{
          q1: 'Answer 1',
          q2: '',
          q3: '',
          q4: '',
          q5: '',
        }}
      />,
    );

    for (const q of PERSONAL_REFLECTION_QUESTIONS) {
      expect(screen.getByText(q.heading)).toBeInTheDocument();
      expect(screen.getByText(q.shortLabel)).toBeInTheDocument();
      expect(screen.getByText(q.sampleAnswer)).toBeInTheDocument();
    }

    const textareas = screen.getAllByRole('textbox');
    expect(textareas).toHaveLength(7);
    expect(textareas[0]).toHaveValue('Answer 1');
    expect(screen.getByText('1 of 7 answered')).toBeInTheDocument();
  });

  it('switches the dictionary-backed reflection copy back to English', () => {
    render(
      <LanguageProvider defaultLang="vi">
        <LanguageSwitcher />
        <PersonalReflectionForm initial={{}} />
      </LanguageProvider>,
    );

    expect(screen.getByText('Điều bạn thích khám phá')).toBeInTheDocument();
    expect(screen.getAllByText('Câu trả lời mẫu')).toHaveLength(7);

    fireEvent.click(screen.getByRole('link', { name: 'Chuyển sang Tiếng Anh' }));

    expect(screen.getByText('What You Enjoy Exploring')).toBeInTheDocument();
    expect(screen.getAllByText('Sample answer')).toHaveLength(7);
  });

  it('debounces autosave by 1000ms upon typing', async () => {
    render(
      <PersonalReflectionForm
        initial={{
          q1: '',
          q2: '',
          q3: '',
          q4: '',
          q5: '',
        }}
      />,
    );

    const textareas = screen.getAllByRole('textbox');
    fireEvent.change(textareas[1], { target: { value: 'Curiosity about algorithms' } });

    expect(screen.getAllByText('Saving…').length).toBeGreaterThan(0);
    expect(global.fetch).not.toHaveBeenCalled();

    // Fast-forward 500ms -> still not called
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(global.fetch).not.toHaveBeenCalled();

    // Fast-forward another 550ms -> called
    act(() => {
      vi.advanceTimersByTime(550);
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/reflection/personal',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          answers: {
            q1: '',
            q2: 'Curiosity about algorithms',
            q3: '',
            q4: '',
            q5: '',
          },
        }),
      }),
    );
  });

  it('triggers immediate save on blur', async () => {
    render(
      <PersonalReflectionForm
        initial={{
          q1: '',
          q2: '',
          q3: '',
          q4: '',
          q5: '',
        }}
      />,
    );

    const textareas = screen.getAllByRole('textbox');
    fireEvent.change(textareas[0], { target: { value: 'New insight on blur' } });
    fireEvent.blur(textareas[0]);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/reflection/personal',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          answers: {
            q1: 'New insight on blur',
            q2: '',
            q3: '',
            q4: '',
            q5: '',
          },
        }),
      }),
    );
  });

  it('ignores stale responses from out-of-order network requests', async () => {
    let resolveFirst!: (value: unknown) => void;
    let resolveSecond!: (value: unknown) => void;

    (global.fetch as unknown as ReturnType<typeof vi.fn>)
      .mockImplementationOnce(
        () =>
          new Promise((res) => {
            resolveFirst = res;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((res) => {
            resolveSecond = res;
          }),
      );

    render(
      <PersonalReflectionForm
        initial={{
          q1: '',
          q2: '',
          q3: '',
          q4: '',
          q5: '',
        }}
      />,
    );

    const textareas = screen.getAllByRole('textbox');

    // First edit
    fireEvent.change(textareas[0], { target: { value: 'Draft 1' } });
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Second edit
    fireEvent.change(textareas[0], { target: { value: 'Draft 2' } });
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Resolve second request first
    await act(async () => {
      resolveSecond({ ok: true, json: async () => ({}) });
    });

    expect(screen.getByText('Saved')).toBeInTheDocument();

    // Now resolve first request with error (stale request)
    await act(async () => {
      resolveFirst({ ok: false, json: async () => ({ message: 'Stale error' }) });
    });

    // Save status should not turn into error or overwrite local text
    expect(textareas[0]).toHaveValue('Draft 2');
    expect(screen.queryByText('Stale error')).not.toBeInTheDocument();
  });

  it('keeps local text and displays retry button when save fails', async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: 'Server error saving answers' }),
    });

    render(
      <PersonalReflectionForm
        initial={{
          q1: '',
          q2: '',
          q3: '',
          q4: '',
          q5: '',
        }}
      />,
    );

    const textareas = screen.getAllByRole('textbox');
    fireEvent.change(textareas[0], { target: { value: 'My precious answer' } });
    fireEvent.blur(textareas[0]);

    await waitFor(() => {
      expect(screen.getByText('Server error saving answers')).toBeInTheDocument();
    });

    expect(textareas[0]).toHaveValue('My precious answer');
    const retryBtn = screen.getByRole('button', { name: 'Try again' });
    expect(retryBtn).toBeInTheDocument();

    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText('Saved')).toBeInTheDocument();
    });
  });

  it('navigates to confirm on continue after saving', async () => {
    render(
      <PersonalReflectionForm
        applicationId="app-123"
        returnTo="/apply/app-123"
        initial={{
          q1: 'Val 1',
          q2: 'Val 2',
          q3: 'Val 3',
          q4: 'Val 4',
          q5: 'Val 5',
        }}
      />,
    );

    const continueBtn = screen.getByRole('button', { name: 'Continue to Review & Confirm' });
    fireEvent.click(continueBtn);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        `/ai-strategy/reflection/confirm?return=${encodeURIComponent('/apply/app-123')}`,
      );
    });
  });
});
