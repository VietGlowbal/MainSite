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
function advanceTo(key: string) {
  const target = ABOUT_QUESTIONS.findIndex((q) => q.key === key);
  for (let i = 0; i < target; i += 1) {
    fireEvent.click(screen.getByRole('button', { name: /Tiếp theo|^Next$/ }));
  }
}

describe('Reflection field localization', () => {
  it('switches question headings without changing entered values', async () => {
    render(
      <LanguageProvider>
        <Controls />
        <ReflectionAboutForm initial={{ majors: ['Computer Science'], countries: ['Japan'] }} />
      </LanguageProvider>,
    );

    // One question per screen, so only the education question is here — and
    // it is option cards now, not a labelled select.
    await waitFor(() => {
      expect(screen.getByText('Trình độ học vấn cao nhất của bạn là gì?')).toBeInTheDocument();
    });

    // Choose an option, then switch language: the choice must survive.
    const doctorate = screen.getByRole('radio', { name: /Bằng tiến sĩ|Doctorate/ });
    fireEvent.click(doctorate);
    expect(doctorate).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'EN' }));

    await waitFor(() => {
      expect(screen.getByText('What is your highest level of education?')).toBeInTheDocument();
    });
    expect(screen.getByRole('radio', { name: /Doctorate/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('keeps a prefilled multi-select answer selected, in either language', async () => {
    render(
      <LanguageProvider>
        <Controls />
        {/* Countries are ISO codes now; the grid labels them from
            Intl.DisplayNames, so the visible name changes with the language
            while the answer does not. */}
        <ReflectionAboutForm initial={{ majors: ['computer-science'], countries: ['JP'] }} />
      </LanguageProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Trình độ học vấn cao nhất của bạn là gì?')).toBeInTheDocument();
    });

    advanceTo('countries');

    // The label is localised (Nhật Bản / Japan) but the stored id is not, so
    // the tick must survive the switch even though the words change.
    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: /Nhật Bản|Japan/ })).toBeChecked();
    });

    fireEvent.click(screen.getByRole('button', { name: 'EN' }));

    await waitFor(() => {
      // Specifically the heading: the grid's fieldset legend carries the same
      // words as its accessible group name, which is correct but ambiguous
      // to a bare text query.
      expect(
        screen.getByRole('heading', { name: 'Which countries are you interested in?' }),
      ).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: 'Japan' })).toBeChecked();
    });
  });

  it('offers both display modes and keeps answers across a switch', async () => {
    render(
      <LanguageProvider>
        <Controls />
        <ReflectionAboutForm initial={{ majors: [], countries: [] }} />
      </LanguageProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Trình độ học vấn cao nhất của bạn là gì?')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('radio', { name: /Bằng tiến sĩ|Doctorate/ }));

    // Show-all renders every question through the same components, so the
    // answer is still a checked radio rather than a downgraded text field.
    fireEvent.click(screen.getByRole('radio', { name: /Hiển thị tất cả|Show all questions/ }));

    await waitFor(() => {
      expect(screen.getAllByRole('radio', { name: /Bằng tiến sĩ|Doctorate/ })[0]).toHaveAttribute(
        'aria-checked',
        'true',
      );
    });
  });
});
