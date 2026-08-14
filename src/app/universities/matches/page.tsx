import { redirect } from 'next/navigation';
import { loadRankedProgrammeMatches } from '@/features/universities/api';
import { ProgrammeMatchResults } from '@/features/universities/ui';
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
import { createClient } from '@/lib/supabase/server';

/** Authenticated, dynamic companion to the public university directory. */
export default async function ProgrammeMatchesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth?redirect=/universities/matches');
  const matches = await loadRankedProgrammeMatches(supabase, user.id);
  return (
    <div className="gb-page-full-bleed gb-has-mobile-header bg-surface">
      <SiteNavigation tone="light" showSaved />
      <ProgrammeMatchResults matches={matches} />
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
