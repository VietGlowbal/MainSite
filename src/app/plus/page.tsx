import type { Metadata } from 'next';
import Link from 'next/link';
import { GlowbalLogo } from '@/components/glowbal-logo';
import { SiteNavigation } from '@/components/site-navigation';
import {
  FOOTER_COLUMNS,
  FOOTER_COPYRIGHT,
  FOOTER_RATINGS,
  FOOTER_SOCIAL,
  FOOTER_TAGLINE,
} from '@/features/marketing/ui';
import {
  FREE_FEATURES,
  GLOWBAL_FB_CHAT_URL,
  getPlusPackage,
} from '@/lib/plus';
import { createClient } from '@/lib/supabase/server';
import { isPlusEntitlementActive } from '@/lib/entitlements/entitlement-service';
import {
  Badge,
  Button,
  Container,
  Footer,
  ICONS,
  KitIcon,
} from '@/shared/ui';
import { PlusPricing } from './plus-pricing';

export const metadata: Metadata = {
  title: 'GlowBal Pricing | Choose how you want to shine',
  description:
    'You don’t go it alone. GlowBal walks with you from picking schools to hitting submit. Choose the support plan that fits your study abroad journey.',
};

function TopAlert({
  emphasis = false,
  children,
}: {
  emphasis?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`mx-auto flex w-full max-w-2xl flex-col items-center gap-1 rounded-2xl border p-4 text-center text-sm shadow-sm ${
        emphasis
          ? 'border-[#E11D48]/30 bg-[#E11D48]/5 text-[#141118]'
          : 'border-[#EDE9EE] bg-white text-[#6B6570]'
      }`}
    >
      {children}
    </div>
  );
}

export default async function PlusPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string; application?: string; status?: string }>;
}) {
  const { welcome, application, status } = await searchParams;
  const isWelcome = welcome === '1';
  const isCancelled = status === 'cancelled';
  const applicationId = application ?? null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isPlus = false;
  let planLabel: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from('student_profiles')
      .select('plus_status, plus_plan, plus_expires_at')
      .eq('user_id', user.id)
      .maybeSingle();
    isPlus = isPlusEntitlementActive(profile ?? {});
    planLabel = profile?.plus_plan ?? null;
  }

  const currentPlan = getPlusPackage(planLabel);
  const isSignedIn = !!user;

  return (
    <div className="gb-page-full-bleed gb-has-mobile-header bg-[#FBF9FA] text-[#141118]">
      <SiteNavigation showSaved />

      <main className="pt-6 sm:pt-8">
        {/* Contextual Notices */}
        {(isWelcome || isCancelled || isPlus || applicationId) && (
          <Container className="mb-6 space-y-3 px-4">
            {isWelcome ? (
              <TopAlert>
                <p className="font-bold text-[#141118]">🎉 Your profile is set up</p>
                <p className="text-xs text-[#6B6570]">
                  Get the most from GlowBal with Plus — or keep exploring for free.
                </p>
                <Link
                  href="/universities"
                  className="mt-1 text-xs font-semibold text-[#E11D48] underline-offset-4 hover:underline"
                >
                  Maybe later — see my matches →
                </Link>
              </TopAlert>
            ) : null}

            {isCancelled ? (
              <TopAlert>
                <p className="font-bold text-[#141118]">Checkout cancelled</p>
                <p className="text-xs text-[#6B6570]">
                  Nothing was charged. Your plan is unchanged — pick it up again whenever you are ready.
                </p>
              </TopAlert>
            ) : null}

            {isPlus ? (
              <TopAlert emphasis>
                <p className="font-bold text-[#141118]">You’re on GlowBal Plus</p>
                <p className="text-xs text-[#6B6570]">
                  Thanks for your support — you can extend or upgrade your plan below.
                </p>
                {currentPlan ? (
                  <Badge variant="outline" className="mt-1 border-[#E11D48] text-[#E11D48]">
                    {currentPlan.name}
                  </Badge>
                ) : null}
              </TopAlert>
            ) : null}

            {applicationId ? (
              <TopAlert>
                <p className="font-medium text-[#141118]">
                  Unlock the full application plan to keep building this application.
                </p>
                <Link
                  href={`/apply/${applicationId}?sop=1`}
                  className="text-xs font-semibold text-[#E11D48] underline-offset-4 hover:underline"
                >
                  Continue with limited plan →
                </Link>
              </TopAlert>
            ) : null}
          </Container>
        )}

        {/* ── Main Redesigned Pricing Section ───────────────────────────── */}
        <PlusPricing signedIn={isSignedIn} applicationId={applicationId} />

        {/* ── Free Plan & Help CTA ────────────────────────────────────────── */}
        <section className="bg-white py-16 border-t border-[#EDE9EE]">
          <Container className="flex flex-col gap-10 max-w-[1140px] px-4 sm:px-6">
            <div className="flex flex-col gap-8 rounded-3xl border border-[#EDE9EE] bg-[#FBF9FA] p-8 md:flex-row md:items-center md:justify-between shadow-sm">
              <div className="flex min-w-0 flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <h2 className="text-2xl font-extrabold tracking-tight text-[#141118]">
                    Continue with the Free plan
                  </h2>
                  <p className="text-sm text-[#6B6570]">
                    Everything you need to start exploring — no payment required.
                  </p>
                </div>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {FREE_FEATURES.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm text-[#2B2730]">
                      <span className="shrink-0 text-[#2ABDD8] font-bold">✓</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Button href="/universities" size="xl" variant="secondary" className="shrink-0 rounded-xl">
                Continue free →
              </Button>
            </div>

            {/* Talk to a person */}
            <div className="flex flex-col items-center gap-4 rounded-3xl border border-[#EDE9EE] bg-[#E11D48]/5 p-8 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-[#E11D48] text-white shadow-md">
                <KitIcon art={ICONS.messageSmileCircle} frame={24} />
              </span>
              <h2 className="text-xl font-bold text-[#141118]">
                Not sure which plan fits you?
              </h2>
              <Button
                href={GLOWBAL_FB_CHAT_URL}
                target="_blank"
                rel="noopener noreferrer"
                size="lg"
                variant="secondary"
                className="rounded-xl border-[#E11D48] text-[#E11D48] hover:bg-[#E11D48] hover:text-white"
              >
                Chat with our in-house team for advice
              </Button>
            </div>

            <div className="mx-auto flex max-w-2xl flex-col items-center gap-2 text-center text-xs text-[#6B6570]">
              <p className="inline-flex items-center gap-1.5 font-medium">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                Payments are processed securely via VNPay and Bank Transfer (VietQR).
              </p>
              <p>
                GlowBal helps you discover opportunities and prepare stronger applications; it does not guarantee scholarship outcomes.
              </p>
            </div>
          </Container>
        </section>
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
