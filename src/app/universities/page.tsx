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
