import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider, useLanguage } from '@/lib/i18n';
import { LanguageSwitcher } from './language-switcher';

const route = { pathname: '/' };

vi.mock('next/navigation', () => ({ usePathname: () => route.pathname }));
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: ReactNode; href: string }) => <a href={href} {...props}>{children}</a>,
}));

function LocaleProbe() {
  return <span>{useLanguage().lang}</span>;
}

afterEach(() => localStorage.removeItem('glowbal-language'));

describe('LanguageSwitcher', () => {
  it('maps each public route to the opposite locale', () => {
    const { rerender } = render(
      <LanguageProvider defaultLang="en"><LanguageSwitcher /></LanguageProvider>,
    );

    expect(screen.getByRole('link')).toHaveAttribute('href', '/vi');

    route.pathname = '/vi';
    rerender(<LanguageProvider defaultLang="vi"><LanguageSwitcher /></LanguageProvider>);

    expect(screen.getByRole('link')).toHaveAttribute('href', '/');
  });

  it('honours an explicit route locale over a saved language', () => {
    localStorage.setItem('glowbal-language', 'vi');

    render(<LanguageProvider defaultLang="en"><LocaleProbe /></LanguageProvider>);

    expect(screen.getByText('en')).toBeInTheDocument();
  });
});
