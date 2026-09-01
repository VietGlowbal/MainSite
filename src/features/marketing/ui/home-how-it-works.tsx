'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { GlowbalLogo } from '@/components/glowbal-logo';
import { useLanguage } from '@/lib/i18n';
import { getLocaleText, type Locale } from '@/lib/i18n/locale';
import { ICONS, KitIcon, Section } from '@/shared/ui';

const AUTOPLAY_MS = 5_500;

const STEPS = [
  {
    title: 'Input simple information',
    description: 'Tell GlowBal about your goals, strengths and study preferences.',
    outcome: 'A profile that reflects you',
    icon: ICONS.messageChatCircle,
  },
  {
    title: 'Pick a university, programme and scholarship',
    description:
      'Compare relevant universities, programmes and funding opportunities in one workspace.',
    outcome: 'A focused shortlist',
    icon: ICONS.search,
  },
  {
    title: 'Receive specialised reports',
    description: 'See your applicant profile and how well each option fits your direction.',
    outcome: 'Evidence-backed clarity',
    icon: ICONS.chartBreakoutSquare,
  },
  {
    title: 'Receive a personalised strategy',
    description: 'Turn your strengths, gaps and deadlines into an actionable plan.',
    outcome: 'Your next best actions',
    icon: ICONS.zap,
  },
  {
    title: 'Build your application, track progress and receive feedback',
    description:
      'Keep documents, progress and expert feedback connected as you move towards submission.',
    outcome: 'An application that keeps moving',
    icon: ICONS.messageSmileCircle,
  },
] as const;

const panelVariants = {
  enter: (direction: number) => ({ opacity: 0, x: direction * 28, scale: 0.985 }),
  center: { opacity: 1, x: 0, scale: 1 },
  exit: (direction: number) => ({ opacity: 0, x: direction * -20, scale: 0.99 }),
};

