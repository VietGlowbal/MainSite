import { useEffect } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReflectionAboutForm } from '@/app/ai-strategy/reflection/reflection-about-form';
import { LanguageProvider, useLanguage } from '@/lib/i18n';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

function Controls() {
  const { setLang } = useLanguage();
  useEffect(() => setLang('vi'), [setLang]);
  return <button type="button" onClick={() => setLang('en')}>EN</button>;
}

describe('Reflection field localization', () => {
  it('switches field labels and placeholders without changing entered values', async () => {
    const { container } = render(
      <LanguageProvider>
        <Controls />
        <ReflectionAboutForm initial={{ majors: ['Computer Science'], countries: ['Japan'] }} />
      </LanguageProvider>,
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Trình độ học vấn cao nhất của bạn là gì?')).toBeInTheDocument();
      expect(screen.getByLabelText('Bạn quan tâm đến những quốc gia nào?')).toHaveValue('Japan');
    });
    expect(container.querySelector('[data-no-auto-translate]')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'EN' }));

    await waitFor(() => {
      expect(screen.getByLabelText('What is your highest level of education?')).toBeInTheDocument();
      expect(screen.getByLabelText('Which countries are you interested in?')).toHaveValue('Japan');
    });
  });
});
