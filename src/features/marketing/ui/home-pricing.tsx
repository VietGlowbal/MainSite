'use client';

import { useEffect, useRef, useState } from 'react';
import { getLocaleText, type Locale } from '@/lib/i18n/locale';
import { Button, GlowbalIcon, ICONS, KitIcon } from '@/shared/ui';
import { PRICING_PLANS, type PricingPlan } from '../domain/home-content';
import { useHomeConsultation } from './home-consultation';
import { KeywordHighlight, highlightPhrases } from './home-highlight';

/**
 * Pricing — sales-journey handoff §8, new on Home.
 *
 * NOTHING HERE TAKES PAYMENT. Every CTA scrolls to the consultation form and
 * pre-selects that package there (the card pulses a rose ring); the sales team
 * follows up. That is also why the prices can follow the owner's PDF while the
 * checkout in `src/lib/plus.ts` still sells a different set — see the ⚠️ on
 * CONSULTATION_PACKAGE_OPTIONS before pointing any of these at checkout.
 *
 * One list, two layouts: below `lg` a snap carousel of 300px cards that opens
 * centred on Premium, with dots; from `lg` a three-column grid with Premium
 * raised in the middle. (The handoff draws the grid from 768px; three cards in
 * 768px leaves each ~218px wide, so the carousel carries on to 1024.)
 *
 * Owner-open items are shipped at the brief's defaults and listed in
 * docs/current-status.md rather than printed here: no "[XX]%" on the ribbon, no
 * "Free*" asterisk without its footnote, ≈375K/month for Premium.
 */

const DESKTOP_QUERY = '(min-width: 1024px)';

function PriceBlock({ plan, locale }: { plan: PricingPlan; locale: Locale }) {
  return (
    <div className="mt-gb-lg min-h-[92px] lg:mt-gb-xl lg:min-h-[96px]">
      {plan.was ? (
        <p className="text-gb-sm text-fg-muted line-through lg:text-gb-md">
          <span className="sr-only">{getLocaleText(locale, 'Was')} </span>
          {plan.was}
        </p>
      ) : (
        /* Holds the strike-through line's height, so "Free" sits on the same
           baseline as the paid prices beside it. */
        <span aria-hidden="true" className="block h-gb-2xl lg:h-gb-3xl" />
      )}
      <p className="flex flex-wrap items-baseline gap-gb-xs">
        <span className="font-display text-gb-display-sm font-semibold tracking-gb-display-tight text-fg lg:text-gb-display-md">
          {plan.price ?? getLocaleText(locale, 'Free')}
        </span>
        {plan.price ? <span className="text-gb-md text-fg-tertiary">{getLocaleText(locale, '/year')}</span> : null}
      </p>
      {plan.perMonth ? (
        <p className="mt-gb-xxs text-gb-sm text-fg-tertiary">
          {getLocaleText(locale, '≈ {amount}/month', { amount: plan.perMonth })}
        </p>
      ) : null}
    </div>
  );
}