/** Five-step journey — selectable, auto-advancing and reduced-motion safe. */
export function HomeHowItWorks({ locale }: { locale?: Locale } = {}) {
  const { lang } = useLanguage();
  const activeLocale = locale ?? lang;
  const t = (value: string) => getLocaleText(activeLocale, value);
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [paused, setPaused] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const reducedMotion = prefersReducedMotion === true;
  const activeStep = STEPS[activeIndex] ?? STEPS[0];

  useEffect(() => {
    if (paused || reducedMotion) return;

    const timer = window.setTimeout(() => {
      setDirection(1);
      setActiveIndex((current) => (current + 1) % STEPS.length);
    }, AUTOPLAY_MS);

    return () => window.clearTimeout(timer);
  }, [activeIndex, paused, reducedMotion]);

  function selectStep(nextIndex: number, nextDirection?: number) {
    setDirection(nextDirection ?? (nextIndex >= activeIndex ? 1 : -1));
    setActiveIndex(nextIndex);
  }

  function previousStep() {
    selectStep((activeIndex - 1 + STEPS.length) % STEPS.length, -1);
  }

  function nextStep() {
    selectStep((activeIndex + 1) % STEPS.length, 1);
  }

  return (
    <Section
      padded={false}
      className="overflow-hidden py-gb-9xl"
      containerClassName="flex flex-col items-center gap-gb-7xl"
    >
      <div className="mx-auto flex max-w-[900px] flex-col items-center text-center">
        <GlowbalLogo height={32} />
        <h2 className="mt-gb-3xl font-display text-gb-display-sm font-semibold tracking-gb-display-tight text-fg md:text-gb-display-md">
          {t(
            'GlowBal is here to help you achieve your dream. From your first choice to a complete application strategy.',
          )}
        </h2>
        <p className="mt-gb-2xl max-w-[780px] text-gb-md leading-relaxed text-fg-tertiary md:text-gb-xl">
          {t(
            'GlowBal combines technology, data and team expertise to support you from discovering opportunities to completing your application strategy.',
          )}
        </p>
      </div>

      <div
        className="w-full max-w-[1120px]"
        onPointerEnter={() => setPaused(true)}
        onPointerLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={() => setPaused(false)}
      >
        <div className="relative">
          <div
            aria-hidden="true"
            className="absolute left-[10%] right-[10%] top-[27px] h-gb-xs overflow-hidden rounded-gb-full bg-line"
          >
            <motion.span
              className="block size-full origin-left rounded-gb-full bg-brand"
              initial={false}
              animate={{ scaleX: activeIndex / (STEPS.length - 1) }}
              transition={{ duration: reducedMotion ? 0 : 0.45, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>

          <ol className="relative grid grid-cols-5 gap-gb-xs md:gap-gb-xl">
            {STEPS.map((step, index) => {
              const active = index === activeIndex;
              const complete = index < activeIndex;

              return (
                <li key={step.title} className="min-w-0">
                  <button
                    type="button"
                    aria-pressed={active}
                    aria-label={`${index + 1}. ${t(step.title)}`}
                    onClick={() => selectStep(index)}
                    className="group flex w-full flex-col items-center rounded-gb-lg text-center focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
                  >
                    <span
                      className={`relative z-10 flex size-[56px] items-center justify-center rounded-gb-full border-4 font-display text-gb-md font-semibold shadow-gb-sm transition-[background-color,border-color,color,transform] duration-300 motion-reduce:transition-none ${
                        active
                          ? 'scale-110 border-brand-surface bg-brand text-white'
                          : complete
                            ? 'border-white bg-brand-subtle text-brand'
                            : 'border-white bg-surface-muted text-fg-muted group-hover:bg-brand-subtle group-hover:text-brand'
                      }`}
                    >
                      {active && !reducedMotion ? (
                        <span className="absolute inset-0 -z-10 animate-ping rounded-gb-full bg-brand/25" />
                      ) : null}
                      <KitIcon art={step.icon} frame={22} />
                    </span>
                    <span
                      className={`mt-gb-xl hidden text-gb-sm font-semibold leading-snug transition-colors md:block ${
                        active ? 'text-brand' : 'text-fg-secondary group-hover:text-fg'
                      }`}
                    >
                      {t(step.title)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="relative mt-gb-6xl min-h-[310px] sm:min-h-[260px]">
          <AnimatePresence initial={false} mode="wait" custom={direction}>
            <motion.article
              key={activeIndex}
              custom={direction}
              variants={panelVariants}
              initial={reducedMotion ? false : 'enter'}
              animate="center"
              exit="exit"
              transition={{ duration: reducedMotion ? 0 : 0.38, ease: [0.16, 1, 0.3, 1] }}
              aria-live="polite"
              className="relative min-h-[260px] overflow-hidden rounded-gb-2xl border border-white/10 bg-surface-inverse-strong p-gb-4xl text-white shadow-gb-lg md:p-gb-5xl"
            >
              <div
                aria-hidden="true"
                className="absolute -right-[80px] -top-[120px] size-[310px] rounded-gb-full border border-brand/25 bg-brand/10"
              />
              <div
                aria-hidden="true"
                className="absolute -bottom-[170px] left-[18%] size-[300px] rounded-gb-full bg-brand/15 blur-3xl"
              />

              <div className="relative grid items-center gap-gb-4xl md:grid-cols-[72px_minmax(0,1fr)_260px]">
                <span className="flex size-[72px] items-center justify-center rounded-gb-xl border border-white/15 bg-white/10 text-brand shadow-gb-sm backdrop-blur-sm">
                  <KitIcon art={activeStep.icon} frame={30} />
                </span>

                <div>
                  <p className="text-gb-sm font-semibold tracking-wide text-brand">
                    {String(activeIndex + 1).padStart(2, '0')} / {String(STEPS.length).padStart(2, '0')}
                  </p>
                  <h3 className="mt-gb-sm font-display text-gb-display-xs font-semibold md:text-gb-display-sm">
                    {t(activeStep.title)}
                  </h3>
                  <p className="mt-gb-lg max-w-[620px] text-gb-md leading-relaxed text-white/70 md:text-gb-lg">
                    {t(activeStep.description)}
                  </p>
                </div>

                <div className="rounded-gb-xl border border-white/10 bg-white/[0.07] p-gb-3xl backdrop-blur-sm">
                  <p className="text-gb-xs font-semibold uppercase tracking-[0.16em] text-brand">
                    {t('Journey outcome')}
                  </p>
                  <p className="mt-gb-md text-gb-lg font-semibold text-white">{t(activeStep.outcome)}</p>
                </div>
              </div>
            </motion.article>
          </AnimatePresence>
        </div>

        <div className="mt-gb-2xl flex items-center justify-between gap-gb-xl">
          <p className="text-gb-sm text-fg-muted">{t('Select a step or let the journey play.')}</p>
          <div className="flex items-center gap-gb-md">
            <button
              type="button"
              onClick={previousStep}
              aria-label={t('Previous step')}
              className="flex size-gb-5xl items-center justify-center rounded-gb-full border border-line bg-surface text-fg-secondary transition-colors hover:border-brand hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <KitIcon art={ICONS.arrowLeft} frame={20} />
            </button>
            <button
              type="button"
              onClick={nextStep}
              aria-label={t('Next step')}
              className="flex size-gb-5xl items-center justify-center rounded-gb-full bg-brand text-white transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <KitIcon art={ICONS.arrowRight} frame={20} />
            </button>
          </div>
        </div>
      </div>
    </Section>
  );
}
