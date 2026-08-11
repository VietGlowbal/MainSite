import { Button, CheckItem, CheckList, ICONS, KitIcon, Section } from '@/shared/ui';
import {
  HomeDemoVideo,
  type FeatureDemoVideo,
} from './home-demo-video';
import { T } from '@/lib/i18n';

export type { FeatureDemoSource, FeatureDemoVideo } from './home-demo-video';

export type FeatureDemoKey = 'matcher' | 'strategyMaster';

export type HomeFeatureDemoVideos = Partial<Record<FeatureDemoKey, FeatureDemoVideo>>;

/**
 * Put the finished files in public/home/features, then enable the matching
 * entry below. Recommended delivery per demo:
 *   - 1080p WebM (preferred codec/size)
 *   - 1080p H.264 MP4 (Safari and broad fallback)
 *   - 1280px-wide 16:10 WebP poster
 *   - optional WebVTT captions
 *
 * The click-to-load player does not request either video source until Play.
 */
export const HOME_FEATURE_DEMO_VIDEOS: HomeFeatureDemoVideos = {
  // matcher: {
  //   sources: [
  //     { src: '/home/features/glowbal-matcher.webm', type: 'video/webm' },
  //     { src: '/home/features/glowbal-matcher.mp4', type: 'video/mp4' },
  //   ],
  //   poster: '/home/features/glowbal-matcher-poster.webp',
  //   captionsSrc: '/home/features/glowbal-matcher.en.vtt',
  // },
  // strategyMaster: {
  //   sources: [
  //     { src: '/home/features/strategy-master.webm', type: 'video/webm' },
  //     { src: '/home/features/strategy-master.mp4', type: 'video/mp4' },
  //   ],
  //   poster: '/home/features/strategy-master-poster.webp',
  //   captionsSrc: '/home/features/strategy-master.en.vtt',
  // },
};

type Block = {
  readonly demoKey: FeatureDemoKey;
  readonly title: string;
  readonly lead: string;
  readonly body: string;
  readonly checks: readonly string[];
  readonly action: string;
  readonly href: string;
  readonly media: 'right' | 'left';
};

const BLOCKS: readonly Block[] = [
  {
    demoKey: 'matcher',
    title: 'GlowBal Matcher',
    lead: 'Find what fits you, not simply what is famous.',
    body:
      'Answer a few questions about your goals, strengths and direction. GlowBal Matcher helps you discover universities and scholarships worth exploring further.',
    checks: [
      'Personalised recommendations',
      'University and scholarship discovery',
      'Save promising opportunities',
    ],
    action: 'Discover your matches',
    href: '/start',
    media: 'right',
  },
  {
    demoKey: 'strategyMaster',
    title: 'Strategy Master',
    lead: 'Finding the right option is only the beginning.',
    body:
      'Strategy Master helps you understand your profile, evaluate your fit and turn your study-abroad goals into an actionable strategy.',
    checks: [
      'Applicant Personal Report',
      'GlowBal Matching Report',
      'Personalised Strategy',
      'Application Planner',
    ],
    action: 'Build my strategy',
    href: '/ai-strategy',
    media: 'left',
  },
];

