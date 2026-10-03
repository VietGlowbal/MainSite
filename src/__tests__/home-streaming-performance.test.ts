import { describe, expect, it, vi } from 'vitest';
import { Children, isValidElement, Suspense, type ReactElement } from 'react';
import { normalizeScholarshipBenefits } from '@/features/scholarships/domain/benefit-normalization';
import { calculateScholarshipValue } from '@/features/scholarships/domain/valuation';
import { createScholarshipValueViewModel } from '@/features/scholarships/domain/value-formatting';
import { getLocaleText } from '@/lib/i18n/locale';
const mocks = vi.hoisted(() => ({
  ids: vi.fn(), countries: vi.fn(), highlights: vi.fn(), team: vi.fn(), value: vi.fn(),
}));
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock('@/features/universities/api', () => ({ getUniversityQueries: () => ({ findIdsByNames: mocks.ids }) }));
vi.mock('@/features/scholarships/api', () => ({
  getScholarshipQueries: () => ({ countryCounts: mocks.countries, homeHighlights: mocks.highlights }),
  calculateCandidateScholarshipValue: mocks.value,
}));
vi.mock('@/lib/team', () => ({ getTeamMembers: mocks.team }));
vi.mock('@/components/site-navigation', () => ({ SiteNavigation: 'nav' }));
vi.mock('@/features/marketing/ui', () => ({
  HOME_BANDS_CLASS: 'bands', HomeConsultationProvider: 'provider', HomeFeatures: 'features',
  HomeHero: 'hero', HomeJourney: 'journey', HomeMetrics: 'metrics', HomePartners: 'partners',
  HomePricing: 'pricing', HomeStories: 'stories', HomeTeam: 'team', PARTNER_LOGOS: [],
  getOfficialScholarshipBranding: () => null, getLocalizedFooter: () => ({}),
}));
vi.mock('@/app/home-contact-section', () => ({ HomeContactSection: 'contact' }));
vi.mock('@/features/marketing/api', () => ({ recordWaitlistSignup: vi.fn() }));
vi.mock('@/lib/send-email', () => ({ sendEmail: vi.fn() }));
import { MarketingHome } from '@/app/page';
function boundaries(element: unknown): ReactElement<{ fallback: ReactElement; children: ReactElement<{ data: Promise<unknown>; locale: string }> }>[] {
  if (!isValidElement<{ children?: unknown }>(element)) return [];
  if (element.type === Suspense) return [element as ReturnType<typeof boundaries>[number]];
  return Children.toArray(element.props.children as ReactElement).flatMap(boundaries);
}
describe('homepage streaming', () => {
  it.each(['en', 'vi'] as const)('returns the %s shell while every data source is pending and retains real data', async (locale) => {
    let finishIds!: (value: Record<string, number>) => void;
    let finishCountries!: (value: { country: string; count: number }[]) => void;
    let finishHighlights!: (value: { total: number; items: never[] }) => void;
    let finishTeam!: (value: never[]) => void;
    mocks.ids.mockReturnValue(new Promise(resolve => { finishIds = resolve; }));
    mocks.countries.mockReturnValue(new Promise(resolve => { finishCountries = resolve; }));
    mocks.highlights.mockReturnValue(new Promise(resolve => { finishHighlights = resolve; }));
    mocks.team.mockReturnValue(new Promise(resolve => { finishTeam = resolve; }));
    const shell = await Promise.race([MarketingHome({ locale }), new Promise<null>(resolve => setTimeout(() => resolve(null), 100))]);
    expect(shell).not.toBeNull();
    const sections = boundaries(shell);
    expect(sections.map(s => s.props.fallback.type)).toEqual(['hero', 'partners', 'team']);
    expect(sections.every(s => s.props.children.props.locale === locale)).toBe(true);
    finishIds({}); finishCountries([{ country: 'Vietnam', count: 12 }]);
    finishHighlights({ total: 3000, items: [] }); finishTeam([]);
    const resolved = await Promise.all(sections.map(s => {
      const child = s.props.children;
      return (child.type as (props: typeof child.props) => Promise<ReactElement>)(child.props);
    }));
    expect(resolved[0].props).toMatchObject({ countries: [{ name: 'Vietnam', count: 12 }] });
    expect(resolved[1].props).toMatchObject({ scholarshipTotal: 3000 });
    expect(resolved[2].props).toMatchObject({ members: [] });
  });

  it.each(['en', 'vi'] as const)('keeps canonical candidate valuation and %s formatting in the streamed spotlight', async (locale) => {
    const benefits = normalizeScholarshipBenefits({ coverage: '100% tuition', funding_type: ['full-ride'] });
    const value = calculateScholarshipValue({ benefits: benefits.components });
    mocks.ids.mockResolvedValue({});
    mocks.countries.mockResolvedValue([]);
    mocks.team.mockResolvedValue([]);
    mocks.value.mockReturnValue(value);
    mocks.value.mockClear();
    mocks.highlights.mockResolvedValue({ total: 1, items: [{
      id: 42, name: 'Tuition award', scope: 'university', country: 'Vietnam',
      universities: [], benefits, valuationContexts: [], coverage: '100% tuition',
      amountLabel: null, funding_type: ['full-ride'],
    }] });

    const sections = boundaries(await MarketingHome({ locale }));
    const child = sections[1]!.props.children;
    const partners = await (child.type as (props: typeof child.props) => Promise<ReactElement>)(child.props);
    expect(mocks.value).toHaveBeenCalledWith({
      id: 42, country: 'Vietnam', benefits: benefits.components, valuationContexts: [],
    }, null, expect.objectContaining({ asOf: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) }));
    const expected = createScholarshipValueViewModel(
      { benefits, value }, locale === 'vi' ? 'vi-VN' : 'en-US',
      (source, vars) => getLocaleText(locale, source, vars),
    );
    expect(partners.props).toMatchObject({ scholarships: [{ id: 42, valueModel: expected }] });
    expect(expected.coverageLabel).not.toContain('Full-ride');
  });
});
