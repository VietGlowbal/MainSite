'use client';

import { useState, type CSSProperties } from 'react';
import type { TeamAchievementCategory, TeamMember } from '@/lib/team';
import { BRAND_ICONS, BrandIcon, ICONS, InstagramMark, KitIcon, Modal } from '@/shared/ui';

/**
 * About-page team row — a rotating strip of faces; clicking one opens their
 * full detail in a modal.
 *
 * Replaces the wrapping photo grid + hover-reveal card the section shipped
 * with. That design's "preview over pin" model depended on tiles sitting
 * still, which a moving row breaks — hovering a face that has already
 * scrolled past by the time the reveal would land is not useful. Click does
 * not have that problem, and the roster fits a horizontal strip (a "wall"
 * that only ever needed to show a handful of rows at once).
 *
 * ─── THE LOOP IS TWO COPIES, NOT A MEASURED ANIMATION ───────────────────────
 *
 * The track renders the roster twice, back-to-back, and slides left by
 * exactly 50% of the track's own width on a CSS `@keyframes` loop (see the
 * team-row block at the end of tokens.css). Sliding half the width of a track
 * that is two identical copies hands off to the second copy sitting exactly
 * where the first one started — no visible seam, and no per-frame JS
 * measuring the roster's pixel width the way the partner-orbit curve or the
 * old drag-physics carousel would. The duration is `members.length` scaled
 * by a fixed per-tile pace rather than measured, so a longer roster takes
 * proportionally longer to loop instead of visibly speeding up.
 *
 * The second copy is `aria-hidden` and rendered as plain (non-interactive)
 * tiles wrapped in a `display: contents` div — `contents` keeps its children
 * as direct flex items of the track (so the shared `gap` still applies across
 * the seam) while letting one class hide the whole duplicate under
 * `prefers-reduced-motion`, where nothing is scrolling to loop into.
 *
 * ─── PAUSE ON HOVER AND FOCUS ────────────────────────────────────────────────
 *
 * `group-hover/team-row:` and `group-focus-within/team-row:` pause the
 * animation via `animation-play-state` — plain CSS, no state or JS. That
 * covers both a mouse resting on the row to read a name and a keyboard user
 * tabbing through it; either would otherwise be scrolling past its own
 * target.
 */

/** Achievement rows the modal shows before collapsing the rest into a count. */
const MAX_ACHIEVEMENTS = 4;

/** Milliseconds between each block's arrival inside the modal. */
const LINE_STAGGER_MS = 60;

/** Seconds of loop time per tile — keeps the pace constant regardless of
    roster size, so ten faces do not scroll noticeably faster than four. */
const SECONDS_PER_TILE = 3.2;
/** Floor on total loop duration, so a very short roster does not whip past. */
const MIN_DURATION_S = 18;

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

const TILE_SIZE = 'w-[9.5rem] sm:w-[12rem]';

const TILE_CLASSES = [
  'group/tile relative aspect-[4/5] shrink-0 overflow-hidden rounded-gb-xl bg-surface-muted text-left',
  TILE_SIZE,
  'opacity-90 grayscale-[35%] transition duration-300 ease-out',
  'motion-reduce:transition-none',
].join(' ');

/** The real, clickable tiles get the interactive treatment; the aria-hidden
    duplicate copy that makes the loop seamless does not need it. */
const TILE_INTERACTIVE = [
  'cursor-pointer hover:opacity-100 hover:grayscale-0 hover:scale-[1.04] motion-reduce:hover:scale-100',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
].join(' ');

function MemberFace({
  member,
  onOpen,
}: {
  member: TeamMember;
  /** Present only for the real, interactive copy — see the header. */
  onOpen?: () => void;
}) {
  const photo = member.photo_url ? (
    /* Plain <img>, like the avatar and the modal portrait: photo URLs come
       from Google Drive and admin uploads, and an unconfigured host makes
       next/image throw at runtime. alt="" because the tile's own accessible
       name (button label, or aria-hidden on the duplicate) already covers it. */
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
  );

  const overlay = (
    <>
      {/* Scrim. Always on, not hover-only: the name sits on it at rest. */}
      <span
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-3/5 bg-linear-to-t from-scrim to-transparent"
      />
      <span className="absolute inset-x-0 bottom-0 flex flex-col gap-gb-xxs p-gb-lg">
        <span className="truncate text-gb-sm font-semibold text-white">{member.full_name}</span>
        <span className="truncate text-gb-xs font-medium text-white/80">{member.role}</span>
      </span>
    </>
  );

  if (onOpen) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className={`${TILE_CLASSES} ${TILE_INTERACTIVE}`}
      >
        {photo}
        {overlay}
      </button>
    );
  }

  // The visual-only duplicate: same look, out of the tab order and the
  // accessibility tree — its parent wrapper already carries aria-hidden.
  return (
    <div className={TILE_CLASSES}>
      {photo}
      {overlay}
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

/** The modal's content — everything the old hover card showed, now the whole
    dialog instead of a strip beneath the row. */
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
  /** Index into `members` of the open modal's subject, or null when closed. */
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  /* Fail-soft, exactly as getTeamMembers is: no roster (pre-migration, or a
     transient query error) hides the section but keeps the anchor, because the
     footer's "Our team" link points at #team and must still resolve. */
  if (members.length === 0) {
    return <div id="team" className="scroll-mt-gb-9xl" />;
  }

  const active = openIndex === null ? null : (members[openIndex] ?? null);
  const duration = `${Math.max(members.length * SECONDS_PER_TILE, MIN_DURATION_S)}s`;

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

        {/* The row. Horizontally scrollable even with the animation running,
            so a visitor can still drag past the loop on a touch device; the
            edge mask fades tiles in/out rather than cropping them mid-tile. */}
        <div className="group/team-row overflow-x-auto [mask-image:linear-gradient(to_right,transparent,black_4%,black_96%,transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div
            className="flex w-max animate-gb-team-marquee gap-gb-xl group-hover/team-row:[animation-play-state:paused] group-focus-within/team-row:[animation-play-state:paused] motion-reduce:animate-none sm:gap-gb-2xl"
            style={{ '--gb-marquee-duration': duration } as CSSProperties}
          >
            {members.map((member, index) => (
              <MemberFace key={member.id} member={member} onOpen={() => setOpenIndex(index)} />
            ))}
            {/* The seamless-loop duplicate — see the header. `contents` keeps
                these as direct flex items (so the shared gap still applies
                across the seam) while hiding the whole set under reduced
                motion, where there is no loop to hand off into. */}
            <div className="contents motion-reduce:hidden" aria-hidden="true">
              {members.map((member) => (
                <MemberFace key={`loop-${member.id}`} member={member} />
              ))}
            </div>
          </div>
        </div>
      </div>

      <Modal
        open={active !== null}
        onClose={() => setOpenIndex(null)}
        label={active ? `${active.full_name}, ${active.role}` : 'Team member'}
        className="max-w-gb-width-xl overflow-hidden p-0"
      >
        {active && openIndex !== null ? (
          <>
            <button
              type="button"
              onClick={() => setOpenIndex(null)}
              aria-label="Close"
              className="absolute right-gb-lg top-gb-lg z-10 inline-flex size-gb-5xl items-center justify-center rounded-gb-full bg-surface/90 text-fg-secondary shadow-gb-xs backdrop-blur-sm transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <KitIcon art={ICONS.close} frame={20} />
            </button>
            <MemberDetail member={active} index={openIndex} total={members.length} />
          </>
        ) : null}
      </Modal>
    </section>
  );
}
