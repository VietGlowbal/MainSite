import { CheckItem, CheckList, ICONS, KitIcon, Section } from '@/shared/ui';
import { MissingContent } from './missing-content';

/**
 * Features — Figma 104:7164 (1440x2220, white): a centred header followed by
 * three blocks that alternate text and a screen mockup.
 *
 * ⚠️ ONLY THE FIRST BLOCK HAS BEEN WRITTEN. Blocks two and three (104:7188,
 * 104:7199) are Untitled UI's demo copy about live chat and exportable reports,
 * one sentence of which reads "Measure what matters with Untitled's
 * easy-to-use reports". Their headings — "Demo Video 2", "Demo Video 3" — are
 * the designer's own placeholders and are kept, because they say plainly what
 * the slots are for. Everything else is marked with `MissingContent` rather
 * than guessed at.
 *
 * ⚠️ ALL THREE MOCKUPS ARE EMPTY. The "Modern screen mockup" instance is a bare
 * device frame with no screenshot in it, and its PNG export comes back clipped
 * to 681x529 for a node Figma reports as 762.98x512 — so the frame is rebuilt
 * here at the design's real geometry instead of shipping a broken asset.
 *
 * ⚠️ BLOCK ONE CONTRADICTS THE HERO. It claims "200+ top universities"; the
 * hero, rebuilt from 375:9857, now claims 300+. (It used to claim 10,000, so
 * the gap has narrowed, but it is still a gap.) Both are reproduced as written —
 * resolving them is a copy decision, raised with the owner on 28/07.
 *
 * `showPlaceholders` is how this section reaches "/" without shipping dashed
 * boxes to real visitors: false renders only the blocks whose copy exists and
 * drops the mockup frames, which have no asset behind them for ANY block. The
 * preview at /dev/home leaves it true so the gap stays visible to us. Delete the
 * prop once blocks two and three are written and the mockups are exported.
 */

type Block = {
  /** Figma node for the text column, so a reviewer can find it. */
  readonly node: string;
  readonly mediaNode: string;
  readonly title: string;
  /** null when the design still holds kit filler. */
  readonly body: string | null;
  readonly checks: readonly string[] | null;
  /** Which side the mockup sits on, and therefore which way it bleeds. */
  readonly media: 'right' | 'left';
};

const BLOCKS: readonly Block[] = [
  {
    node: '104:7173',
    mediaNode: '104:7184',
    title: 'GlowBal Matcher',
    body: 'Answer simple questions about you. With our G-Matching technology, we can pair you with the best future opportunity from:',
    // The design's first and third items each begin with a stray space; trimmed.
    checks: [
      '200+ top universities globally',
      '100+ different majors, even the rarest ones',
      '3000+ scholarships',
    ],
    media: 'right',
  },
  { node: '104:7188', mediaNode: '104:7187', title: 'Demo Video 2', body: null, checks: null, media: 'left' },
  { node: '104:7199', mediaNode: '104:7210', title: 'Demo Video 3', body: null, checks: null, media: 'right' },
];

/**
 * The mockup is 762.98px wide inside a 560px column, so it always runs past the
 * container — right on the odd blocks, left on the even one. Figma clips that
 * at the 1440 frame edge, which is what `overflow-hidden` on the section does
 * here. Without it the bleed becomes a horizontal scrollbar on any viewport
 * narrower than about 1850px.
 */
function BlockMedia({ node, side }: { node: string; side: 'right' | 'left' }) {
  return (
    <div className="relative w-full lg:h-[512px] lg:flex-1">
      <div
        className={`flex h-[280px] items-center justify-center rounded-gb-xl border border-line bg-surface-muted lg:absolute lg:top-0 lg:h-full lg:w-[762.98px] lg:max-w-none ${
          side === 'right' ? 'lg:left-0' : 'lg:right-0'
        }`}
      >
        <MissingContent node={node} label="Ảnh hoặc video demo" />
      </div>
    </div>
  );
}

function FeatureBlock({
  block,
  showPlaceholders,
}: {
  block: Block;
  showPlaceholders: boolean;
}) {
  return (
    <div
      className={`flex flex-col gap-gb-6xl lg:items-center lg:gap-gb-9xl ${
        block.media === 'right' ? 'lg:flex-row' : 'lg:flex-row-reverse'
      }`}
    >
      {/* Text first in the DOM in both directions: on a phone the copy should
          lead, and the swap is presentation only. */}
      <div className="flex flex-col gap-gb-4xl lg:flex-1">
        <div className="flex flex-col gap-gb-2xl">
          <span className="flex size-[48px] shrink-0 items-center justify-center rounded-gb-full bg-brand-surface text-brand">
            <KitIcon art={ICONS.zapFast} frame={24} />
          </span>
          <div className="flex flex-col gap-gb-xl">
            <h3 className="font-display text-gb-display-sm font-semibold text-fg">{block.title}</h3>
            {block.body ? (
              <p className="text-gb-lg text-fg-tertiary">{block.body}</p>
            ) : (
              <MissingContent node={block.node} label="Đoạn mô tả tính năng" />
            )}
          </div>
        </div>

        {block.checks ? (
          <CheckList>
            {block.checks.map((check) => (
              <CheckItem key={check}>{check}</CheckItem>
            ))}
          </CheckList>
        ) : (
          <MissingContent node={block.node} label="Ba gạch đầu dòng" className="ml-gb-xl" />
        )}
      </div>

      {showPlaceholders ? <BlockMedia node={block.mediaNode} side={block.media} /> : null}
    </div>
  );
}

function isComplete(block: Block): boolean {
  return block.body != null && block.checks != null;
}

export function HomeFeatures({ showPlaceholders = true }: { showPlaceholders?: boolean } = {}) {
  const blocks = showPlaceholders ? BLOCKS : BLOCKS.filter(isComplete);

  return (
    <Section
      padded={false}
      className="overflow-hidden py-gb-9xl"
      containerClassName="flex flex-col gap-gb-9xl"
    >
      <div className="mx-auto flex w-full max-w-gb-width-xl flex-col items-center gap-gb-2xl text-center">
        <div className="flex w-full flex-col gap-gb-lg">
          <p className="text-gb-md font-semibold text-brand">Features</p>
          <h2 className="font-display text-gb-display-md font-semibold tracking-gb-display-tight text-fg">
            See the scholarships tied to the university you picked
          </h2>
        </div>
        <p className="text-gb-xl text-fg-tertiary">
          Browse a free preview. Create your profile to unlock the full eligibility rules, the
          documents you need, and to save opportunities into your plan.
        </p>
      </div>

      {blocks.map((block) => (
        <FeatureBlock key={block.node} block={block} showPlaceholders={showPlaceholders} />
      ))}
    </Section>
  );
}
