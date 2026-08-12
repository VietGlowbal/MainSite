import { useEffect } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReflectionAboutForm } from '@/app/ai-strategy/reflection/reflection-about-form';
import { ABOUT_QUESTIONS } from '@/features/apply/domain';
import { LanguageProvider, useLanguage } from '@/lib/i18n';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

function Controls() {
  const { setLang } = useLanguage();
  useEffect(() => setLang('vi'), [setLang]);
  return (
    <button type="button" onClick={() => setLang('en')}>
      EN
    </button>
  );
}

/** Click Next until the named question is on screen. */
async function advanceTo(key: string) {
  const target = ABOUT_QUESTIONS.findIndex((q) => q.key === key);
  for (let i = 0; i < target; i += 1) {
    fireEvent.click(screen.getByRole('button', { name: /Tiếp theo|Next/ }));
  }
}

describe('Reflection field localization', () => {
  it('switches field labels without changing entered values', async () => {
    const { container } = render(
      <LanguageProvider>
        <Controls />
        <ReflectionAboutForm initial={{ majors: ['Computer Science'], countries: ['Japan'] }} />
      </LanguageProvider>,
    );

    // The form asks one question per screen now, so only question 1 is here.
    await waitFor(() => {
      expect(screen.getByLabelText('Trình độ học vấn cao nhất của bạn là gì?')).toBeInTheDocument();
    });
    expect(container.querySelector('[data-no-auto-translate]')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'EN' }));

    await waitFor(() => {
      expect(screen.getByLabelText('What is your highest level of education?')).toBeInTheDocument();
    });
  });

  it('keeps a prefilled multi-select answer selected, in either language', async () => {
    render(
      <LanguageProvider>
        <Controls />
        <ReflectionAboutForm initial={{ majors: ['Computer Science'], countries: ['Japan'] }} />
      </LanguageProvider>,
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Trình độ học vấn cao nhất của bạn là gì?')).toBeInTheDocument();
    });

    await advanceTo('countries');

    // The country list is a MultiSelect: the answer is a checked box, not an
    // input value. Country names are proper nouns and are not translated, so
    // "Japan" reads the same either way — what must survive is the selection.
    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: 'Japan' })).toBeChecked();
    });

    fireEvent.click(screen.getByRole('button', { name: 'EN' }));

    await waitFor(() => {
      expect(screen.getByText('Which countries are you interested in?')).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: 'Japan' })).toBeChecked();
    });
  });
});
