'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { TeamAchievementCategory, TeamMember } from '@/lib/team';
import { BRAND_ICONS, BrandIcon, ICONS, InstagramMark, KitIcon, Modal } from '@/shared/ui';

/**
 * About-page team carousel — a direct port of the owner-supplied reference's
 * cylindrical-arc math, not an approximation of it. Clicking a face opens
 * their full detail in a modal, which can then step through the whole
 * roster without closing.
 *
 * ─── WHY THIS IS A PER-FRAME LOOP, NOT A CSS ANIMATION ───────────────────────
 *
 * Two earlier passes tried to approximate the reference with pure CSS (a
 * full spinning ring, then a single shared `@keyframes` fan) and both
 * produced a visibly different shape. The reference's motion is not a fixed
 * path — every face's on-screen position is `relativeX = (index*step +
 * currentX) mod totalSpan`, recentred, and only THEN projected through
 * `angle = relativeX / radius; x = radius·sin(angle); z = (1−cos(angle))·
 * radius·depthScale/2; rotateY = −angle`. `currentX` drifts continuously
 * (autoplay) and is what makes the curve itself slide, not any one face
 * moving along a pre-baked track. A CSS `@keyframes` can express one face's
 * fixed path; it cannot express "the whole curve's centre moves," which is
 * what actually produces the reference's look. So this is `updateCardTransforms`
 * and `renderPhysicsLoop` from the reference, ported near-verbatim to a
 * `requestAnimationFrame` loop that writes `card.style.transform` directly —
 * the same imperative-DOM-write-per-frame technique `home-partners.tsx`
 * already uses for the partner-logo orbit, for the identical reason: eleven
 * (here, N) `next/image`-backed React re-renders per frame is real cost a
 * ref write is not.
 *
 * Kept from the reference: the exact projection formula, the opacity falloff
 * by distance-from-centre, the z-index-by-depth, and the 0.14 lerp smoothing
 * between `currentX` and `targetX`. Dropped: pointer drag, velocity/friction,
 * the settings drawer, sound, and CSV import — none of that is the
 * "carousel," and this file has its own click-to-open modal already.
 *
 * `TeamCarousel` also owns responsive card sizing, the same formula as the
 * reference's `updateResponsiveDimensions`: fit five cards across ~88% of
 * the stage width, clamped to a legible range, remeasured on resize via
 * `ResizeObserver`.
 *
 * ─── PAUSE ON HOVER ───────────────────────────────────────────────────────────
 *
 * Not in the reference (there, only the drawer's Pause button stops
 * autoplay), but added here so a visitor's pointer resting on the carousel
 * to read a name — or aim a click — doesn't have to fight the drift. A ref
 * flag checked once per frame, not React state, so hovering never re-renders.
 *
 * ─── REDUCED MOTION GETS A DIFFERENT LAYOUT, NOT A FROZEN ONE ────────────────
 *
 * Freezing mid-drift would leave most of the roster off to the sides at the
 * curve's low-opacity floor, some likely clipped by the stage's
 * `overflow-hidden` — not "no motion, same information." So
 * `prefers-reduced-motion` swaps the carousel out entirely for a plain
 * wrapped row of the same tiles, laid flat with no 3D transform. Same faces,
 * same click-to-open, just no motion and nothing hidden off-canvas.
 *
 * ─── THE MODAL STEPS THROUGH THE ROSTER ──────────────────────────────────────
 *
 * Opening a member no longer requires closing and reopening to see the next
 * one: prev/next buttons, a left/right swipe (pointer-based, so it works with
 * mouse drag too, not just touch), and the arrow keys all move `openIndex`
 * without touching `open` — the modal itself never unmounts between members,
 * only its content changes.
 */

/** Achievement rows the modal shows before collapsing the rest into a count. */
const MAX_ACHIEVEMENTS = 4;

/** Milliseconds between each block's arrival inside the modal. */
const LINE_STAGGER_MS = 60;

