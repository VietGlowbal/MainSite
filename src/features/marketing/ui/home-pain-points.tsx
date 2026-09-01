import { ICONS, KitIcon, Section } from '@/shared/ui';
import { getLocaleText, type Locale } from '@/lib/i18n/locale';

const PAIN_POINTS = [
  {
    icon: ICONS.messageChatCircle,
    title: 'Want to study abroad, but feel lost among the choices',
    body: 'There is too much information, but no clear direction.',
  },
  {
    icon: ICONS.zap,
    title: 'Found a university you love, but not a strong enough scholarship',
    body:
      'The best scholarships are often hidden in closed groups and networks — and winning one can feel impossible without the right support.',
  },
  {
    icon: ICONS.chartBreakoutSquare,
    title: 'Lack clear guidance and strategy',
    body:
      'You do not know how to tell your story and present both strengths and weaknesses in an application that wins over the admissions committee.',
  },
  {
    icon: ICONS.messageSmileCircle,
    title: 'Have no one truly supporting you',
    body:
      'The experts around you are busy, while you need support with even the smallest details.',
  },
] as const;

/** Pain-point bridge — Figma 884:12064, expanded to include all Home.md copy. */
export function HomePainPoints({ locale = 'en' }: { locale?: Locale } = {}) {
  return (
    <Section
      tone="dark"
      padded={false}
      className="overflow-hidden py-gb-9xl"
      containerClassName="flex flex-col gap-gb-6xl"
    >
      <div className="mx-auto flex max-w-gb-width-xl flex-col items-center text-center">
        <span className="flex size-[48px] items-center justify-center rounded-gb-full bg-brand/15 text-brand">
          <KitIcon art={ICONS.zapFast} frame={24} />
        </span>
        <p className="mt-gb-xl text-gb-md font-semibold text-brand">{getLocaleText(locale, 'Have you ever?')}</p>
        <h2 className="mt-gb-lg font-display text-gb-display-sm font-semibold md:text-gb-display-md">
          {getLocaleText(locale, 'A study-abroad dream, but no clear path forward')}
        </h2>
      </div>

      <div className="-mx-gb-xl overflow-x-auto px-gb-xl pb-gb-lg [scrollbar-width:none] md:-mx-gb-4xl md:px-gb-4xl [&::-webkit-scrollbar]:hidden">
        <div className="mx-auto flex w-max max-w-none snap-x snap-mandatory gap-gb-3xl lg:grid lg:w-full lg:max-w-gb-desktop lg:grid-cols-4">
          {PAIN_POINTS.map((point, index) => (
            <article
              key={point.title}
              className="group flex w-[82vw] max-w-[340px] snap-center flex-col rounded-gb-xl border border-white/10 bg-white/[0.055] p-gb-4xl transition-colors hover:border-brand/50 hover:bg-white/[0.08] lg:w-auto"
            >
              <div className="flex items-center justify-between">
                <span className="flex size-[44px] items-center justify-center rounded-gb-full bg-brand text-white transition-transform group-hover:-translate-y-gb-xs">
                  <KitIcon art={point.icon} frame={22} />
                </span>
                <span className="font-display text-gb-display-xs font-semibold text-white/20">
                  {String(index + 1).padStart(2, '0')}
                </span>
              </div>
              <h3 className="mt-gb-4xl font-display text-gb-xl font-semibold text-white">
                {getLocaleText(locale, point.title)}
              </h3>
              <p className="mt-gb-lg text-gb-md leading-relaxed text-white/65">{getLocaleText(locale, point.body)}</p>
            </article>
          ))}
        </div>
      </div>
    </Section>
  );
}
