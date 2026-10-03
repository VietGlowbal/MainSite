import { CheckItem, CheckList, GlowbalIcon, type GlowbalIconName } from '@/shared/ui';
import { HomeDemoVideo, type FeatureDemoVideo } from './home-demo-video';
import { getLocaleText, type Locale } from '@/lib/i18n/locale';
import { highlightPhrases } from './home-highlight';

export type { FeatureDemoSource, FeatureDemoVideo } from './home-demo-video';

export type FeatureDemoKey = 'matcher' | 'strategyMaster';

export type HomeFeatureDemoVideos = Partial<Record<FeatureDemoKey, FeatureDemoVideo>>;

/**
 * Put the finished files in public/home/features, then enable the matching
 * entry below. Recommended delivery per demo:
 *   - 1080p WebM (preferred codec/size)
 *   - 1080p H.264 MP4 (Safari and broad fallback)
 *   - 1280px-wide 16:10 WebP poster
 *   - optional WebVTT captions, and the duration for the poster chip
 *
 * The click-to-load player does not request either video source until Play.
 * Until a file exists, the block shows the animated product mock instead.
 */
export const HOME_FEATURE_DEMO_VIDEOS: HomeFeatureDemoVideos = {
  // matcher: {
  //   sources: [
  //     { src: '/home/features/glowbal-matcher.webm', type: 'video/webm' },
  //     { src: '/home/features/glowbal-matcher.mp4', type: 'video/mp4' },
  //   ],
  //   poster: '/home/features/glowbal-matcher-poster.webp',
  //   captionsSrc: '/home/features/glowbal-matcher.en.vtt',
  //   duration: '1:24',
  // },
};

/**
 * Product features — sales-journey handoff §7.
 *
 * The supporting-tools strip under the two blocks is the handoff's PROPOSAL:
 * one short row, scrolling sideways on a phone rather than stacking, so it can
 * never make the section taller than a row.
 */

type Block = {
  readonly demoKey: FeatureDemoKey;
  readonly icon: GlowbalIconName;
  readonly title: string;
  readonly lead: string;
  readonly body: string;
  readonly checks: readonly string[];
  /** Text first on every width; media right (desktop) for the first block, left for the second. */
  readonly media: 'right' | 'left';
  /** The fallback mock's chip. */
  readonly chip: string;
  /** Bar heights (%) in the fallback mock. */
  readonly bars: readonly [number, number, number];
};

const BLOCKS: readonly Block[] = [
  {
    demoKey: 'matcher',
    icon: 'matchingReport',
    title: 'GlowBal Matcher',
    lead: 'Find what fits you, not simply what is famous.',
    body:
      'Answer a few questions about your goals, strengths and direction. GlowBal Matcher helps you discover universities and scholarships worth exploring further.',
    checks: [
      'Personalised recommendations',
      'University and scholarship discovery',
      'Save promising opportunities',
    ],
    media: 'right',
    chip: '92% fit',
    bars: [55, 90, 70],
  },
  {
    demoKey: 'strategyMaster',
    icon: 'strategyMaster',
    // Content PDF (3) §7 names this row "GlowBal AI"; Strategy Master is the
    // product area its four reports live in, so the body keeps that name.
    title: 'GlowBal AI',
    lead: 'Finding the right option is only the beginning.',
    body:
      'With Strategy Master, GlowBal AI helps you understand your profile, evaluate your fit and turn your study-abroad goals into an actionable strategy.',
    checks: [
      'Applicant Personal Report',
      'GlowBal Matching Report',
      'Personalised Strategy',
      'Application Planner',
    ],
    media: 'left',
    chip: 'On track',
    bars: [70, 48, 92],
  },
];

const TOOLS: ReadonlyArray<{ readonly icon: GlowbalIconName; readonly name: string; readonly line: string }> = [
  { icon: 'applicationPlanner', name: 'Planner', line: 'Every deadline and task on one timeline.' },
  { icon: 'essaySupport', name: 'SOP review', line: 'Feedback on your statement of purpose.' },
  { icon: 'cvSupport', name: 'CV review', line: 'Sharpen your CV for each programme.' },
];