/**
 * The reference's own defaults (`state` in the pasted code), used verbatim:
 * `radius` and `depthScale` shape the cylindrical projection, `autoPlaySpeed`
 * is px of `targetX` drift per animation frame, `cardGap` the px between
 * cards at the reference's own `cardWidth`. Not re-tuned — see the header for
 * why guessing new numbers is exactly how the previous two passes drifted
 * from what was actually asked for.
 */
const CAROUSEL_RADIUS_PX = 750;
const CAROUSEL_DEPTH_SCALE = 3.2;
const CAROUSEL_AUTOPLAY_SPEED = 1.2;
const CAROUSEL_CARD_GAP_PX = 6;
/** `updateResponsiveDimensions`'s clamp: never narrower than legible, never
    wider than the reference's own ceiling. */
const CAROUSEL_CARD_MIN_WIDTH_PX = 160;
const CAROUSEL_CARD_MAX_WIDTH_PX = 250;
/** How much of the stage width the five-cards-ideal-width formula targets. */
const CAROUSEL_FIT_FRACTION = 0.88;
const CAROUSEL_FIT_CARDS = 5;
/** `1 − (0.14 lerp factor)`; currentX closes 14% of the gap to targetX each
    frame, exactly the reference's smoothing constant. */
const CAROUSEL_LERP = 0.14;
/** The reference's own aspect ratio (height = 1.12 × width) is close to
    square; ours keeps the site's existing 4:5 portrait tiles instead — see
    the header on why card-internal styling stayed ours, not copied. */
const CAROUSEL_CARD_ASPECT = 5 / 4;

/** Minimum horizontal drag (px) on the modal before it counts as a swipe
    rather than a click or a text selection. */
const SWIPE_THRESHOLD_PX = 50;

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

/** "01", "07", "12" — the counter in the modal's eyebrow. */
function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/** "BA Business Administration", "Marketing", or nothing at all. */
function programmeLine(member: TeamMember): string | null {
  const parts = [member.degree, member.major].filter(
    (part): part is string => typeof part === 'string' && part.trim() !== '',
  );
  return parts.length === 0 ? null : parts.join(' · ');
}

/** Staggered arrival for a block inside the modal. Index 0 gets no delay. */
function lineStyle(step: number): CSSProperties {
  return { animationDelay: `${step * LINE_STAGGER_MS}ms` };
}

/** Where the featured member sits, or the top of the list if none is flagged. */
function withFeaturedFirst(members: readonly TeamMember[]): TeamMember[] {
  const featuredIndex = members.findIndex((member) => member.is_featured);
  if (featuredIndex <= 0) return [...members];
  const copy = [...members];
  const [featured] = copy.splice(featuredIndex, 1);
  return featured ? [featured, ...copy] : copy;
}

const TILE_CLASSES_BASE = [
  'group/tile relative shrink-0 cursor-pointer overflow-hidden rounded-gb-xl bg-surface-muted text-left',
  'opacity-90 grayscale-[35%] transition duration-300 ease-out hover:opacity-100 hover:grayscale-0',
  'motion-reduce:transition-none',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
].join(' ');

/** For the reduced-motion static grid, where Tailwind's own breakpoints size
    the tile. The carousel below sizes each tile itself (measured px, matching
    the reference's own responsive formula), so it passes `size-full` instead. */
const TILE_CLASSES = `${TILE_CLASSES_BASE} aspect-[4/5] w-[9.5rem] sm:w-[12rem] lg:w-[13.5rem]`;
const TILE_CLASSES_FLUID = `${TILE_CLASSES_BASE} size-full`;

