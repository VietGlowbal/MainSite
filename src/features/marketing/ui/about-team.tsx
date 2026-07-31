'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import type { TeamAchievementCategory, TeamMember } from '@/lib/team';
import { BRAND_ICONS, BrandIcon, ICONS, InstagramMark, KitIcon } from '@/shared/ui';

/**
 * About-page team mosaic — a wall of faces, and one detail card underneath it
 * that resolves to whoever the pointer is on.
 *
 * Replaces the eight-across static card grid /about shipped with (each card
 * repeating name / role / bio / contact, which is a lot of column inches for
 * information a visitor only wants about one person at a time). The photos are
 * now the whole grid, and every other field lives in one card below it.
 *
 * ─── THE INTERACTION MODEL: PREVIEW OVER PIN ────────────────────────────────
 *
 * Two pieces of state, not one, because hover and choice are different verbs:
 *
 *   pinned  — the member the visitor picked (click, tap, or Enter on a tile).
 *   preview — the member the pointer or keyboard focus is currently over.
 *
 * The card shows `preview ?? pinned`, so brushing across the wall previews
 * faces and leaving the wall returns to the one that was actually chosen
 * rather than snapping to an empty state. `pinned` starts on the featured
 * member, which means the card is never blank: an empty slot below a grid of
 * faces reads as something failing to load, and it would also make the section
 * grow by the card's full height the first time a pointer touched it.
 *
 * That same "always showing someone" rule is why there is no exit animation.
 * The card never leaves; only its contents change.
 *
 * ─── WHY EVERY PORTRAIT IS RENDERED AT ONCE ─────────────────────────────────
 *
 * The card stacks all N portraits absolutely and crossfades them with opacity,
 * instead of pointing one <img> at `active.photo_url`. Both alternatives are
 * worse in the same place:
 *
 *   - keying the card by member id remounts the <img>, and a remounted image
 *     paints its empty box for a frame before the decoded bitmap comes back,
 *     even when the file is already in cache. On a hover interaction that
 *     frame is the entire impression.
 *   - swapping the `src` attribute on a stable <img> avoids the remount but
 *     still cannot crossfade — there is only one element to fade.
 *
 * Rendering them all costs nothing extra on the network: these are the exact
 * same URLs the grid above already loaded. It does mean the roster wants to
 * stay roster-sized — a few dozen faces. A future page listing two hundred
 * mentors needs a different component, not a taller wall.
 *
 * The text column, unlike the portrait, IS keyed by member id on purpose: a
 * CSS animation only replays on a fresh element, and the staggered arrival of
 * name → facts → quote → achievements is the point. See the team-mosaic block
 * at the end of src/styles/tokens.css.
 *
 * ─── THE NOTCH IS MEASURED, NOT GUESSED ─────────────────────────────────────
 *
 * A brand-coloured marker slides along the top edge of the card to sit under
 * whichever tile is active — the one visual thread tying the card to the face
 * it belongs to. Its position is read from the tile's own
 * `getBoundingClientRect`, not derived from `activeIndex * (100 / columns)`,
 * because the column count changes at two breakpoints and the last row is
 * usually short. It stays invisible until the first measurement lands, so the
 * transition never animates in from x=0.
 *
 * ─── ACCESSIBILITY NOTES ────────────────────────────────────────────────────
 *
 * Every tile is a real <button> with an accessible name that already contains
 * the person's name and role, `aria-controls` pointing at the card, and
 * `aria-pressed` for the pinned one. Focus drives `preview` exactly as hover
 * does, so keyboard users get the same reveal.
 *
 * The card is deliberately NOT a live region. Its contents change on every
 * hover and every arrow-key move, and announcing a full bio plus four
 * achievements on each step would bury the tile label the visitor is actually
 * navigating by. The card sits immediately after the grid in DOM order and its
 * heading names the member, which is the quieter way to reach the same
 * information.
 *
 * Arrow keys move focus between tiles (which previews as it goes) rather than
 * moving the selection, matching how a toolbar behaves. Left/Up and Right/Down
 * are linear over the roster rather than true row/column steps: the grid
 * reflows from 2 to 6 columns, so "the tile below this one" is not a fixed
 * offset, and a linear walk is predictable at every width.
 *
 * Under `prefers-reduced-motion` the tiles stop scaling, the card's arrival
 * animations are dropped, the notch jumps instead of sliding, and the
 * scroll-into-view on tap is instant. The reveal itself still works — it is
 * information, not decoration.
 */

