'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { getLocaleText, type Locale } from '@/lib/i18n/locale';
import { ICONS, KitIcon, type KitIconArt } from '@/shared/ui';
import { STUDENT_QUOTES } from '../domain/home-content';
import { highlightClass } from './home-highlight';

/**
 * The four v2 Standout-number cards — sales-journey handoff §4.
 *
 * ─── NO ANIMATION LIBRARY ───────────────────────────────────────────────────
 *
 * The previous grid counted with framer-motion, which put ~247 KB of animation
 * library into Home's bundle for a number going up (docs/performance.md). The
 * handoff specifies the whole motion — first view at 40% visibility, 1350ms
 * ease-out-cubic, en-US formatting — and that is twenty lines of rAF. The rule
 * under each card draws in with a CSS keyframe token (`gb-rule-draw`).
 *
 * ─── THE FIGURE IS ALWAYS RIGHT FIRST ───────────────────────────────────────
 *
 * The server renders the FINAL value, and the element's accessible name is the
 * final value too. Only once the card is seen does the visible text drop to
 * zero and count back up, so no-JS visitors, crawlers and screen readers never
 * meet a "0". Reduced motion skips the count and the draw-in entirely.
 *
 * ─── V2 FIGURES ─────────────────────────────────────────────────────────────
 *
 * V2 separates the two institutional figures into their own cards and uses the
 * owner-approved English labels from the detailed brief.
 *
 * ─── A PROOF IMAGE AT THE FOOT OF EACH CARD (owner, 2026-10-01) ─────────────
 *
 * Content PDF (3) §4: "dưới cùng là ảnh minh chứng theo thẻ đó" — a proof
 * image at the bottom of each card. Every image is REAL; nothing is generated:
 *   Web access     a screenshot of the live university directory on
 *                  glowbal-education.com (captured 2026-10-01 at 2x).
 *   Regular users  the faces of actual GlowBal users — the students whose
 *                  quotes and photos the owner supplied for Success Stories.
 *   Venture X      the team on stage at Venture X Demo Day holding the
 *                  programme's certificate (owner-supplied, 2026-10-01).
 *   AOF award      the team receiving the Runner-up (Á quân) cheque at the
 *                  Khởi Nghiệp Trẻ 2026 final. Its total prize value,
 *                  1,253,780,000 VND, is the card's $51,200 (owner-supplied,
 *                  2026-10-01).
 * Never stand a stock or generated image in for a missing one: it would be a
 * fake proof.
 *
 * The image slot is the same 4:3 box on every card and sits at the foot
 * (`mt-auto`), so the four cards stay one height whatever their label length.
 */

type Figure = {
  readonly to: number;
  readonly prefix?: string;
  readonly suffix?: string;
  readonly decimals?: number;
};

type MetricVisual =
  | { readonly kind: 'photo'; readonly src: string; readonly alt: string; readonly focus?: string }
  | { readonly kind: 'users' };

type Metric = {
  readonly primary: Figure;
  readonly label: string;
  readonly icon: KitIconArt;
  readonly visual: MetricVisual;
};

const METRICS: readonly Metric[] = [
  {
    primary: { to: 10000, suffix: '+' },
    label: 'Web access',
    icon: ICONS.search,
    visual: {
      kind: 'photo',
      src: '/home/metrics/web-access.webp',
      alt: "GlowBal's university directory on glowbal-education.com",
      focus: '0% 0%',
    },
  },
  { primary: { to: 413 }, label: 'Regular users', icon: ICONS.usersTwo, visual: { kind: 'users' } },
  {
    primary: { to: 2000, prefix: '$' },
    label: 'Investment from Venture X Incubation Program',
    icon: ICONS.gift01,
    visual: {
      kind: 'photo',
      src: '/home/metrics/venture-x-demo-day.webp',
      alt: 'The GlowBal team on stage at Venture X Demo Day with its certificate',
    },
  },
  {
    primary: { to: 51200, prefix: '$' },
    label: 'Awarded from Academy of Finance',
    icon: ICONS.chartBreakoutSquare,
    visual: {
      kind: 'photo',
      src: '/home/metrics/young-entrepreneurship-2026.webp',
      alt: 'The GlowBal team receiving the Runner-up prize at the Young Entrepreneurship 2026 final',
    },
  },
];

/** The real users shown on the "Regular users" card: everyone with a supplied photo. */
const USER_FACES = STUDENT_QUOTES.flatMap((quote) =>
  quote.portrait === null ? [] : [{ name: quote.name, portrait: quote.portrait, focus: quote.focus }],
);

