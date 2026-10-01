import { useEffect, type ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StrategyHome } from '@/features/ai-strategy-dashboard/ui/strategy-home';
import { StateBlock } from '@/features/application-strategy/ui/states';
import { LanguageProvider, T, useLanguage } from '@/lib/i18n';
import { StartCard } from '@/components/cv/CvStartFlow';
import { HomeJourney } from '@/features/marketing/ui/home-journey';
import { HomePartners } from '@/features/marketing/ui/home-partners';
import { loadCatalog } from '@/lib/i18n-catalog-runtime';
import { TopNav } from '@/shared/ui/top-nav';

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
vi.mock('@/shared/ui/use-nav-reveal', () => ({
  useNavReveal: () => ({ ref: { current: null }, top: 0, isFloating: false, isHidden: false }),
}));
vi.stubGlobal(
  'IntersectionObserver',
  class {
    observe() {}
    disconnect() {}
  },
);

function Vietnamese({ children }: { children: ReactNode }) {
  const { setLang } = useLanguage();
  useEffect(() => setLang('vi'), [setLang]);
  return <>{children}</>;
}

describe('Vietnamese screenshot copy', () => {
  it('localizes the CV start cards without translating user or school data', async () => {
    render(
      <LanguageProvider>
        <Vietnamese>
          <div>
            <T k="Where would you like to start?" />
            <StartCard
              title="Build from scratch"
              description="Bring your experience together into a target profile and an English CV for the programme"
              href="#cv"
              actionLabel="Start building your CV"
              icon={<span aria-hidden="true">✦</span>}
            />
            <StartCard
              title="Input"
              description="Upload or paste an existing CV to receive evidence-based feedback"
              href="#review"
              actionLabel="Upload"
              icon={<span aria-hidden="true">↑</span>}
            />
          </div>
        </Vietnamese>
      </LanguageProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Bạn muốn bắt đầu từ đâu')).toBeInTheDocument();
      expect(screen.getByText('Xây dựng từ đầu')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Tổng hợp kinh nghiệm của bạn thành hồ sơ mục tiêu và CV tiếng Anh cho chương trình.',
        ),
      ).toBeInTheDocument();
      expect(screen.getByText('Bắt đầu xây dựng CV')).toBeInTheDocument();
      expect(screen.getByText('Nhập')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Tải lên hoặc dán CV hiện có để nhận phản hồi dựa trên bằng chứng.',
        ),
      ).toBeInTheDocument();
      expect(screen.getByText('Tải lên')).toBeInTheDocument();
    });
  });

  it('localizes AI Strategy static sections and placeholder testimonials', async () => {
    render(
      <LanguageProvider>
        <Vietnamese>
          <StrategyHome
            courseName="Computer Science"
            universityName="University"
            startHref="#start"
          />
        </Vietnamese>
      </LanguageProvider>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole('heading', {
          name: 'Xây dựng lộ trình cá nhân hóa để vào đại học.',
        }),
      ).toBeInTheDocument();
      expect(screen.getByText('Phân tích hàng trăm yếu tố ngay lập tức.')).toBeInTheDocument();
      expect(
        screen.getByText(/Quy trình ứng tuyển trở nên nhẹ nhàng hơn rất nhiều/u),
      ).toBeInTheDocument();
      expect(screen.getAllByText('Lời chia sẻ mẫu')).toHaveLength(3);
    });
  });

  it('translates opted-in static state copy without touching dynamic payloads', async () => {
    render(
      <LanguageProvider>
        <Vietnamese>
          <StateBlock
            translate
            title="No CV uploaded yet"
            body="Import a CV you already have, or start from your Glowbal profile."
          />
          <StateBlock title="Provider detail" body="Raw AI or server response" />
        </Vietnamese>
      </LanguageProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Chưa tải CV lên')).toBeInTheDocument();
      expect(
        screen.getByText('Nhập CV hiện có hoặc bắt đầu từ hồ sơ Glowbal của bạn.'),
      ).toBeInTheDocument();
      expect(screen.getByText('Provider detail')).toBeInTheDocument();
      expect(screen.getByText('Raw AI or server response')).toBeInTheDocument();
    });
  });

  it('localizes the homepage journey steps', async () => {
    // HomeJourney is a server component that takes its locale as a prop, as
    // "/vi" renders it; the catalog is what the /vi layout primes first.
    await loadCatalog();
    render(<HomeJourney locale="vi" />);

    // Content PDF (3) §6's steps; step 02 is the free consultation.
    expect(screen.getAllByRole('heading', { level: 3, name: 'Tư vấn miễn phí' }).length).toBeGreaterThan(0);
    expect(screen.getByText('Hành trình cùng GlowBal')).toBeInTheDocument();
    // The highlighted keyword is its own span; the heading's name stays whole.
    expect(
      screen.getByRole('heading', { level: 2, name: 'Làm thế nào để “săn học bổng” cùng GlowBal?' }),
    ).toBeInTheDocument();
  });

  it('localizes the shared primary navigation landmark', async () => {
    render(
      <LanguageProvider>
        <Vietnamese>
          <TopNav logo={<span>GlowBal</span>} items={[]} />
        </Vietnamese>
      </LanguageProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: 'Chính' })).toBeInTheDocument();
    });
  });

  it('localizes the animated homepage default without translating university names', async () => {
    render(
      <LanguageProvider>
        <Vietnamese>
          <HomePartners />
        </Vietnamese>
      </LanguageProvider>,
    );

    await waitFor(() => {
      // The word also sits, invisible, in the width-reservation list — so look
      // for the copy that is actually read out.
      const shown = screen
        .getAllByText('Mọi nơi')
        .find((element) => element.closest('[aria-hidden="true"]') === null);
      expect(shown).toBeDefined();
    });
  });
});