function DemoFallback({ block }: { block: Block }) {
  const isMatcher = block.demoKey === 'matcher';

  return (
    <div className="flex size-full flex-col bg-surface-muted p-gb-xl sm:p-gb-3xl">
      <div className="flex items-center justify-between border-b border-line pb-gb-xl">
        <span data-no-auto-translate className="font-display text-gb-md font-semibold text-fg">
          <T k={block.title} />
        </span>
        <span className="flex items-center gap-gb-xs text-gb-xs font-semibold text-fg-muted">
          <span className="size-gb-sm rounded-gb-full bg-brand" /> Live preview
        </span>
      </div>
      <div className="grid min-h-0 flex-1 gap-gb-xl pt-gb-xl sm:grid-cols-[0.7fr_1.3fr]">
        <div className="hidden flex-col gap-gb-md rounded-gb-lg border border-line bg-surface p-gb-xl sm:flex">
          {[72, 54, 62, 44].map((width) => (
            <span
              key={width}
              className="h-gb-md rounded-gb-full bg-surface-muted"
              style={{ width: `${width}%` }}
            />
          ))}
        </div>
        <div className="flex min-h-0 flex-col gap-gb-lg rounded-gb-lg border border-line bg-surface p-gb-xl shadow-gb-xs">
          <div className="flex items-center justify-between">
            <span className="h-gb-lg w-1/2 rounded-gb-full bg-fg/10" />
            <span className="rounded-gb-full bg-brand-surface px-gb-md py-gb-xs text-gb-xs font-semibold text-brand">
              {isMatcher ? '92% fit' : 'On track'}
            </span>
          </div>
          <div className="grid flex-1 grid-cols-3 items-end gap-gb-md">
            {[isMatcher ? 58 : 72, isMatcher ? 86 : 48, isMatcher ? 70 : 92].map((height, index) => (
              <span
                key={`${height}-${index}`}
                className="rounded-t-gb-md bg-brand/80"
                style={{ height: `${height}%` }}
              />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-gb-md">
            {[0, 1, 2].map((item) => (
              <span key={item} className="h-gb-4xl rounded-gb-md bg-surface-muted" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function BlockMedia({
  block,
  video,
}: {
  block: Block;
  video: FeatureDemoVideo | undefined;
}) {
  return (
    <div className="w-full lg:flex-1">
      <div className="aspect-[16/10] overflow-hidden rounded-[32px] border border-line bg-surface p-[4px] shadow-gb-lg">
        <div className="size-full overflow-hidden rounded-[27px] border border-line bg-surface">
          {video ? (
            <HomeDemoVideo title={block.title} video={video} />
          ) : (
            <DemoFallback block={block} />
          )}
        </div>
      </div>
    </div>
  );
}

function FeatureBlock({
  block,
  video,
}: {
  block: Block;
  video: FeatureDemoVideo | undefined;
}) {
  return (
    <article
      className={`flex flex-col gap-gb-6xl lg:items-center lg:gap-gb-8xl ${
        block.media === 'right' ? 'lg:flex-row' : 'lg:flex-row-reverse'
      }`}
    >
      <div className="flex flex-col gap-gb-4xl lg:flex-1">
        <div>
          <span className="flex size-[48px] items-center justify-center rounded-gb-full bg-brand-surface text-brand">
            <KitIcon art={ICONS.zapFast} frame={24} />
          </span>
          <h3 className="mt-gb-2xl font-display text-gb-display-sm font-semibold text-fg">
            {block.title}
          </h3>
          <p className="mt-gb-lg text-gb-lg font-semibold text-fg-secondary">{block.lead}</p>
          <p className="mt-gb-md text-gb-md leading-relaxed text-fg-tertiary">{block.body}</p>
        </div>

        <CheckList>
          {block.checks.map((check) => (
            <CheckItem key={check}>{check}</CheckItem>
          ))}
        </CheckList>

        <div>
          <Button href={block.href} size="xl">
            {block.action}
          </Button>
        </div>
      </div>

      <BlockMedia block={block} video={video} />
    </article>
  );
}

export function HomeFeatures({
  videos = HOME_FEATURE_DEMO_VIDEOS,
}: {
  videos?: HomeFeatureDemoVideos;
} = {}) {
  return (
    <Section
      padded={false}
      className="overflow-hidden py-gb-9xl"
      containerClassName="flex flex-col gap-gb-9xl"
    >
      <div className="mx-auto max-w-gb-width-xl text-center">
        <p className="text-gb-md font-semibold text-brand">Features</p>
        <h2 className="mt-gb-lg font-display text-gb-display-sm font-semibold tracking-gb-display-tight text-fg md:text-gb-display-md">
          Learn how GlowBal helps you find scholarships from A to Z with just two simple features
        </h2>
      </div>

      {BLOCKS.map((block) => (
        <FeatureBlock key={block.demoKey} block={block} video={videos[block.demoKey]} />
      ))}
    </Section>
  );
}
