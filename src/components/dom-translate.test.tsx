import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DomTranslator } from '@/lib/dom-translate';
import { LanguageProvider, useLanguage } from '@/lib/i18n';
import { AutoTranslate } from '@/lib/use-auto-translate';
import { StrategyHome } from '@/features/ai-strategy-dashboard/ui/strategy-home';

vi.mock('next/navigation', () => ({ usePathname: () => '/about' }));

function LanguageControls() {
  const { setLang } = useLanguage();
  return (
    <>
      <button type="button" onClick={() => setLang('vi')}>VI</button>
      <button type="button" onClick={() => setLang('en')}>EN</button>
    </>
  );
}

describe('DomTranslator', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = 'en';
    vi.restoreAllMocks();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('does not apply a stale Vietnamese response after switching to English', async () => {
    let resolveFetch!: (response: { ok: true; json: () => Promise<unknown> }) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise((resolve) => { resolveFetch = resolve; })));

    render(
      <LanguageProvider>
        <LanguageControls />
        <main className="glowbal-main-content">Slow untranslated interface copy</main>
        <DomTranslator />
      </LanguageProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'VI' }));
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());

    fireEvent.click(screen.getByRole('button', { name: 'EN' }));
    expect(screen.getByText('Slow untranslated interface copy')).toBeInTheDocument();

    await act(async () => {
      resolveFetch({
        ok: true,
        json: async () => ({ translations: ['Bản dịch tiếng Việt đến muộn'] }),
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Slow untranslated interface copy')).toBeInTheDocument();
    });
  });

  it('still switches back after an explicit translator has shown Vietnamese for a while', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ translations: ['Nội dung học bổng đã dịch'] }),
    })));

    render(
      <LanguageProvider>
        <LanguageControls />
        <main className="glowbal-main-content" data-no-auto-translate>
          <AutoTranslate text="Scholarship copy that completed before switching" />
        </main>
        <DomTranslator />
      </LanguageProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'VI' }));
    await waitFor(() => expect(screen.getByText('Nội dung học bổng đã dịch')).toBeInTheDocument());

    await new Promise((resolve) => setTimeout(resolve, 200));
    fireEvent.click(screen.getByRole('button', { name: 'EN' }));

    await waitFor(() => {
      expect(screen.getByText('Scholarship copy that completed before switching')).toBeInTheDocument();
    });
  });

  it('switches Strategy Home back to English after Vietnamese has settled', async () => {
    const { container } = render(
      <LanguageProvider>
        <LanguageControls />
        <main className="glowbal-main-content">
          <StrategyHome
            courseName="Computer Science"
            universityName="University"
            startHref="#start"
          />
        </main>
        <DomTranslator />
      </LanguageProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'VI' }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Xây dựng lộ trình cá nhân hóa để vào đại học.' })).toBeInTheDocument();
    });

    await new Promise((resolve) => setTimeout(resolve, 200));
    fireEvent.click(screen.getByRole('button', { name: 'EN' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Build your personalised roadmap into university.' })).toBeInTheDocument();
    });
    expect(container.querySelector('[data-no-auto-translate]')).toBeInTheDocument();
  });
});
