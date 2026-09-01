'use client';

import { motion, useInView, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { ICONS, KitIcon } from '@/shared/ui';
import { getLocaleText, type Locale } from '@/lib/i18n/locale';

const METRICS = [
  {
    value: 7_800,
    prefix: '',
    suffix: '+',
    label: 'Scholarship searches run',
    icon: 'search',
  },
  {
    value: 370,
    prefix: '',
    suffix: '',
    label: 'Regular users',
    icon: 'usersTwo',
  },
  {
    value: 2_000,
    prefix: '$',
    suffix: '',
    label: 'Invested by Venture X',
    icon: 'chartBreakoutSquare',
  },
  {
    value: 150,
    prefix: '',
    suffix: '',
    label: 'Pilot users',
    icon: 'zap',
  },
  {
    value: 270,
    prefix: '',
    suffix: '',
    label: 'Pieces of feedback shaping the product',
    icon: 'messageSmileCircle',
  },
] as const;

const numberFormatter = new Intl.NumberFormat('en-US');

function formatMetric(value: number, prefix: string, suffix: string) {
  return `${prefix}${numberFormatter.format(value)}${suffix}`;
}

function AnimatedMetricCard({
  metric,
  index,
  active,
  reducedMotion,
  locale,
}: {
  metric: (typeof METRICS)[number];
  index: number;
  active: boolean;
  reducedMotion: boolean;
  locale: Locale;
}) {
  const valueRef = useRef<HTMLSpanElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const finalValue = formatMetric(metric.value, metric.prefix, metric.suffix);
  const placement =
    index === 3
      ? 'lg:col-start-2 xl:col-start-auto'
      : index === 4
        ? 'sm:col-start-2 lg:col-start-auto xl:col-start-auto'
        : '';

  useEffect(() => {
    if (!active || reducedMotion) return;

    const node = valueRef.current;
    if (!node) return;

    let frame = 0;
    const delay = index * 110;
    const duration = 1_350 + index * 80;
    const startedAt = performance.now() + delay;

    const tick = (now: number) => {
      if (now < startedAt) {
        frame = requestAnimationFrame(tick);
        return;
      }

      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(metric.value * eased);
      node.textContent = formatMetric(current, metric.prefix, metric.suffix);

      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    node.textContent = formatMetric(0, metric.prefix, metric.suffix);
    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, [active, index, metric.prefix, metric.suffix, metric.value, reducedMotion]);

  const moveGlow = (event: ReactPointerEvent<HTMLElement>) => {
    if (reducedMotion || !glowRef.current) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    glowRef.current.style.left = `${event.clientX - bounds.left}px`;
    glowRef.current.style.top = `${event.clientY - bounds.top}px`;
  };

  return (
    <article
      onPointerMove={moveGlow}
      className={`group relative min-h-[208px] overflow-hidden rounded-gb-2xl border border-line bg-surface p-gb-3xl shadow-gb-xs transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-gb-md hover:border-brand hover:shadow-gb-lg motion-reduce:transform-none motion-reduce:transition-none sm:col-span-2 sm:min-h-[252px] lg:col-span-2 xl:col-span-1 xl:min-h-[276px] ${placement}`}
    >
      <div
        ref={glowRef}
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 size-[180px] -translate-x-1/2 -translate-y-1/2 rounded-gb-full bg-brand-surface opacity-0 blur-3xl transition-opacity duration-300 group-hover:opacity-80 motion-reduce:hidden"
      />

      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-gb-xs origin-left scale-x-0 bg-brand transition-transform duration-500 group-hover:scale-x-100 motion-reduce:transition-none"
      />

      <div className="relative flex items-center justify-between">
        <span className="font-display text-gb-sm font-semibold tabular-nums text-fg-muted">
          {String(index + 1).padStart(2, '0')}
        </span>
        <span className="flex size-gb-6xl items-center justify-center rounded-gb-full border border-line bg-brand-subtle text-brand transition-[background-color,color,transform] duration-300 group-hover:scale-110 group-hover:bg-brand group-hover:text-on-brand motion-reduce:transform-none motion-reduce:transition-none">
          <KitIcon art={ICONS[metric.icon]} frame={20} />
        </span>
      </div>

      {/* This two-paragraph wrapper deliberately stays simple: it keeps the
          number and its translated label as one stable accessibility unit. */}
      <div className="relative mt-gb-3xl flex flex-col gap-gb-lg sm:mt-gb-6xl">
        <p
          aria-label={finalValue}
          className="w-full whitespace-nowrap font-display text-gb-display-lg font-semibold tabular-nums tracking-gb-display-tight text-brand transition-transform duration-300 group-hover:translate-x-gb-xs motion-reduce:transform-none motion-reduce:transition-none"
        >
          <span ref={valueRef} aria-hidden="true">
            {finalValue}
          </span>
        </p>
        <p className="max-w-[22ch] text-gb-sm font-semibold text-fg">
          {getLocaleText(locale, metric.label)}
        </p>
      </div>

      <div aria-hidden="true" className="absolute inset-x-gb-3xl bottom-gb-3xl h-px bg-line">
        <motion.span
          className="block h-full origin-left bg-brand"
          initial={{ scaleX: reducedMotion ? 1 : 0 }}
          animate={{ scaleX: active || reducedMotion ? 1 : 0 }}
          transition={{
            duration: reducedMotion ? 0 : 0.7,
            delay: reducedMotion ? 0 : 0.18 + index * 0.1,
          }}
        />
      </div>
    </article>
  );
}

export function HomeMetricsGrid({ locale = 'en' }: { locale?: Locale } = {}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const inView = useInView(gridRef, { once: true, amount: 0.2 });
  const prefersReducedMotion = useReducedMotion();
  const reducedMotion = prefersReducedMotion === true;

  return (
    <div ref={gridRef} className="relative w-full">
      <div
        aria-hidden="true"
        className="absolute left-[10%] right-[10%] top-1/2 hidden h-px bg-line xl:block"
      />
      <div className="relative grid w-full gap-gb-xl sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-5">
        {METRICS.map((metric, index) => (
          <AnimatedMetricCard
            key={metric.label}
            metric={metric}
            index={index}
            active={inView}
            reducedMotion={reducedMotion}
            locale={locale}
          />
        ))}
      </div>
    </div>
  );
}
