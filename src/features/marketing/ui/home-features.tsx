import { CheckItem, CheckList, ICONS, KitIcon, Section } from '@/shared/ui';

/**
 * Features — Figma 375:9895: a centred header followed by three alternating
 * text-and-screen rows. The source frames are deliberately empty, so a demo is
 * rendered only when the corresponding local video has been configured below.
 */
export type FeatureDemoKey = 'matcher' | 'demoVideo2' | 'demoVideo3';

export type FeatureDemoVideo = {
  /** A path served from /public, for example `/home/features/matcher.mp4`. */
  readonly src: string;
  readonly type?: string;
  /** An optional still image shown before playback begins. */
  readonly poster?: string;
  /** An optional WebVTT captions file, served from /public. */
  readonly captionsSrc?: string;
  readonly captionsLabel?: string;
};

export type HomeFeatureDemoVideos = Partial<Record<FeatureDemoKey, FeatureDemoVideo>>;

/**
 * Add completed demo files to `public/home/features/`, then uncomment and
 * update these entries. Leaving a key out intentionally preserves Figma's
 * blank device frame until its video is ready.
 */
export const HOME_FEATURE_DEMO_VIDEOS: HomeFeatureDemoVideos = {
  // matcher: {
  //   src: '/home/features/matcher.mp4',
  //   poster: '/home/features/matcher-poster.jpg',
  //   captionsSrc: '/home/features/matcher.en.vtt',
  // },
  // demoVideo2: { src: '/home/features/demo-video-2.mp4' },
  // demoVideo3: { src: '/home/features/demo-video-3.mp4' },
};

type Block = {
  readonly node: string;
  readonly mediaNode: string;
  readonly demoKey: FeatureDemoKey;
  readonly title: string;
  readonly body: string;
  readonly checks: readonly string[];
  readonly media: 'right' | 'left';
};

const BLOCKS: readonly Block[] = [
  {
    node: '375:9904',
    mediaNode: '375:9915',
    demoKey: 'matcher',
    title: 'GlowBal Matcher',
    body:
      'Answer simple questions about you. With our G-Matching technology, we can pair you with the best future opportunity from:',
    checks: [
      '200+ top universities globally',
      '100+ different majors, even the rarest ones',
      '3000+ scholarships',
    ],
    media: 'right',
  },
  {
    node: '375:9919',
    mediaNode: '375:9918',
    demoKey: 'demoVideo2',
    title: 'Demo Video 2',
    body:
      'An all-in-one customer service platform that helps you balance everything your customers need to be happy.',
    checks: [
      'Keep your customers in the loop with live chat',
      'Embed help articles right on your website',
      'Customers never have to leave the page to find an answer',
    ],
    media: 'left',
  },
  {
    node: '375:9930',
    mediaNode: '375:9941',
    demoKey: 'demoVideo3',
    title: 'Demo Video 3',
    body:
      'Measure what matters with Untitled’s easy-to-use reports. You can filter, export, and drilldown on the data in a couple clicks.',
    checks: [
      'Filter, export, and drilldown on the data quickly',
      'Save, schedule, and automate reports to your inbox',
      'Connect the tools you already use with 100+ integrations',
    ],
    media: 'right',
  },
];

/**
 * The mockup is 762.98px wide inside a 560px column, so it runs past the
 * container on desktop. The parent section clips that intended Figma bleed.
 */
function BlockMedia({
  node,
  side,
  title,
  video,
}: {
  node: string;
  side: 'right' | 'left';
  title: string;
  video?: FeatureDemoVideo;
}) {
  return (
    <div className="relative w-full lg:h-[512px] lg:flex-1">
      <div
        className={`h-[280px] overflow-hidden rounded-[32px] border border-line bg-surface p-[3px] shadow-gb-lg lg:absolute lg:top-0 lg:h-full lg:w-[762.98px] lg:max-w-none ${
          side === 'right' ? 'lg:left-0' : 'lg:right-0'
        }`}
      >
        <div className="size-full rounded-[28px] border border-line bg-surface-muted p-[3px]">
          {video ? (
            <video
              className="size-full rounded-gb-xl bg-surface object-cover"
              aria-label={`${title} demo video`}
              controls
              playsInline
              preload="metadata"
              poster={video.poster}
            >
              <source src={video.src} type={video.type ?? 'video/mp4'} />
              {video.captionsSrc ? (
                <track
                  default
                  kind="captions"
                  src={video.captionsSrc}
                  srcLang="en"
                  label={video.captionsLabel ?? 'English'}
                />
              ) : null}
              Your browser does not support video playback.
            </video>
          ) : (
            <div className="size-full rounded-gb-xl bg-surface" data-figma-node={node} />
          )}
        </div>
      </div>
    </div>
  );
}

function FeatureBlock({ block, video }: { block: Block; video?: FeatureDemoVideo }) {
  return (
    <div
      className={`flex flex-col gap-gb-6xl lg:items-center lg:gap-gb-9xl ${
        block.media === 'right' ? 'lg:flex-row' : 'lg:flex-row-reverse'
      }`}
    >
      <div className="flex flex-col gap-gb-4xl lg:flex-1">
        <div className="flex flex-col gap-gb-2xl">
          <span className="flex size-[48px] shrink-0 items-center justify-center rounded-gb-full bg-brand-surface text-brand">
            <KitIcon art={ICONS.zapFast} frame={24} />
          </span>
          <div className="flex flex-col gap-gb-xl">
            <h3 className="font-display text-gb-display-sm font-semibold text-fg">{block.title}</h3>
            <p className="text-gb-lg text-fg-tertiary">{block.body}</p>
          </div>
        </div>

        <CheckList>
          {block.checks.map((check) => (
            <CheckItem key={check}>{check}</CheckItem>
          ))}
        </CheckList>
      </div>

      {video ? (
        <BlockMedia node={block.mediaNode} side={block.media} title={block.title} video={video} />
      ) : (
        <BlockMedia node={block.mediaNode} side={block.media} title={block.title} />
      )}
    </div>
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
      <div className="mx-auto flex w-full max-w-gb-width-xl flex-col items-center text-center">
        <div className="flex w-full flex-col gap-gb-lg">
          <p className="text-gb-md font-semibold text-brand">Features</p>
          <h2 className="font-display text-gb-display-md font-semibold tracking-gb-display-tight text-fg">
            Learn how GlowBal helps you find scholarships from A to Z with just two simple features
          </h2>
        </div>
      </div>

      {BLOCKS.map((block) => {
        const video = videos[block.demoKey];

        return video ? (
          <FeatureBlock key={block.node} block={block} video={video} />
        ) : (
          <FeatureBlock key={block.node} block={block} />
        );
      })}
    </Section>
  );
}
