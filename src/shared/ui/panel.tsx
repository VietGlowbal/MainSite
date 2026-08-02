import Link from 'next/link';
import { ICONS, KitIcon } from './icons';

/**
 * Panel / PanelHeader / StatTile — the surface grammar of the two signed-in
 * consoles, /profile and /admin.
 *
 * ⚠️ NO FIGMA SOURCE, and that is deliberate rather than an omission. Neither
 * console is drawn anywhere in the redesign file; the owner asked for them to
 * be rebuilt against the token system instead of against a frame. That puts
 * these in the same standing as ProgressBar, ScoreRing and the error ramp:
 * product decisions, recorded in one place so a future frame is a one-file
 * change.
 *
 * They exist because the alternative is real. Between the two consoles there
 * are around thirty cards, seventeen stat tiles and a dozen card headings; hand
 * writing `rounded-gb-2xl border border-line bg-surface` at each one is thirty
 * chances for the radius, the border colour or the padding step to drift, and
 * that drift is exactly what made the pages they replace look unrelated to the
 * rest of the site.
 *
 * NOTHING NEW AT THE TOKEN LAYER. Every value below already exists in
 * tokens.css. If one of these needs a colour the tokens do not have, that is a
 * question for the designer, not a literal to add here.
 */

const PADDING = {
  /** Sidebar cards and table wrappers. */
  sm: 'p-gb-2xl',
  /** The default: matches the document/upload panels that already shipped. */
  md: 'p-gb-3xl',
  /** For a panel whose child owns the inset — a full-bleed table. */
  none: '',
} as const;

export type PanelPadding = keyof typeof PADDING;

/**
 * Whether the card lifts off the page.
 *
 * `raised` is the console default and stays the default, so /profile and /admin
 * are untouched. `flat` exists for the Application Strategy workspace, whose
 * design rules call for "flat, restrained cards" and "minimal or no shadow"
 * explicitly — those screens put ten or more panels on one page, and at that
 * density the shadow reads as noise rather than as hierarchy.
 *
 * A variant here rather than a second Panel component in the feature: two cards
 * with the same radius, border and padding but independent implementations is
 * how the border colour ends up different on one page.
 */
const ELEVATION = {
  raised: ' shadow-gb-xs',
  flat: '',
} as const;

export type PanelElevation = keyof typeof ELEVATION;

const PANEL_BASE = 'rounded-gb-2xl border border-line bg-surface';

export function Panel({
  padding = 'md',
  elevation = 'raised',
  as: Tag = 'div',
  className,
  children,
}: {
  padding?: PanelPadding | undefined;
  elevation?: PanelElevation | undefined;
  /**
   * The element to render. A panel that is one of a list of workspace cards is
   * an `li`; one that is a labelled region of a page is a `section`. Neither is
   * a decision this component can make for its caller.
   */
  as?: 'div' | 'section' | 'article' | 'li' | undefined;
  className?: string | undefined;
  children: React.ReactNode;
}) {
  const classes = `${PANEL_BASE}${ELEVATION[elevation]} ${PADDING[padding]}${className ? ` ${className}` : ''}`;
  return <Tag className={classes}>{children}</Tag>;
}

/**
 * The title / supporting-text / action row at the top of a panel.
 *
 * `as` exists because heading level is a document-structure decision the panel
 * cannot make for itself: the same card is an `h2` on a page whose only other
 * heading is the `h1`, and an `h3` inside a section that already has one.
 */
export function PanelHeader({
  title,
  description,
  action,
  as: Heading = 'h2',
}: {
  title: string;
  description?: string | undefined;
  action?: React.ReactNode;
  as?: 'h2' | 'h3' | undefined;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-gb-lg">
      <div className="flex min-w-0 flex-col gap-gb-xxs">
        <Heading className="text-gb-md font-semibold text-fg">{title}</Heading>
        {description ? <p className="text-gb-sm text-fg-tertiary">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/**
 * A single figure with its caption — queue depths, revenue, user counts.
 *
 * NOT `Metric`. That one is the marketing row's 48px display number in brand
 * rose, sized to five across a 1204px band; a console packs three to five of
 * these into a sidebar or a narrow grid, where 48px wraps and takes its label
 * with it. This is the same idea at `display-xs`, with a tone that carries
 * meaning rather than brand.
 *
 * `tone` is the semantic of the number, not decoration: `brand` for a queue
 * that wants an admin's attention, `safe` for money banked or work finished,
 * `info` for something in flight. Default is plain foreground — most counts are
 * just counts, and colouring all of them makes none of them mean anything.
 */
export type StatTone = 'default' | 'brand' | 'safe' | 'info';

const STAT_TONE: Record<StatTone, string> = {
  default: 'text-fg',
  brand: 'text-brand',
  safe: 'text-on-tier-safe',
  info: 'text-fg-info',
};

export function StatTile({
  label,
  value,
  hint,
  href,
  tone = 'default',
}: {
  label: string;
  /** Pre-formatted. A tile does not know whether a number is a count or ₫. */
  value: string | number;
  hint?: string | undefined;
  /** Renders the tile as a link with a trailing arrow. */
  href?: string | undefined;
  tone?: StatTone | undefined;
}) {
  /*
   * A zero never takes the tone, whatever the caller asked for. The tone says
   * "look at this"; a zero says "there is nothing here", and a console whose
   * "Bookings awaiting payment: 0" glows in the attention colour teaches an
   * admin to stop reading the colour at all.
   *
   * Numeric zero only. A caller who pre-formats ("0 ₫") is asserting the string
   * is the thing to show, and this component is not going to start parsing it.
   */
  const shownTone = value === 0 ? 'default' : tone;

  const body = (
    <>
      <div className="flex items-center justify-between gap-gb-md">
        <p className="text-gb-sm text-fg-tertiary">{label}</p>
        {href ? (
          <KitIcon
            art={ICONS.arrowRight}
            frame={16}
            className="shrink-0 text-fg-muted transition-colors group-hover:text-brand"
          />
        ) : null}
      </div>
      <p
        className={`font-display text-gb-display-xs font-semibold tracking-gb-display-tight ${STAT_TONE[shownTone]}`}
      >
        {value}
      </p>
      {hint ? <p className="text-gb-xs text-fg-muted">{hint}</p> : null}
    </>
  );

  const shell = `${PANEL_BASE}${ELEVATION.raised} flex flex-col gap-gb-xs p-gb-2xl`;

  if (href) {
    return (
      <Link
        href={href}
        className={`group ${shell} transition-colors hover:border-line-strong hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand`}
      >
        {body}
      </Link>
    );
  }

  return <div className={shell}>{body}</div>;
}
