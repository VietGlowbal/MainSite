import type { Metadata } from 'next';
import { GlowbalLogo } from '@/components/glowbal-logo';
import { SiteNavigation } from '@/components/site-navigation';
import {
  FOOTER_COLUMNS,
  FOOTER_COPYRIGHT,
  FOOTER_RATINGS,
  FOOTER_SOCIAL,
  FOOTER_TAGLINE,
} from '@/features/marketing/navigation';
import { StrategyMasterPreview } from '@/features/marketing/strategy-master';
import { Footer } from '@/shared/ui';

export const metadata: Metadata = {
  title: 'GlowBal Strategy Master',
  description: 'Explore the GlowBal AI strategy experience for study-abroad applications.',
};

export default function StrategyMasterPage() {
  return (
    <div className="gb-page-full-bleed gb-has-mobile-header bg-surface-inverse-deep">
      <SiteNavigation tone="dark" />
      <main data-no-auto-translate>
        <StrategyMasterPreview />
      </main>
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
