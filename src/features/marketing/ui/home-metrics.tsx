import { ICONS, KitIcon, Section } from '@/shared/ui';
import { HomeMetricsGrid } from './home-metrics-grid';
import { getLocaleText, type Locale } from '@/lib/i18n/locale';

/**
 * Metrics — Figma 375:9879 (1440x508, white) on the "Khanh Linh - Chi" canvas.
 *
 * THE DESIGNER HAS NOW FILLED THIS IN. The previous version of this frame still
 * carried Untitled UI's demo content ("400+ Projects completed", "Global
 * downloads" twice over), so the numbers here used to be the hero's catalogue
 * counts restated. They are not any more: the frame supplies five real figures,
 * and they measure ADOPTION, not catalogue size. Nothing here is derived from
 * the hero now, and the two sections no longer say the same thing twice.
 *
 * ⚠️ EVERY ONE OF THESE IS A PUBLIC CLAIM ABOUT THE COMPANY, and this section
 * ships on "/". "$2000 — Đầu tư từ quỹ Venture X" names an outside investor;
 * the other four state usage the product has not launched to earn. They are the
 * designer's own numbers, taken from the frame rather than invented here, but
 * they have not been separately confirmed as true. Raised with the owner on
 * 28/07. If any is wrong, it is one line in the metric list.
 *
 * Copy stays English and is translated by the dictionary, same as the hero.
 * The presentation is intentionally more alive than the original flat row:
 * values count up once in view, a progress rule draws beneath them, and each
 * card carries a pointer-following brand glow. That interaction stays in a
 * small client boundary so this heading and its copy remain server-rendered.
 */
export function HomeMetrics({ locale = 'en' }: { locale?: Locale } = {}) {
  return (
    <Section
      padded={false}
      className="relative overflow-hidden py-gb-9xl"
      containerClassName="relative flex flex-col items-center gap-gb-7xl"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-[12%] top-gb-9xl size-[360px] rounded-gb-full bg-brand-subtle opacity-70 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-[10%] bottom-0 size-[300px] rounded-gb-full bg-brand-surface opacity-40 blur-3xl"
      />

      <div className="flex w-full max-w-gb-width-xl flex-col items-center gap-gb-2xl">
        <div className="flex flex-col items-center gap-gb-3xl">
          {/* 56px is the kit component's own size, not a step on the spacing
              scale — the 28px icon sits on a 14px inset all round. */}
          <span className="flex size-[56px] items-center justify-center rounded-gb-full bg-brand-surface text-brand">
            <KitIcon art={ICONS.zapFast} frame={28} />
          </span>
          <h2 className="text-center font-display text-gb-display-md font-semibold tracking-gb-display-open text-fg">
            {getLocaleText(locale, 'Standout numbers')}
          </h2>
        </div>
        {/* A quotation in the frame, quotation marks included. Written as a JS
            string, not JSX text: the straight quotes have to survive into the
            DOM character-for-character or DomTranslator will not match the
            dictionary key, and as bare JSX text they would need entities. */}
        <p className="text-center text-gb-xl text-fg-tertiary">
          {getLocaleText(locale, '"GlowBal has shown how much it invests in product quality, and how well it answers what the market actually needs"')}
        </p>
      </div>

      <HomeMetricsGrid locale={locale} />
    </Section>
  );
}
