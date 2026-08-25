import type { Metadata } from 'next';
import {
  getUniversityFacets,
  loadUniversityDirectory,
} from '@/features/universities/directory-loader';
import {
  parseUniversitySearchParams,
  type UniversityRawSearchParams,
} from '@/features/universities/directory-query';
import { GlowbalLogo } from '@/components/glowbal-logo';
import { SiteNavigation } from '@/components/site-navigation';
import {
  FOOTER_COLUMNS,
  FOOTER_COPYRIGHT,
  FOOTER_RATINGS,
  FOOTER_SOCIAL,
  FOOTER_TAGLINE,
} from '@/features/marketing/navigation';
import { Footer } from '@/shared/ui/footer';
import { UniversityListClient } from './university-list-client';

import { SITE_URL } from '@/lib/site-url';
import { buildLocaleAlternates } from '@/lib/seo/alternates';

export const metadata: Metadata = {
  title: 'Explore Global Universities | GlowBal',
  description:
    'Search and compare 100+ accredited universities across UK, US, Australia, Singapore, and more. Filter by location, tuition fees, and admission criteria.',
  keywords: [
    'explore universities',
    'global university list',
    'study abroad universities',
    'top universities ranking',
    'vietnamese students abroad',
    'danh sách trường đại học du học',
  ],
  alternates: buildLocaleAlternates('/universities'),
  openGraph: {
    title: 'Explore Global Universities | GlowBal',
    description:
      'Search and compare 100+ accredited global universities. Filter by location, tuition fees, and admission criteria.',
    url: `${SITE_URL}/universities`,
  },
};

export const revalidate = 43200;

type Props = { searchParams: Promise<UniversityRawSearchParams> };

export default async function UniversitiesPage({ searchParams }: Props) {
  const query = parseUniversitySearchParams(await searchParams);
  const [directory, facets] = await Promise.all([
    loadUniversityDirectory(query),
    getUniversityFacets(),
  ]);

  return (
    <div className="gb-page-full-bleed gb-has-mobile-header bg-surface">
      {/* Keep the session-aware header in its own client boundary. A session
          update during selective hydration must never remount the directory. */}
      <SiteNavigation tone="light" showSaved />
      <UniversityListClient
        universities={directory.page.items}
        total={directory.page.total}
        page={directory.page.page}
        pageSize={directory.page.pageSize}
        search={directory.query.search}
        country={directory.query.country}
        countries={facets.countries.map((facet) => facet.value)}
        wikiPairs={directory.wikiPairs}
        canonicalSearch={directory.canonicalSearch}
      />
      <Footer
        logo={<GlowbalLogo height={28} />}
        tagline={FOOTER_TAGLINE}
        columns={FOOTER_COLUMNS}
        social={FOOTER_SOCIAL}
        copyright={FOOTER_COPYRIGHT}
        ratings={FOOTER_RATINGS}
      />
    </div>
  );
}