function MemberFace({
  member,
  onOpen,
  className = TILE_CLASSES,
}: {
  member: TeamMember;
  onOpen: () => void;
  className?: string;
}) {
  return (
    <button type="button" onClick={onOpen} className={className}>
      {member.photo_url ? (
        /* Plain <img>, like the avatar and the modal portrait: photo URLs come
           from Google Drive and admin uploads, and an unconfigured host makes
           next/image throw at runtime. alt="" because the tile's own click
           handler and the modal it opens already carry the name. */
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={member.photo_url}
          alt=""
          loading="lazy"
          className="absolute inset-0 size-full object-cover transition-transform duration-500 ease-out group-hover/tile:scale-[1.06] motion-reduce:transition-none motion-reduce:group-hover/tile:scale-100"
        />
      ) : (
        <span
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center bg-surface-muted font-display text-gb-display-sm font-semibold text-fg-muted"
        >
          {monogram(member.full_name)}
        </span>
      )}

      {/* Scrim. Always on, not hover-only: the name sits on it at rest. */}
      <span
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-3/5 bg-linear-to-t from-scrim to-transparent"
      />
      <span className="absolute inset-x-0 bottom-0 flex flex-col gap-gb-xxs p-gb-lg">
        <span className="truncate text-gb-sm font-semibold text-white">{member.full_name}</span>
        <span className="truncate text-gb-xs font-medium text-white/80">{member.role}</span>
      </span>
    </button>
  );
}

/**
 * The carousel itself — see the file header. `members[0]` is dead centre at
 * rest (index 0's `relativeX` is 0 before `currentX` starts drifting), which
 * is why the caller passes the featured-first `ordered` array rather than
 * the raw roster.
 */