/** Achievement rows the card shows before collapsing the rest into a count.
    Four keeps the card's height close to constant as faces change, which is
    what stops the footer below from jumping around under a moving pointer. */
const MAX_ACHIEVEMENTS = 4;

/** Milliseconds between each block's arrival inside the card. */
const LINE_STAGGER_MS = 60;

/**
 * Human labels for the achievement categories in supabase-team.sql. Written
 * out rather than title-cased from the enum so `international_experience`
 * reads as "International" instead of "International experience", which is
 * three words of column width for no extra meaning.
 */
const ACHIEVEMENT_LABELS: Record<TeamAchievementCategory, string> = {
  scholarship: 'Scholarship',
  mentoring: 'Mentoring',
  education: 'Education',
  leadership: 'Leadership',
  award: 'Award',
  debate: 'Debate',
  international_experience: 'International',
  product: 'Product',
  quote: 'In their words',
};

/**
 * Column counts as whole class strings, keyed by the desktop column count.
 *
 * A map rather than `lg:grid-cols-${n}`: Tailwind extracts candidates by
 * scanning source text, so an interpolated class name is never emitted at all
 * — the same failure documented on Container. Six is the widest step, which is
 * two clean rows for a twelve-person roster.
 */
const GRID_COLUMNS: Record<number, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-2 sm:grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
  5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
  6: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6',
};

/** Two rows at the widest step, clamped to the map above. */
function columnsFor(count: number): string {
  const columns = Math.min(6, Math.max(2, Math.ceil(count / 2)));
  return GRID_COLUMNS[columns] ?? GRID_COLUMNS[6]!;
}

/**
 * Initials for a member with no photo. Same rule as Avatar's: first + last
 * initial covers both the Vietnamese order (given name last) and the English
 * one. Not imported from there because that helper is private to the avatar,
 * and these monograms are display-sized rather than 32px.
 */
function monogram(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  const seed = `${first}${last}`.toUpperCase();
  return seed === '' ? '?' : seed;
}

/** "01", "07", "12" — the counter in the card's eyebrow. */
function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/** Where the featured member sits, or the top of the list if none is flagged. */
function initialIndex(members: readonly TeamMember[]): number {
  const featured = members.findIndex((member) => member.is_featured);
  return featured === -1 ? 0 : featured;
}

/** "BA Business Administration", "Marketing", or nothing at all. */
function programmeLine(member: TeamMember): string | null {
  const parts = [member.degree, member.major].filter(
    (part): part is string => typeof part === 'string' && part.trim() !== '',
  );
  return parts.length === 0 ? null : parts.join(' · ');
}

/** Staggered arrival for a block inside the card. Index 0 gets no delay. */
function lineStyle(step: number): CSSProperties {
  return { animationDelay: `${step * LINE_STAGGER_MS}ms` };
}

const TILE_CLASSES = [
  'group relative aspect-[4/5] overflow-hidden rounded-gb-xl bg-surface-muted text-left',
  'transition duration-300 ease-out motion-reduce:transition-none',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
].join(' ');

/** The tile's resting look: slightly drained, so the active one reads as lit. */
const TILE_RESTING = 'opacity-90 grayscale-[45%]';
/** Everything that is not the active tile once the wall has a subject. */
const TILE_DIMMED = 'opacity-60 grayscale-[70%]';
/** The active tile: full colour, lifted, wearing the brand ring. */
const TILE_ACTIVE =
  'z-10 opacity-100 grayscale-0 shadow-gb-lg ring-2 ring-brand scale-[1.04] motion-reduce:scale-100';

const FACT_LABEL = 'text-gb-xs font-semibold uppercase tracking-wide text-fg-on-inverse-muted';
const FACT_VALUE = 'text-gb-sm text-fg-on-inverse';

const CONTACT_LINK = [
  'inline-flex size-gb-5xl items-center justify-center rounded-gb-full',
  'border border-line-on-inverse text-fg-on-inverse-secondary',
  'transition-colors hover:border-brand hover:text-fg-on-inverse',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
].join(' ');

