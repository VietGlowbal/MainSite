'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { TeamAchievementCategory, TeamMember } from '@/lib/team';
import { BRAND_ICONS, BrandIcon, ICONS, InstagramMark, KitIcon, Modal } from '@/shared/ui';

/**
 * About-page team fan — a coverflow-style 3D carousel of faces, a handful
 * visible at once in a shallow concave curve, continuously drifting sideways
 * through centre. Clicking one opens their full detail in a modal, which can
 * then step through the whole roster without closing.
 *
 * ─── ONE PATH, EVERY FACE OFFSET ALONG IT ────────────────────────────────────
 *
 * This was a full 3D ring the first time — every face fixed to its own slot
 * around a circle, the whole ring spinning as one rigid body. That is a
 * carousel; it is not what the reference clip shows. The reference (and the
 * screenshot it should match) is a shallow FAN: five or so faces visible at
 * once, each tilted like a page curling away from a flat one at the centre,
 * continuously sliding sideways — cards enter from one edge, pass through
 * flat-and-frontal in the middle, and exit the other edge, never completing
 * a lap past ±90°.
 *
 * The fix is one `@keyframes` (`gb-team-fan` at the end of tokens.css)
 * describing that single path as a function of time — enter off-screen right
 * and tilted away, straighten and grow through the middle, tilt away again
 * and exit off-screen left — and every face runs the *same* animation, just
 * offset by a different negative `animation-delay` (`fanDelayMs`). A
 * negative delay starts an animation already partway through its cycle, so
 * evenly spacing N faces' delays across one cycle length distributes them
 * evenly along the path with no per-frame JS: at any instant only the faces
 * whose current phase falls near the middle of the path are opaque and
 * near-centre; the rest sit further out along the same curve, faded to
 * `opacity: 0` by the keyframe itself, which is what limits how many are
 * visible at once regardless of roster size (see the keyframe's own
 * comment for the exact stops).
 *
 * `--gb-fan-spread` scales the path's horizontal/depth distances (not its
 * rotation or scale) per breakpoint, so the curve keeps the same *shape* on
 * a phone as on a desktop, just travelling a shorter distance.
 *
 * The featured member (if any) is sorted to index 0, and `fanDelayMs` is
 * built so index 0 sits exactly at centre the moment the page loads — the
 * roster is never bunched up or mid-transition on first paint.
 *
 * ─── PAUSE ON HOVER AND FOCUS ────────────────────────────────────────────────
 *
 * `group-hover/team-fan:` and `group-focus-within/team-fan:` pause every
 * face's animation via `animation-play-state` — plain CSS, each face just
 * freezes wherever its own offset path currently has it.
 *
 * ─── REDUCED MOTION GETS A DIFFERENT LAYOUT, NOT A FROZEN ONE ────────────────
 *
 * Freezing the fan mid-cycle would leave most of the roster off-screen or
 * mid-fade — not "no motion, same information." So `prefers-reduced-motion`
 * swaps the fan out entirely for a plain wrapped row of the same tiles, laid
 * flat with no 3D transform at all. Same faces, same click-to-open, just no
 * motion and nothing hidden off-canvas.
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

/** Seconds for one face's full pass through the fan — right edge to centre to
    left edge and back around. Fixed, not scaled by roster size: with N faces
    spread evenly across one cycle (see `fanDelayMs`), a shorter cycle just
    means a new face reaches centre more often, not that any one face moves
    faster through its own path. */
const FAN_CYCLE_S = 16;

/** Where in the cycle (0–1) a face is fully visible, centred, and flat —
    the middle of the fan. Mirrored on both sides of it below. */
const FAN_CENTRE = 0.5;

/**
 * Delay (ms), always negative, that puts face `index` of `count` at the
 * centre of the fan (`FAN_CENTRE`) at the moment the page loads, with the
 * rest already spread evenly ahead of and behind it — see the header for why
 * every face runs the identical `@keyframes` and only this offset differs.
 */
function fanDelayMs(index: number, count: number): number {
  const cycleMs = FAN_CYCLE_S * 1000;
  return -(FAN_CENTRE + index / count) * cycleMs;
}

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

const TILE_SIZE = 'w-[9.5rem] sm:w-[12rem] lg:w-[13.5rem]';

const TILE_CLASSES = [
  'group/tile relative aspect-[4/5] shrink-0 cursor-pointer overflow-hidden rounded-gb-xl bg-surface-muted text-left',
  TILE_SIZE,
  'opacity-90 grayscale-[35%] transition duration-300 ease-out hover:opacity-100 hover:grayscale-0',
  'motion-reduce:transition-none',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
].join(' ');

function MemberFace({ member, onOpen }: { member: TeamMember; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className={TILE_CLASSES}>
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

        {/* The fan. `overflow-hidden` crops whichever faces are currently
            off-canvas at the edges of their path rather than letting them
            push the page wider. `[perspective:1200px]` sits on this
            ancestor, not the faces themselves — perspective applies to a 3D
            element's children, and the faces are what actually need the
            depth. `--gb-fan-spread` is the one responsive knob — see the
            header. */}
        <div className="group/team-fan relative h-[280px] overflow-hidden [perspective:1200px] [--gb-fan-spread:0.55] motion-reduce:hidden sm:h-[340px] sm:[--gb-fan-spread:0.8] lg:h-[400px] lg:[--gb-fan-spread:1]">
          {ordered.map((member, index) => (
            <div
              key={member.id}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 [transform-style:preserve-3d]"
            >
              <div
                className="animate-gb-team-fan [will-change:transform,opacity] group-hover/team-fan:[animation-play-state:paused] group-focus-within/team-fan:[animation-play-state:paused]"
                style={{
                  animationDuration: `${FAN_CYCLE_S}s`,
                  animationDelay: `${fanDelayMs(index, ordered.length)}ms`,
                }}
              >
                <MemberFace member={member} onOpen={() => setOpenIndex(index)} />
              </div>
            </div>
          ))}
        </div>

        {/* Reduced-motion fallback: the same faces, no fan — see the header
            for why this is a different layout rather than a frozen one. */}
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