function TeamCarousel({
  members,
  onOpen,
}: {
  members: readonly TeamMember[];
  onOpen: (index: number) => void;
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const pausedRef = useRef(false);

  /** `cardWidth`, in px — the one thing `updateResponsiveDimensions` recomputes;
      everything else in the reference's `state` is a fixed constant (above). */
  const [cardWidth, setCardWidth] = useState(CAROUSEL_CARD_MAX_WIDTH_PX);
  const cardHeight = Math.round(cardWidth * CAROUSEL_CARD_ASPECT);

  // `updateResponsiveDimensions`: fit CAROUSEL_FIT_CARDS across
  // CAROUSEL_FIT_FRACTION of the stage, clamped to a legible range.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (viewport === null) return;
    const measure = () => {
      const vpWidth = viewport.offsetWidth;
      const ideal = Math.floor(
        (vpWidth * CAROUSEL_FIT_FRACTION - CAROUSEL_FIT_CARDS * CAROUSEL_CARD_GAP_PX) /
          CAROUSEL_FIT_CARDS,
      );
      setCardWidth(Math.max(CAROUSEL_CARD_MIN_WIDTH_PX, Math.min(ideal, CAROUSEL_CARD_MAX_WIDTH_PX)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  // `renderPhysicsLoop` + `updateCardTransforms`, ported to refs/rAF instead
  // of a global `state` object and direct `document` DOM lookups — see the
  // file header for why this stays imperative rather than becoming React
  // state driving a re-render every frame.
  useEffect(() => {
    if (members.length === 0) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const cardState = { currentX: 0, targetX: 0 };
    let frame: number | null = null;

    function step() {
      if (!pausedRef.current && !reduced.matches) {
        cardState.targetX -= CAROUSEL_AUTOPLAY_SPEED;
      }
      cardState.currentX += (cardState.targetX - cardState.currentX) * CAROUSEL_LERP;
      updateCardTransforms(cardState.currentX);
      frame = requestAnimationFrame(step);
    }

    function updateCardTransforms(currentX: number) {
      const step = cardWidth + CAROUSEL_CARD_GAP_PX;
      const totalSpan = members.length * step;
      const viewportWidth = viewportRef.current?.offsetWidth ?? 0;
      const maxDist = viewportWidth * 0.65;

      cardRefs.current.forEach((card, index) => {
        if (card === null) return;

        const basePosition = index * step + currentX;
        let relativeX = ((basePosition % totalSpan) + totalSpan) % totalSpan;
        if (relativeX > totalSpan / 2) relativeX -= totalSpan;

        // True cylindrical arc trigonometry — verbatim from the reference.
        const angle = relativeX / CAROUSEL_RADIUS_PX;
        const posX = CAROUSEL_RADIUS_PX * Math.sin(angle);
        const translateZ =
          (1 - Math.cos(angle)) * CAROUSEL_RADIUS_PX * (CAROUSEL_DEPTH_SCALE * 0.5);
        const rotateY = -angle * (180 / Math.PI);

        const absDist = Math.abs(relativeX);
        const normalizedDist = maxDist > 0 ? Math.min(absDist / maxDist, 1) : 0;
        const opacity = Math.max(1 - normalizedDist * 0.35, 0.4);

        card.style.transform = `translate(-50%, -50%) translateX(${posX}px) translateZ(${translateZ}px) rotateY(${rotateY}deg)`;
        card.style.opacity = String(opacity);
        card.style.zIndex = String(Math.round(1000 - absDist));
      });
    }

    // Reduced motion still needs one frame to lay every face out along the
    // curve (currentX frozen at 0) instead of leaving them at their
    // pre-mount default position — it just never advances after that.
    updateCardTransforms(0);
    frame = requestAnimationFrame(step);
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [members.length, cardWidth]);

  return (
    <div
      ref={viewportRef}
      onPointerEnter={() => {
        pausedRef.current = true;
      }}
      onPointerLeave={() => {
        pausedRef.current = false;
      }}
      className="relative h-[280px] overflow-hidden [perspective:1200px] motion-reduce:hidden sm:h-[340px] lg:h-[400px]"
    >
      <div ref={trackRef} className="absolute inset-0 [transform-style:preserve-3d]">
        {members.map((member, index) => (
          <div
            key={member.id}
            ref={(node) => {
              cardRefs.current[index] = node;
            }}
            className="absolute left-1/2 top-1/2 [backface-visibility:hidden]"
            style={{ width: cardWidth, height: cardHeight }}
          >
            <MemberFace member={member} onOpen={() => onOpen(index)} className={TILE_CLASSES_FLUID} />
          </div>
        ))}
      </div>
    </div>
  );
}

const FACT_LABEL = 'text-gb-xs font-semibold uppercase tracking-wide text-fg-muted';
const FACT_VALUE = 'text-gb-sm text-fg';

const CONTACT_LINK = [
  'inline-flex size-gb-5xl items-center justify-center rounded-gb-full',
  'border border-line text-fg-secondary',
  'transition-colors hover:border-brand hover:text-fg',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
].join(' ');

/** A round, semi-opaque icon button overlaid on the modal — close and the two
    step controls all share this treatment so they read as one control set. */
const MODAL_OVERLAY_BUTTON = [
  'inline-flex size-gb-5xl items-center justify-center rounded-gb-full',
  'bg-surface/90 text-fg-secondary shadow-gb-xs backdrop-blur-sm',
  'transition-colors hover:text-fg',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
].join(' ');

/** The modal's content — everything the tile itself has no room for, plus
    where this member sits in the roster (the same counter the step controls
    move through). */
function MemberDetail({
  member,
  index,
  total,
}: {
  member: TeamMember;
  index: number;
  total: number;
}) {
  const shownAchievements = member.achievements.slice(0, MAX_ACHIEVEMENTS);
  const hiddenAchievements = member.achievements.length - shownAchievements.length;
  const programme = programmeLine(member);

  return (
    <div
      key={member.id}
      className="grid animate-gb-team-card-in motion-reduce:animate-none sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]"
    >
      <div className="relative aspect-[4/5] bg-surface-muted sm:aspect-auto">
        {member.photo_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={member.photo_url}
            alt={member.full_name}
            loading="lazy"
            className="size-full object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex size-full items-center justify-center font-display text-gb-display-lg font-semibold text-fg-muted"
          >
            {monogram(member.full_name)}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-gb-2xl p-gb-4xl md:p-gb-5xl">
        <div
          style={lineStyle(0)}
          className="flex animate-gb-team-line-in flex-col gap-gb-md motion-reduce:animate-none"
        >
          <span className="text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">
            {pad2(index + 1)} / {pad2(total)} · {member.role}
          </span>
          <h3 className="font-display text-gb-display-xs font-semibold text-fg">
            {member.full_name}
          </h3>
          {member.short_bio ? (
            <p className="text-gb-md text-fg-secondary">{member.short_bio}</p>
          ) : null}
        </div>

        {member.university || programme || member.exchange_university ? (
          <dl
            style={lineStyle(1)}
            className="grid animate-gb-team-line-in gap-gb-xl motion-reduce:animate-none sm:grid-cols-2"
          >
            {member.university ? (
              <div className="flex flex-col gap-gb-xxs">
                <dt className={FACT_LABEL}>Studies at</dt>
                <dd className={FACT_VALUE}>{member.university}</dd>
              </div>
            ) : null}
            {programme ? (
              <div className="flex flex-col gap-gb-xxs">
                <dt className={FACT_LABEL}>Programme</dt>
                <dd className={FACT_VALUE}>{programme}</dd>
              </div>
            ) : null}
            {member.exchange_university ? (
              <div className="flex flex-col gap-gb-xxs">
                <dt className={FACT_LABEL}>Exchange</dt>
                <dd className={FACT_VALUE}>{member.exchange_university}</dd>
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
                <KitIcon art={ICONS.checkCircle} frame={20} className="mt-gb-xxs shrink-0 text-brand" />
                <span className="flex min-w-0 flex-col">
                  <span className="text-gb-sm font-semibold text-fg">{achievement.title}</span>
                  <span className="text-gb-xs text-fg-muted">
                    {ACHIEVEMENT_LABELS[achievement.category]}
                    {achievement.year === null ? '' : ` · ${achievement.year}`}
                  </span>
                </span>
              </li>
            ))}
            {hiddenAchievements > 0 ? (
              <li className="text-gb-xs text-fg-muted">+ {hiddenAchievements} more</li>
            ) : null}
          </ul>
        ) : null}

        {member.favourite_quote ? (
          <blockquote
            style={lineStyle(3)}
            className="animate-gb-team-line-in border-l-2 border-brand pl-gb-xl text-gb-md italic text-fg-secondary motion-reduce:animate-none"
          >
            “{member.favourite_quote}”
          </blockquote>
        ) : null}

        {member.linkedin_url || member.instagram_url || member.email ? (
          <div
            style={lineStyle(4)}
            className="flex animate-gb-team-line-in items-center gap-gb-lg motion-reduce:animate-none"
          >
            {member.linkedin_url ? (
              <a
                href={member.linkedin_url}
                target="_blank"
                rel="noreferrer noopener"
                aria-label={`${member.full_name} on LinkedIn`}
                className={CONTACT_LINK}
              >
                <BrandIcon art={BRAND_ICONS.linkedin} frame={20} />
              </a>
            ) : null}
            {member.instagram_url ? (
              <a
                href={member.instagram_url}
                target="_blank"
                rel="noreferrer noopener"
                aria-label={`${member.full_name} on Instagram`}
                className={CONTACT_LINK}
              >
                <InstagramMark frame={20} />
              </a>
            ) : null}
            {member.email ? (
              <a
                href={`mailto:${member.email}`}
                aria-label={`Email ${member.full_name}`}
                className={CONTACT_LINK}
              >
                <KitIcon art={ICONS.send} frame={20} />
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function AboutTeam({ members }: { members: readonly TeamMember[] }) {
  /** Featured-first, so that person faces the camera at the ring's rest
      position — see the header. Recomputed only when the roster changes. */
  const ordered = useMemo(() => withFeaturedFirst(members), [members]);

  /** Index into `ordered` of the open modal's subject, or null when closed. */
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const swipeStartX = useRef<number | null>(null);

  const goPrev = useCallback(() => {
    setOpenIndex((current) =>
      current === null ? current : (current - 1 + ordered.length) % ordered.length,
    );
  }, [ordered.length]);

  const goNext = useCallback(() => {
    setOpenIndex((current) => (current === null ? current : (current + 1) % ordered.length));
  }, [ordered.length]);

  // Arrow keys step through the roster while the modal is open — Modal itself
  // only binds Escape, so stepping is this component's own concern.
  useEffect(() => {
    if (openIndex === null) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'ArrowLeft') goPrev();
      else if (event.key === 'ArrowRight') goNext();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [openIndex, goPrev, goNext]);

  function onSwipeStart(event: React.PointerEvent) {
    swipeStartX.current = event.clientX;
  }

  function onSwipeEnd(event: React.PointerEvent) {
    const startX = swipeStartX.current;
    swipeStartX.current = null;
    if (startX === null) return;
    const delta = event.clientX - startX;
    if (delta > SWIPE_THRESHOLD_PX) goPrev();
    else if (delta < -SWIPE_THRESHOLD_PX) goNext();
  }

  /* Fail-soft, exactly as getTeamMembers is: no roster (pre-migration, or a
     transient query error) hides the section but keeps the anchor, because the
     footer's "Our team" link points at #team and must still resolve. */
  if (ordered.length === 0) {
    return <div id="team" className="scroll-mt-gb-9xl" />;
  }

  const active = openIndex === null ? null : (ordered[openIndex] ?? null);

  return (
    <section id="team" className="scroll-mt-gb-9xl pb-gb-9xl">
      <div className="flex flex-col gap-gb-6xl">
        <div className="mx-auto max-w-gb-width-xl text-center">
          <h2 className="font-display text-gb-display-xs font-semibold md:text-gb-display-sm">
            Meet our team
          </h2>
          <p className="mt-gb-lg text-gb-md text-fg-tertiary">
            Tap a face to see where they study, what they have won, and how to reach them.
          </p>
        </div>

        <TeamCarousel members={ordered} onOpen={setOpenIndex} />

        {/* Reduced-motion fallback: the same faces, no carousel — see the
            header for why this is a different layout rather than a frozen
            one. */}
        <div className="hidden flex-wrap justify-center gap-gb-xl motion-reduce:flex">
          {ordered.map((member, index) => (
            <MemberFace key={member.id} member={member} onOpen={() => setOpenIndex(index)} />
          ))}
        </div>
      </div>

      <Modal
        open={active !== null}
        onClose={() => setOpenIndex(null)}
        label={active ? `${active.full_name}, ${active.role}` : 'Team member'}
        className="max-w-gb-width-xl overflow-hidden p-0"
      >
        {active && openIndex !== null ? (
          <div onPointerDown={onSwipeStart} onPointerUp={onSwipeEnd}>
            <button
              type="button"
              onClick={() => setOpenIndex(null)}
              aria-label="Close"
              className={`absolute right-gb-lg top-gb-lg z-10 ${MODAL_OVERLAY_BUTTON}`}
            >
              <KitIcon art={ICONS.close} frame={20} />
            </button>

            {ordered.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={goPrev}
                  aria-label="Previous team member"
                  className={`absolute left-gb-lg top-1/2 z-10 -translate-y-1/2 ${MODAL_OVERLAY_BUTTON}`}
                >
                  <KitIcon art={ICONS.arrowLeft} frame={20} />
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  aria-label="Next team member"
                  className={`absolute right-gb-lg top-1/2 z-10 -translate-y-1/2 ${MODAL_OVERLAY_BUTTON}`}
                >
                  <KitIcon art={ICONS.arrowRight} frame={20} />
                </button>
              </>
            ) : null}

            <MemberDetail member={active} index={openIndex} total={ordered.length} />
          </div>
        ) : null}
      </Modal>
    </section>
  );
}