export function AboutTeam({ members }: { members: readonly TeamMember[] }) {
  const cardId = useId();
  const nameId = useId();

  /** The chosen member. Starts on the featured one — see the header. */
  const [pinned, setPinned] = useState(() => initialIndex(members));
  /** The hovered/focused member, or null when the pointer is off the wall. */
  const [preview, setPreview] = useState<number | null>(null);
  /** Distance from the wall's left edge to the active tile's centre, in px.
      null until the first measurement, which is what keeps the notch hidden
      rather than animating in from the corner. */
  const [notchX, setNotchX] = useState<number | null>(null);

  const wallRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const tilesRef = useRef<(HTMLButtonElement | null)[]>([]);

  const activeIndex = preview ?? pinned;
  const active = members[activeIndex] ?? members[0];

  const measureNotch = useCallback(() => {
    const wall = wallRef.current;
    const tile = tilesRef.current[activeIndex] ?? null;
    if (wall === null || tile === null) return;
    const wallBox = wall.getBoundingClientRect();
    const tileBox = tile.getBoundingClientRect();
    setNotchX(tileBox.left - wallBox.left + tileBox.width / 2);
  }, [activeIndex]);

  /* Re-measured on every active change and whenever the wall's box changes.
     A ResizeObserver rather than a window resize listener: the tiles also move
     when the grid reflows at a breakpoint or when a webfont lands, both of
     which change the wall's own height without a resize event necessarily
     being the trigger. */
  useEffect(() => {
    measureNotch();
    const wall = wallRef.current;
    if (wall === null) return;
    const observer = new ResizeObserver(() => measureNotch());
    observer.observe(wall);
    return () => observer.disconnect();
  }, [measureNotch]);

  const pin = useCallback((index: number) => {
    setPinned(index);
    const card = cardRef.current;
    if (card === null) return;
    /* On a phone the wall is six rows tall and the card is off-screen, so a tap
       that changes it silently looks like a tap that did nothing. `block:
       'nearest'` is a no-op when the card is already visible, which is the
       desktop case — so this costs nothing there. */
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    card.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'nearest' });
  }, []);

  const focusTile = useCallback(
    (index: number) => {
      const count = members.length;
      if (count === 0) return;
      const next = ((index % count) + count) % count;
      tilesRef.current[next]?.focus();
    },
    [members.length],
  );

  const onTileKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
      // Linear rather than row/column — see the accessibility note in the header.
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        focusTile(index + 1);
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        focusTile(index - 1);
      } else if (event.key === 'Home') {
        event.preventDefault();
        focusTile(0);
      } else if (event.key === 'End') {
        event.preventDefault();
        focusTile(members.length - 1);
      }
    },
    [focusTile, members.length],
  );

  /* Fail-soft, exactly as getTeamMembers is: no roster (pre-migration, or a
     transient query error) hides the section but keeps the anchor, because the
     footer's "Our team" link points at #team and must still resolve. */
  if (members.length === 0 || active === undefined) {
    return <div id="team" className="scroll-mt-gb-9xl" />;
  }

  const shownAchievements = active.achievements.slice(0, MAX_ACHIEVEMENTS);
  const hiddenAchievements = active.achievements.length - shownAchievements.length;
  const programme = programmeLine(active);

  return (
    <section id="team" className="scroll-mt-gb-9xl pb-gb-9xl">
      <div className="flex flex-col gap-gb-6xl">
        <div className="mx-auto max-w-gb-width-xl text-center">
          <h2 className="font-display text-gb-display-xs font-semibold md:text-gb-display-sm">
            Meet our team
          </h2>
          <p className="mt-gb-lg text-gb-md text-fg-tertiary">
            Hover a face — or tap one — to see where they study, what they have won, and how to
            reach them.
          </p>
        </div>

        {/* The wall. `onPointerLeave` on the wrapper rather than on each tile:
            moving between two adjacent tiles fires leave-then-enter, and
            clearing the preview in that gap makes the card flicker back to the
            pinned member for a frame. */}
        <div
          ref={wallRef}
          onPointerLeave={() => setPreview(null)}
          className={`grid gap-gb-lg sm:gap-gb-xl ${columnsFor(members.length)}`}
        >
          {members.map((member, index) => {
            const isActive = index === activeIndex;
            const state = isActive ? TILE_ACTIVE : preview === null ? TILE_RESTING : TILE_DIMMED;
            return (
              <button
                key={member.id}
                ref={(node) => {
                  tilesRef.current[index] = node;
                }}
                type="button"
                aria-pressed={pinned === index}
                aria-controls={cardId}
                onPointerEnter={() => setPreview(index)}
                onFocus={() => setPreview(index)}
                onBlur={() => setPreview(null)}
                onClick={() => pin(index)}
                onKeyDown={(event) => onTileKeyDown(event, index)}
                className={`${TILE_CLASSES} ${state}`}
              >
                {member.photo_url ? (
                  /* Plain <img>, like the avatar and the team card this
                     replaced: photo URLs come from Google Drive and admin
                     uploads, and an unconfigured host makes next/image throw at
                     runtime. `alt=""` because the button's own text already
                     names the person — a second reading of the name would make
                     every tile announce twice. */
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={member.photo_url}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 flex items-center justify-center bg-surface-muted font-display text-gb-display-sm font-semibold text-fg-muted"
                  >
                    {monogram(member.full_name)}
                  </span>
                )}

                {/* Scrim. Always on, not hover-only: the name sits on it at
                    rest, and `--color-scrim` exists for exactly this job (see
                    the over-image note in tokens.css). */}
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 bottom-0 h-3/5 bg-linear-to-t from-scrim to-transparent"
                />

                <span className="absolute inset-x-0 bottom-0 flex flex-col gap-gb-xxs p-gb-lg">
                  <span className="truncate text-gb-sm font-semibold text-white">
                    {member.full_name}
                  </span>
                  {/* The role is the tile's second line and the reason the
                      button's accessible name is complete without an
                      aria-label: "Nguyen Khanh Linh, Founder". */}
                  <span className="truncate text-gb-xs font-medium text-white/80">
                    {member.role}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {/* ── The card ─────────────────────────────────────────────────────── */}
        <div
          ref={cardRef}
          id={cardId}
          className="relative overflow-hidden rounded-gb-2xl bg-surface-inverse-strong shadow-gb-lg"
        >
          {/* The notch, measured off the active tile — see the header. */}
          <span
            aria-hidden="true"
            style={notchX === null ? undefined : { transform: `translateX(${notchX}px)` }}
            className={`pointer-events-none absolute left-0 top-0 h-gb-xs w-gb-7xl -translate-x-1/2 rounded-b-gb-full bg-brand transition-[transform,opacity] duration-300 ease-out motion-reduce:transition-none ${
              notchX === null ? 'opacity-0' : 'opacity-100'
            }`}
          />

          <div className="grid md:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
            {/* Portrait: every member stacked, crossfaded. See the header for
                why this is not one <img> with a changing src. */}
            <div className="relative aspect-[4/5] bg-surface-inverse-deep sm:aspect-[16/9] md:aspect-auto md:min-h-[26rem]">
              {members.map((member, index) => (
                <span
                  key={member.id}
                  aria-hidden={index === activeIndex ? undefined : 'true'}
                  className={`absolute inset-0 transition-opacity duration-500 ease-out motion-reduce:transition-none ${
                    index === activeIndex ? 'opacity-100' : 'opacity-0'
                  }`}
                >
                  {member.photo_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={member.photo_url}
                      alt={member.full_name}
                      loading="lazy"
                      className="size-full object-cover"
                    />
                  ) : (
                    /* aria-hidden: the heading beside this already says the
                       name, and "CL" read aloud is noise. */
                    <span
                      aria-hidden="true"
                      className="flex size-full items-center justify-center font-display text-gb-display-lg font-semibold text-fg-on-inverse-muted"
                    >
                      {monogram(member.full_name)}
                    </span>
                  )}
                </span>
              ))}
            </div>

            {/* Text column. Keyed by member so the stagger replays — a reused
                DOM node does not restart a CSS animation. */}
            <div
              key={active.id}
              className="flex animate-gb-team-card-in flex-col gap-gb-2xl p-gb-4xl motion-reduce:animate-none md:p-gb-6xl"
            >
              <div
                style={lineStyle(0)}
                className="flex animate-gb-team-line-in flex-col gap-gb-md motion-reduce:animate-none"
              >
                <span className="text-gb-xs font-semibold uppercase tracking-wide text-fg-on-inverse-muted">
                  {pad2(activeIndex + 1)} / {pad2(members.length)} · {active.role}
                </span>
                <h3
                  id={nameId}
                  className="font-display text-gb-display-xs font-semibold text-fg-on-inverse md:text-gb-display-sm"
                >
                  {active.full_name}
                </h3>
                {active.short_bio ? (
                  <p className="text-gb-md text-fg-on-inverse-secondary">{active.short_bio}</p>
                ) : null}
              </div>

              {active.university || programme || active.exchange_university ? (
                <dl
                  style={lineStyle(1)}
                  className="grid animate-gb-team-line-in gap-gb-xl motion-reduce:animate-none sm:grid-cols-2"
                >
                  {active.university ? (
                    <div className="flex flex-col gap-gb-xxs">
                      <dt className={FACT_LABEL}>Studies at</dt>
                      <dd className={FACT_VALUE}>{active.university}</dd>
                    </div>
                  ) : null}
                  {programme ? (
                    <div className="flex flex-col gap-gb-xxs">
                      <dt className={FACT_LABEL}>Programme</dt>
                      <dd className={FACT_VALUE}>{programme}</dd>
                    </div>
                  ) : null}
                  {active.exchange_university ? (
                    <div className="flex flex-col gap-gb-xxs">
                      <dt className={FACT_LABEL}>Exchange</dt>
                      <dd className={FACT_VALUE}>{active.exchange_university}</dd>
                    </div>
                  ) : null}
                </dl>
              ) : null}

              {shownAchievements.length > 0 ? (
                <ul
                  style={lineStyle(2)}
                  className="flex animate-gb-team-line-in flex-col gap-gb-lg motion-reduce:animate-none"
                >
                  {shownAchievements.map((achievement) => (
                    <li key={achievement.id} className="flex items-start gap-gb-lg">
                      <KitIcon
                        art={ICONS.checkCircle}
                        frame={20}
                        className="mt-gb-xxs shrink-0 text-brand"
                      />
                      <span className="flex min-w-0 flex-col">
                        <span className="text-gb-sm font-semibold text-fg-on-inverse">
                          {achievement.title}
                        </span>
                        <span className="text-gb-xs text-fg-on-inverse-muted">
                          {ACHIEVEMENT_LABELS[achievement.category]}
                          {achievement.year === null ? '' : ` · ${achievement.year}`}
                        </span>
                      </span>
                    </li>
                  ))}
                  {hiddenAchievements > 0 ? (
                    <li className="text-gb-xs text-fg-on-inverse-muted">
                      + {hiddenAchievements} more
                    </li>
                  ) : null}
                </ul>
              ) : null}

              {active.favourite_quote ? (
                <blockquote
                  style={lineStyle(3)}
                  className="animate-gb-team-line-in border-l-2 border-brand pl-gb-xl text-gb-md italic text-fg-on-inverse-secondary motion-reduce:animate-none"
                >
                  “{active.favourite_quote}”
                </blockquote>
              ) : null}

              {active.linkedin_url || active.instagram_url || active.email ? (
                <div
                  style={lineStyle(4)}
                  className="flex animate-gb-team-line-in items-center gap-gb-lg motion-reduce:animate-none"
                >
                  {active.linkedin_url ? (
                    <a
                      href={active.linkedin_url}
                      target="_blank"
                      rel="noreferrer noopener"
                      aria-label={`${active.full_name} on LinkedIn`}
                      className={CONTACT_LINK}
                    >
                      <BrandIcon art={BRAND_ICONS.linkedin} frame={20} />
                    </a>
                  ) : null}
                  {active.instagram_url ? (
                    <a
                      href={active.instagram_url}
                      target="_blank"
                      rel="noreferrer noopener"
                      aria-label={`${active.full_name} on Instagram`}
                      className={CONTACT_LINK}
                    >
                      <InstagramMark frame={20} />
                    </a>
                  ) : null}
                  {active.email ? (
                    <a
                      href={`mailto:${active.email}`}
                      aria-label={`Email ${active.full_name}`}
                      className={CONTACT_LINK}
                    >
                      <KitIcon art={ICONS.send} frame={20} />
                    </a>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