function PlanCard({
  plan,
  locale,
  onChoose,
}: {
  plan: PricingPlan;
  locale: Locale;
  onChoose: (plan: PricingPlan) => void;
}) {
  return (
    <article
      data-plan={plan.id}
      className={`relative flex w-[300px] shrink-0 snap-center flex-col gap-gb-2xl rounded-gb-2xl bg-surface p-gb-3xl transition duration-[250ms] ease-out motion-reduce:transition-none lg:w-auto lg:gap-gb-3xl lg:p-gb-4xl ${
        plan.featured
          ? 'border-2 border-brand shadow-gb-lg lg:-translate-y-gb-xl lg:hover:-translate-y-gb-2xl'
          : 'border border-line shadow-gb-xs hover:border-gb-brand-300 hover:shadow-gb-lg lg:hover:-translate-y-gb-xs'
      }`}
    >
      {plan.featured ? (
        <span className="absolute -top-[14px] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-gb-full bg-brand px-gb-lg py-gb-xs text-gb-xs font-bold text-on-brand shadow-gb-xs">
          {getLocaleText(locale, 'Most chosen')}
        </span>
      ) : null}

      <div>
        <h3 data-no-auto-translate className="text-gb-lg font-semibold text-fg">
          {plan.name}
        </h3>
        {/* What the package combines — content PDF (3) §8: a person + GlowBal
            AI on Premium, AI on Yearly. The row keeps its height on Starter so
            the prices below stay on one line across the three cards. */}
        <ul className="mt-gb-md flex min-h-[26px] flex-wrap gap-gb-sm">
          {plan.includes.map((part) => (
            <li
              key={part}
              className="inline-flex items-center gap-gb-xs rounded-gb-full border border-brand-surface bg-brand-subtle py-gb-xxs pl-gb-sm pr-gb-md text-gb-xs font-semibold text-fg-brand"
            >
              <GlowbalIcon name={part === 'mentor' ? 'mentorProfile' : 'aiInsight'} size={16} />
              {part === 'mentor' ? getLocaleText(locale, 'Human mentor') : 'GlowBal AI'}
            </li>
          ))}
        </ul>
        <PriceBlock plan={plan} locale={locale} />
        {/* Two lines reserved even when empty (Starter has no tagline), so the
            three CTAs line up across the row — the handoff's cards drift here. */}
        <p className="mt-gb-md min-h-[40px] text-pretty text-gb-sm font-semibold text-fg-secondary lg:mt-gb-lg">
          {plan.tagline ? getLocaleText(locale, plan.tagline) : null}
        </p>
      </div>

      <Button
        size="xl"
        variant={plan.primary ? 'primary' : 'secondary'}
        onClick={() => onChoose(plan)}
        className="w-full"
      >
        {getLocaleText(locale, plan.cta)}
      </Button>

      <ul className="flex flex-col gap-gb-md border-t border-line pt-gb-2xl lg:gap-gb-lg lg:pt-gb-3xl">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-gb-md text-gb-sm text-fg-secondary">
            <KitIcon art={ICONS.checkCircle} frame={18} className="mt-px shrink-0 text-brand" />
            <span>{getLocaleText(locale, feature)}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

export function HomePricing({ locale = 'en' }: { locale?: Locale }) {
  const { choosePackage } = useHomeConsultation();
  const listRef = useRef<HTMLDivElement>(null);
  const featuredIndex = Math.max(0, PRICING_PLANS.findIndex((plan) => plan.featured));
  const [active, setActive] = useState(featuredIndex);

  /* Below `lg`, open the carousel centred on Premium, and keep the dots in
     step with whichever card is nearest the middle. */
  useEffect(() => {
    const list = listRef.current;
    if (list === null || window.matchMedia(DESKTOP_QUERY).matches) return undefined;

    const cards = Array.from(list.querySelectorAll<HTMLElement>('[data-plan]'));
    const featured = cards[featuredIndex];
    if (featured) list.scrollLeft = featured.offsetLeft - (list.clientWidth - featured.clientWidth) / 2;

    const onScroll = () => {
      const middle = list.scrollLeft + list.clientWidth / 2;
      let nearest = 0;
      let best = Infinity;
      cards.forEach((card, index) => {
        const distance = Math.abs(card.offsetLeft + card.clientWidth / 2 - middle);
        if (distance < best) {
          best = distance;
          nearest = index;
        }
      });
      setActive(nearest);
    };
    list.addEventListener('scroll', onScroll, { passive: true });
    return () => list.removeEventListener('scroll', onScroll);
  }, [featuredIndex]);

  const scrollToCard = (index: number) => {
    const list = listRef.current;
    const card = list?.querySelectorAll<HTMLElement>('[data-plan]')[index];
    if (!list || !card) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    list.scrollTo({
      left: card.offsetLeft - (list.clientWidth - card.clientWidth) / 2,
      behavior: reduced ? 'auto' : 'smooth',
    });
  };

  return (
    /* White: the background ramp reaches white at the foot of the features
       band, right where this one starts (owner, 2026-10-01). The rose glow
       behind the cards is a blob well inside the band, not a band colour, so
       this section keeps "a little red" without breaking the seam. */
    <section id="pricing" className="relative isolate scroll-mt-gb-9xl overflow-hidden bg-surface py-gb-7xl text-fg md:py-gb-9xl">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[12%] -z-10 size-[520px] -translate-x-1/2 rounded-gb-full bg-brand/10 blur-[120px]"
      />
      <div className="mx-auto w-full max-w-gb-desktop px-gb-xl md:px-gb-4xl">
        {/* Title, subtitle and sale tag: content PDF (3) §8, which marks the
            whole sale tag as a keyword. "50% sales on" is lightly fixed to
            "50% off", as the brief allows for grammar. */}
        <div className="mx-auto flex max-w-[800px] flex-col items-center text-center">
          <p className="text-gb-xs font-bold uppercase tracking-[0.08em] text-fg-brand">
            {getLocaleText(locale, 'GlowBal packages')}
          </p>
          <h2 className="mt-gb-lg text-balance font-display text-gb-display-sm font-semibold tracking-gb-display-tight md:text-gb-display-lg">
            {highlightPhrases(
              getLocaleText(locale, 'Become a GlowBal Mentee TODAY!'),
              [getLocaleText(locale, 'TODAY!')],
              'light',
            )}
          </h2>
          <p className="mt-gb-xl text-balance text-gb-md text-fg-tertiary md:text-gb-lg">
            {highlightPhrases(
              getLocaleText(
                locale,
                'GlowBal is proud to be a pioneering education platform to combine AI and human power with an affordable price.',
              ),
              [getLocaleText(locale, 'AI and human power')],
              'light',
            )}
          </p>
          <p className="mt-gb-3xl inline-flex items-center gap-gb-md rounded-gb-full border border-brand-surface bg-surface py-gb-xs pl-gb-xs pr-gb-lg text-left text-gb-sm font-semibold shadow-gb-xs">
            <span className="shrink-0 rounded-gb-full bg-brand px-gb-md py-gb-xxs text-gb-xs font-bold text-on-brand">
              -50%
            </span>
            <KeywordHighlight tone="light">
              {getLocaleText(locale, 'Launching Offer: 50% off all packages during 2026.')}
            </KeywordHighlight>
          </p>
        </div>
      </div>

      <div
        ref={listRef}
        className="mx-auto mt-gb-5xl flex max-w-gb-desktop snap-x snap-mandatory gap-gb-lg overflow-x-auto px-gb-xl pb-gb-xl pt-gb-2xl [scrollbar-width:none] lg:mt-gb-7xl lg:grid lg:snap-none lg:grid-cols-3 lg:items-stretch lg:gap-gb-3xl lg:overflow-visible lg:px-gb-4xl lg:pb-0 lg:pt-gb-xl [&::-webkit-scrollbar]:hidden"
      >
        {PRICING_PLANS.map((plan) => (
          <PlanCard key={plan.id} plan={plan} locale={locale} onChoose={(chosen) => choosePackage(chosen.id)} />
        ))}
      </div>

      <div className="mt-gb-md flex justify-center gap-gb-sm lg:hidden">
        {PRICING_PLANS.map((plan, index) => (
          <button
            key={plan.id}
            type="button"
            onClick={() => scrollToCard(index)}
            aria-label={plan.name}
            aria-current={index === active ? 'true' : undefined}
            className="flex h-gb-3xl items-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <span
              className={`block h-gb-md rounded-gb-full transition-[width,background-color] duration-300 motion-reduce:transition-none ${
                index === active ? 'w-gb-3xl bg-brand' : 'w-gb-md bg-line-strong'
              }`}
            />
          </button>
        ))}
      </div>
    </section>
  );
}