/** The animated product mock shown until a demo video exists. Decorative. */
function DemoFallback({ block, locale }: { block: Block; locale: Locale }) {
  return (
    <div aria-hidden="true" className="flex size-full flex-col gap-[4%] p-[5%]">
      <div className="flex items-center justify-between border-b border-line pb-[3%]">
        <span data-no-auto-translate className="font-display text-[15px] font-semibold leading-[22px] text-fg">
          {block.title}
        </span>
        <span className="inline-flex items-center gap-gb-sm text-gb-xs font-medium text-fg-tertiary">
          <span className="size-gb-sm rounded-gb-full bg-brand" />
          {getLocaleText(locale, 'Live preview')}
        </span>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[1fr_1.8fr] gap-[4%]">
        <div className="flex flex-col gap-gb-md rounded-gb-md border border-line bg-surface p-[8%]">
          {[70, 55, 62, 40].map((width) => (
            <span key={width} className="h-[6px] rounded-gb-xs bg-line" style={{ width: `${width}%` }} />
          ))}
        </div>
        <div className="flex min-h-0 flex-col gap-[6%] rounded-gb-md border border-line bg-surface p-[5%]">
          <div className="flex items-center justify-between gap-gb-md">
            <span className="h-gb-md w-1/2 rounded-gb-xs bg-line" />
            <span className="whitespace-nowrap rounded-gb-full bg-brand-subtle px-gb-md py-gb-xxs text-gb-xs font-semibold text-fg-brand">
              {getLocaleText(locale, block.chip)}
            </span>
          </div>
          <div className="flex min-h-0 flex-1 items-end gap-gb-sm">
            {block.bars.map((height, index) => (
              <span
                key={`${height}-${index}`}
                className="flex-1 origin-bottom animate-gb-bar-breathe rounded-t-gb-xs bg-gb-brand-500 motion-reduce:animate-none"
                style={{ height: `${height}%`, animationDuration: `${2600 + index * 240}ms` }}
              />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-gb-sm">
            {[0, 1, 2].map((tile) => (
              <span key={tile} className="h-gb-2xl rounded-gb-sm border border-line bg-surface-muted" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureBlock({
  block,
  video,
  locale,
}: {
  block: Block;
  video: FeatureDemoVideo | undefined;
  locale: Locale;
}) {
  return (
    <article className="grid items-center gap-x-gb-7xl gap-y-gb-6xl md:grid-cols-2">
      <div className={`min-w-0 ${block.media === 'left' ? 'md:order-2' : ''}`}>
        <span className="flex size-gb-6xl items-center justify-center rounded-gb-full bg-brand-surface">
          <GlowbalIcon name={block.icon} size={24} />
        </span>
        <h3 className="mt-gb-2xl font-display text-gb-display-xs font-medium tracking-gb-display-tight text-fg md:text-gb-display-sm">
          {getLocaleText(locale, block.title)}
        </h3>
        <p className="mt-gb-xl text-gb-lg font-semibold text-gb-neutral-900">{getLocaleText(locale, block.lead)}</p>
        <p className="mt-gb-md text-gb-md leading-[26px] text-fg-tertiary">{getLocaleText(locale, block.body)}</p>

        <div className="mt-gb-3xl">
          <CheckList>
            {block.checks.map((check) => (
              <CheckItem key={check}>{getLocaleText(locale, check)}</CheckItem>
            ))}
          </CheckList>
        </div>

      </div>

      <div
        className={`relative aspect-[16/10] min-w-0 overflow-hidden rounded-gb-xl border border-line bg-surface-muted shadow-gb-lg ${
          block.media === 'left' ? 'md:order-1' : ''
        }`}
      >
        {video ? (
          <HomeDemoVideo title={getLocaleText(locale, block.title)} video={video} locale={locale} />
        ) : (
          <DemoFallback block={block} locale={locale} />
        )}
      </div>
    </article>
  );
}

export function HomeFeatures({
  videos = HOME_FEATURE_DEMO_VIDEOS,
  locale = 'en',
}: {
  videos?: HomeFeatureDemoVideos;
  locale?: Locale;
} = {}) {
  return (
    /* Rose-50 fading to white — the last of the ramp's three light bands, so
       the page turns white exactly where GlowBal Packages begins (tokens.css,
       `--gb-home-band-features`). */
    <section
      id="features"
      className="scroll-mt-gb-9xl overflow-hidden bg-[image:var(--gb-home-band-features)] py-gb-7xl text-fg md:py-gb-9xl"
    >
      <div className="mx-auto w-full max-w-gb-desktop px-gb-xl md:px-gb-4xl">
        <div className="mx-auto max-w-gb-width-xl text-center">
          {/* fg-brand (rose-700), not brand (rose-600): on the rose-50 top of
              this band rose-600 is 4.3:1, under the 4.5:1 needed at 16px. */}
          <p className="text-gb-md font-semibold text-fg-brand">{getLocaleText(locale, 'Features')}</p>
          <h2 className="mt-gb-lg text-balance font-display text-gb-display-sm font-semibold tracking-gb-display-tight text-fg md:text-gb-display-md">
            {highlightPhrases(
              getLocaleText(locale, 'Two tools. One clearer decision.'),
              [getLocaleText(locale, 'One clearer decision.')],
              'light',
            )}
          </h2>
        </div>

        <div className="mt-gb-7xl flex flex-col gap-gb-9xl">
          {BLOCKS.map((block) => (
            <FeatureBlock key={block.demoKey} block={block} video={videos[block.demoKey]} locale={locale} />
          ))}
        </div>

        <ul className="-mx-gb-xl mt-gb-7xl flex gap-gb-xl overflow-x-auto px-gb-xl [scrollbar-width:none] md:mx-0 md:px-0">
          {TOOLS.map((tool) => (
            <li
              key={tool.name}
              className="flex flex-[1_0_260px] items-center gap-gb-lg rounded-gb-xl border border-line bg-surface p-gb-xl"
            >
              <span className="flex size-gb-5xl shrink-0 items-center justify-center rounded-gb-full bg-brand-subtle">
                <GlowbalIcon name={tool.icon} size={20} />
              </span>
              <div>
                <p className="text-gb-sm font-semibold text-fg">{getLocaleText(locale, tool.name)}</p>
                <p className="text-gb-sm text-fg-tertiary">{getLocaleText(locale, tool.line)}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