function MetricVisualSlot({ visual, locale }: { visual: MetricVisual; locale: Locale }) {
  if (visual.kind === 'photo') {
    return (
      <Image
        src={visual.src}
        alt={getLocaleText(locale, visual.alt)}
        fill
        /* Four across from `lg` (~290px), two across from `md`, full width on
           a phone; the sources are 1200px wide, enough for 2x at each. */
        sizes="(min-width: 1024px) 300px, (min-width: 768px) 50vw, 100vw"
        quality={90}
        className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        style={visual.focus ? { objectPosition: visual.focus } : undefined}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={getLocaleText(locale, 'Students who use GlowBal')}
      className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gb-brand-50 to-gb-brand-100"
    >
      <ul className="grid grid-cols-4 gap-y-gb-md pl-gb-md" aria-hidden="true">
        {USER_FACES.map((face) => (
          <li
            key={face.name}
            className="relative -ml-gb-md size-[60px] overflow-hidden rounded-gb-full border-[3px] border-surface bg-surface shadow-gb-xs md:size-[64px]"
          >
            <Image
              src={face.portrait}
              alt=""
              fill
              sizes="64px"
              className="object-cover"
              style={{ objectPosition: face.focus }}
            />
          </li>
        ))}
        {/* The eighth seat says "and many more" without inventing a count. */}
        <li className="-ml-gb-md flex size-[60px] items-center justify-center rounded-gb-full border-[3px] border-surface bg-brand text-on-brand shadow-gb-xs md:size-[64px]">
          <KitIcon art={ICONS.usersTwo} frame={22} />
        </li>
      </ul>
    </div>
  );
}

const COUNT_MS = 1350;

function format({ prefix = '', suffix = '', decimals = 0 }: Figure, value: number): string {
  return `${prefix}${value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}${suffix}`;
}

/**
 * Drops the visible text to zero and counts it back up the first time `run`
 * turns true. Writes straight to the node: sixty React renders a second for a
 * number nobody interacts with would be pure waste.
 */
function CountUp({ figure, run, className }: { figure: Figure; run: boolean; className: string }) {
  const valueRef = useRef<HTMLSpanElement>(null);
  const finalValue = format(figure, figure.to);

  useEffect(() => {
    const node = valueRef.current;
    if (!run || node === null) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;

    const decimals = figure.decimals ?? 0;
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const progress = Math.min(1, (now - start) / COUNT_MS);
      const eased = 1 - (1 - progress) ** 3;
      const raw = figure.to * eased;
      node.textContent = format(figure, decimals > 0 ? raw : Math.round(raw));
      if (progress < 1) frame = requestAnimationFrame(tick);
    });
    return () => {
      cancelAnimationFrame(frame);
      node.textContent = format(figure, figure.to);
    };
  }, [run, figure]);

  return (
    <p className={className} aria-label={finalValue}>
      <span ref={valueRef} aria-hidden="true">
        {finalValue}
      </span>
    </p>
  );
}

function MetricCard({ metric, index, locale }: { metric: Metric; index: number; locale: Locale }) {
  const cardRef = useRef<HTMLElement>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const node = cardRef.current;
    if (node === null) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setSeen(true);
          observer.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  /* White cards on the rose band (2026-09-29, was translucent black): the
     content PDF marks the four figures as keywords to highlight in the
     red→pink gradient, and that gradient only reads on white. */
  return (
    <article
      ref={cardRef}
      data-surface="light"
      className="group relative flex flex-col overflow-hidden rounded-gb-2xl border border-white/70 bg-surface text-fg shadow-gb-lg transition duration-300 ease-out hover:-translate-y-gb-md hover:shadow-gb-xl motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      <div className="flex flex-col p-gb-3xl pb-gb-2xl">
        <div className="flex items-center justify-between">
          <span className="font-display text-gb-sm font-semibold text-fg-muted">
            {String(index + 1).padStart(2, '0')}
          </span>
          <span className="flex size-gb-6xl items-center justify-center rounded-gb-full bg-brand-subtle text-brand">
            <KitIcon art={metric.icon} frame={20} />
          </span>
        </div>

        <CountUp
          figure={metric.primary}
          run={seen}
          className={`mt-gb-4xl self-start font-display text-gb-display-lg font-semibold tracking-gb-display-tight tabular-nums ${highlightClass('light')}`}
        />
        <p className="mt-gb-md max-w-[24ch] text-pretty text-gb-sm font-semibold text-fg-secondary">
          {getLocaleText(locale, metric.label)}
        </p>
      </div>

      {/* The proof image, full-bleed at the foot of the card. `mt-auto` pins
          it to the bottom so the four slots line up across the row. */}
      <div className="relative mt-auto aspect-[4/3] overflow-hidden bg-surface-muted">
        <MetricVisualSlot visual={metric.visual} locale={locale} />
        {/* The rose rule now runs along the image's top edge, drawn in once
            the card is seen and staggered per card. */}
        <div aria-hidden="true" className="absolute inset-x-0 top-0 z-[1] h-[2px] bg-line">
          <span
            className={`block h-full origin-left bg-gradient-to-r from-gb-brand-700 to-gb-brand-500 motion-reduce:scale-x-100 motion-reduce:animate-none ${
              seen ? 'animate-gb-rule-draw' : 'scale-x-0'
            }`}
            style={{ animationDelay: `${180 + index * 100}ms` }}
          />
        </div>
      </div>
    </article>
  );
}

export function HomeMetricsGrid({ locale = 'en' }: { locale?: Locale }) {
  return (
    <div className="grid w-full items-stretch gap-gb-xl md:grid-cols-2 lg:grid-cols-4">
      {METRICS.map((metric, index) => (
        <MetricCard key={metric.label} metric={metric} index={index} locale={locale} />
      ))}
    </div>
  );
}
