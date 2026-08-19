import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { loadUniversityRecommendations } from '@/features/universities/api';
import { UniversityMatchResults } from '@/features/universities/ui';
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

/** Authenticated university-only matching flow. */
export default async function UniversityMatchesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth?redirect=/universities/matches');

  const recommendation = await loadUniversityRecommendations(supabase, user.id);
  return (
    <div className="gb-page-full-bleed gb-has-mobile-header bg-surface">
      <SiteNavigation tone="light" showSaved />
      <UniversityMatchResults recommendation={recommendation} />
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
