'use client';

import Image from 'next/image';
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import type { TeamMember } from '@/lib/team';
import { getLocaleText, type Locale } from '@/lib/i18n/locale';
import { GlowbalIcon, ICONS, KitIcon, Modal, type GlowbalIconName } from '@/shared/ui';
import { crestFor } from './university-crests';
import { highlightClass, highlightPhrases } from './home-highlight';
import {
  HOME_TEAM_ROSTER,
  HOME_TEAM_START_INDEX,
  teamInitials,
  type HomeTeamMember,
  type TeamAchievementCategory,
} from './home-team-roster';

/**
 * GlowBal Team — the Home roster as a slowly turning wall of cards (owner,
 * 2026-10-01; was a cover-flow you stepped with arrows).
 *
 * ─── ONE CARD SIZE ──────────────────────────────────────────────────────────
 *
 * Every card is the same box (`--team-card-w` × `--team-card-h`, set on the
 * stage per breakpoint). What does not fit is cut at a WHOLE row, never mid-
 * line: `useCardFit` measures how many achievement rows fit and hides the
 * rest, and the centre card then offers "Read more", which opens the full
 * profile in a dialog. A card whose content fits keeps its empty space — the
 * same rule as the Success Stories cards.
 *
 * ─── THE WALL (owner's sketch, 2026-10-01) ──────────────────────────────────
 *
 * The cards either side of the centre are trapezoids whose INNER edge is as
 * tall as the centre card and whose outer edge recedes — the inside of a
 * curved wall, not a convex cover-flow. Each side is one straight wall hinged
 * just outside the centre card: card k sits along it, rotated by
 * `WALL_ANGLE_DEG` about its own middle. Every length is a multiple of the
 * card width W, written as `calc(var(--team-card-w) * n)`, so the whole
 * composition scales with one CSS variable and nothing measures the DOM.
 * With the perspective at 1.5W the projected heights run 1 → .69 for the
 * first card and .68 → .52 for the second, which is the sketch's 1 → .70 and
 * .70 → .51. Two cards a side show from `xl`, one from `md`, none on a phone.
 *
 * ─── IT TURNS ON ITS OWN, SLOWLY ────────────────────────────────────────────
 *
 * The owner asked for no arrow buttons: the wall advances by itself every
 * `DWELL_MS`, each turn taking `TURN_MS`. The clock is the active dot's fill
 * animation (`animate-gb-team-dwell`): its `animationend` turns the wall, so
 * pausing the animation pauses the rotation where it stood, without a timer
 * to keep in step. It pauses while a mouse is over the wall, while keyboard
 * focus is inside it, while the dialog is open, while the wall is off-screen
 * or the tab hidden, and when the visitor presses pause (WCAG 2.2.2). With
 * reduced motion it never starts. The dots, ←/→ and a click on a side card
 * still move it by hand.
 *
 * ─── EMPHASIS IS DERIVED, NEVER WRITTEN ─────────────────────────────────────
 *
 * The card leads with one spotlight: the member's "students guided" figure
 * where there is one, otherwise their FIRST listed achievement (the brief
 * lists each person's strongest first). Inside an achievement, the title
 * before the first ", " or " — " is set in bold and the figures (percentages,
 * "Top N", GPA/IELTS scores, "Q1") in rose — read off the owner's own text in
 * either language, so nothing new is claimed.
 *
 * ─── NOTHING INVENTED ───────────────────────────────────────────────────────
 *
 * Roster facts are the owner's (home-team-roster.ts). The v2 handoff's local
 * portraits are primary; `team_members.photo_url` remains a fallback for the
 * one roster member whose photo was not supplied. A failed or absent image
 * shows initials — never a generated face.
 */

/** How long the centre card rests before the wall turns. */
const DWELL_MS = 5000;
/** One turn of the wall — slow on purpose ("quay từ từ thôi"). */
const TURN_MS = 1100;
const SWIPE_THRESHOLD_PX = 40;

/* The wall, in multiples of the card width W. */
const WALL_ANGLE_DEG = 42;
const WALL_GAP = 0.032;
const WALL_PERSPECTIVE = 1.5;
/** Cards further round than this wait, transparent, at the far end of the wall. */
const PARKED_SLOT = 3;
/** The rose veil that sinks each slot back into the band. */
const SLOT_VEIL = [0, 0.3, 0.55, 0.7] as const;

const CATEGORY_ICON: Record<TeamAchievementCategory, GlowbalIconName> = {
  Scholarship: 'scholarships',
  Competition: 'awardAmount',
  Research: 'subjectExploration',
  International: 'planGlobalEducation',
  Education: 'guides',
  Work: 'careerExploration',
  Advising: 'advisors',
};

/** Shortest signed distance from `current` to `index` round a ring of `count`. */
function ringOffset(index: number, current: number, count: number): number {
  let offset = index - current;
  if (offset > count / 2) offset -= count;
  if (offset < -count / 2) offset += count;
  return offset;
}

/**
 * Card k (k ≥ 1) on one side: its middle lies `along` from the hinge, measured
 * down the wall, and it turns so its outer edge recedes (rotateY > 0 pushes
 * the right edge away; the left wall mirrors it). Every slot uses the same
 * three functions so a turn interpolates each number on its own.
 */
function slotTransform(offset: number): string {
  const side = Math.sign(offset);
  const slot = Math.min(Math.abs(offset), PARKED_SLOT);
  let x = 0;
  let z = 0;
  if (slot > 0) {
    const angle = (WALL_ANGLE_DEG * Math.PI) / 180;
    const along = (slot - 1) * (1 + WALL_GAP) + 0.5;
    x = side * (0.5 + WALL_GAP + along * Math.cos(angle));
    z = -along * Math.sin(angle);
  }
  const rotate = slot > 0 ? side * WALL_ANGLE_DEG : 0;
  return `translateX(-50%) translate3d(calc(var(--team-card-w) * ${x.toFixed(4)}), 0px, calc(var(--team-card-w) * ${z.toFixed(4)})) rotateY(${rotate}deg)`;
}

/** Which slots show at which width — classes, so the server render is right. */
function slotClass(slot: number): string {
  if (slot === 0) return 'opacity-100';
  if (slot === 1) return 'cursor-pointer opacity-100 max-md:pointer-events-none max-md:opacity-0';
  if (slot === 2) return 'cursor-pointer opacity-100 max-xl:pointer-events-none max-xl:opacity-0';
  return 'pointer-events-none opacity-0';
}

/* ─── Environment ─────────────────────────────────────────────────────────── */

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
}

function subscribeVisibility(onChange: () => void) {
  document.addEventListener('visibilitychange', onChange);
  return () => document.removeEventListener('visibilitychange', onChange);
}

function usePageVisible(): boolean {
  return useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState === 'visible',
    () => true,
  );
}

/**
 * How many achievement rows fit WHOLE in the list box, and whether any clamped
 * text (`data-clamp`) is cut. Rows past the fit stay laid out but invisible,
 * so measuring again — after fonts load or the window resizes — sees the same
 * layout it is about to change.
 */
function useCardFit(total: number) {
  const cardRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [fit, setFit] = useState(total);
  const [clampCut, setClampCut] = useState(false);

  useEffect(() => {
    const card = cardRef.current;
    const list = listRef.current;
    if (card === null || list === null) return undefined;
    const rows = Array.from(list.children) as HTMLElement[];
    const clamped = Array.from(card.querySelectorAll<HTMLElement>('[data-clamp]'));

    const measure = () => {
      const limit = list.clientHeight + 1;
      let count = 0;
      for (const row of rows) {
        if (row.offsetTop + row.offsetHeight > limit) break;
        count += 1;
      }
      setFit(count);
      setClampCut(clamped.some((node) => node.scrollHeight > node.clientHeight + 1));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    for (const node of [...rows, ...clamped]) observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { cardRef, listRef, fit, cut: fit < total || clampCut };
}

/* ─── Emphasis ────────────────────────────────────────────────────────────── */

/** Figures worth the eye: "100%", "70–75%", "Top 1%", "Top 25", "4.0/4.0", "9.0", "Q1". */
const FIGURES = /(Top \d+%?|\d+(?:–\d+)?%|\d\.\d(?:\/\d\.\d)?|\bQ1\b)/;
const LEAD_BREAK = /, | — /;
/** A "title, event" lead longer than this is a sentence, not a title. */
const LEAD_MAX_CHARS = 40;

function withFigures(text: string, figureClass: string): ReactNode[] {
  return text
    .split(new RegExp(FIGURES.source, 'g'))
    .map((part, index) =>
      index % 2 === 1 ? (
        <span key={index} className={`whitespace-nowrap ${figureClass}`}>
          {part}
        </span>
      ) : (
        part
      ),
    );
}

function AchievementText({ text, figureClass }: { text: string; figureClass: string }) {
  const lead = LEAD_BREAK.exec(text);
  if (lead === null || lead.index > LEAD_MAX_CHARS) return <>{withFigures(text, figureClass)}</>;
  return (
    <>
      <span className="font-semibold text-fg">{withFigures(text.slice(0, lead.index), figureClass)}</span>
      {withFigures(text.slice(lead.index), figureClass)}
    </>
  );
}

/* ─── Card parts ──────────────────────────────────────────────────────────── */

type Spotlight =
  | { readonly kind: 'stat'; readonly stat: NonNullable<HomeTeamMember['stat']> }
  | { readonly kind: 'achievement'; readonly text: string; readonly category: TeamAchievementCategory };

/** The spotlight, and the achievements left for the list beneath it. */
function splitSpotlight(member: HomeTeamMember): { spotlight: Spotlight | null; rest: HomeTeamMember['achievements'] } {
  if (member.stat) return { spotlight: { kind: 'stat', stat: member.stat }, rest: member.achievements };
  const [first, ...rest] = member.achievements;
  if (first === undefined) return { spotlight: null, rest };
  return { spotlight: { kind: 'achievement', text: first[0], category: first[1] }, rest };
}

function Photo({ member, photoUrl, sizes }: { member: HomeTeamMember; photoUrl: string | undefined; sizes: string }) {
  const [failed, setFailed] = useState(false);
  if (!photoUrl || failed) {
    return (
      <span
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gb-brand-50 to-gb-brand-100 font-display text-gb-display-md font-semibold text-gb-brand-300"
      >
        {teamInitials(member.name)}
      </span>
    );
  }
  return (
    <Image
      src={photoUrl}
      alt={member.name}
      fill
      sizes={sizes}
      className="object-cover object-[50%_22%]"
      onError={() => setFailed(true)}
    />
  );
}

/** The design's crest cell under the photo: the university's own mark. */
function Crest({ member, size }: { member: HomeTeamMember; size: 'card' | 'dialog' }) {
  const crest = member.crest === null ? null : crestFor(member.crest);
  const height = size === 'card' ? 'h-[22px] md:h-[26px]' : 'h-[28px]';
  if (crest === null) {
    return member.crestText ? (
      <span
        data-no-auto-translate
        className="line-clamp-2 text-center text-[11px] font-bold leading-[13px] text-fg-secondary md:text-gb-xs"
      >
        {member.crestText}
      </span>
    ) : null;
  }
  /* VinUniversity's mark is square (its lockup is white-only), so it carries
     its name beside it — except in the phone card's 96px cell, where the
     name would only truncate; the alt text still names it. */
  const square = crest.width === crest.height;
  return (
    <span className="flex min-w-0 items-center justify-center gap-gb-sm">
      <Image
        src={crest.src}
        alt={crest.name}
        width={crest.width}
        height={crest.height}
        className={`${height} w-auto max-w-full object-contain`}
      />
      {square ? (
        <span
          data-no-auto-translate
          aria-hidden="true"
          className={`truncate text-gb-xs font-bold text-fg-secondary ${size === 'card' ? 'max-md:hidden' : ''}`}
        >
          {crest.name}
        </span>
      ) : null}
    </span>
  );
}

function RoleChip({ member, locale }: { member: HomeTeamMember; locale: Locale }) {
  return (
    <span className="inline-flex rounded-gb-full border border-gb-brand-200 bg-brand-subtle px-gb-md py-gb-xxs text-gb-xs font-semibold text-fg-brand">
      {getLocaleText(locale, member.role)}
    </span>
  );
}

function SpotlightPanel({ spotlight, locale, full }: { spotlight: Spotlight; locale: Locale; full: boolean }) {
  return (
    <div className="relative flex items-center gap-gb-lg overflow-hidden rounded-gb-xl border border-gb-brand-200 bg-gradient-to-r from-gb-brand-50 to-surface py-gb-lg pl-gb-xl pr-gb-lg">
      {/* The rose edge that marks the one thing to read first. */}
      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px] bg-gradient-to-b from-gb-brand-700 to-gb-brand-500" />
      {spotlight.kind === 'stat' ? (
        <>
          <span
            className={`shrink-0 font-display text-gb-display-md font-semibold tracking-gb-display-tight tabular-nums ${highlightClass('light')}`}
          >
            {spotlight.stat.value}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-gb-sm font-semibold leading-[20px] text-fg">
              {getLocaleText(locale, spotlight.stat.label)}
            </span>
            <span className="mt-gb-xxs text-gb-xs text-fg-tertiary">{spotlight.stat.detail}</span>
          </span>
        </>
      ) : (
        <>
          <span className="flex size-[44px] shrink-0 items-center justify-center rounded-gb-full bg-surface shadow-gb-xs ring-1 ring-gb-brand-200">
            <GlowbalIcon name={CATEGORY_ICON[spotlight.category]} size={24} />
          </span>
          <p
            {...(full ? {} : { 'data-clamp': true })}
            className={`min-w-0 text-gb-md font-medium leading-[22px] text-fg-secondary ${full ? '' : 'line-clamp-2'}`}
          >
            <span className="sr-only">{getLocaleText(locale, spotlight.category)}: </span>
            <AchievementText
              text={getLocaleText(locale, spotlight.text)}
              figureClass={`font-semibold ${highlightClass('light')}`}
            />
          </p>
        </>
      )}
    </div>
  );
}

function Fact({
  icon,
  term,
  value,
  translate,
  full,
  className = '',
}: {
  icon: GlowbalIconName;
  term: string;
  value: string;
  translate: boolean;
  full: boolean;
  className?: string;
}) {
  return (
    <div className={`relative min-w-0 pl-[36px] ${className}`}>
      <dt className="text-[11px] font-semibold uppercase leading-[14px] tracking-[0.06em] text-fg-muted">
        <span
          aria-hidden="true"
          className="absolute left-0 top-0 flex size-[28px] items-center justify-center rounded-gb-md bg-brand-subtle"
        >
          <GlowbalIcon name={icon} size={16} />
        </span>
        {term}
      </dt>
      <dd
        {...(translate ? {} : { 'data-no-auto-translate': true })}
        {...(full ? {} : { 'data-clamp': true })}
        className={`mt-gb-xxs text-gb-sm font-medium leading-[18px] text-fg ${full ? '' : 'line-clamp-2'}`}
      >
        {value}
      </dd>
    </div>
  );
}

function Facts({ member, locale, full }: { member: HomeTeamMember; locale: Locale; full: boolean }) {
  return (
    <dl className="grid grid-cols-2 gap-x-gb-xl gap-y-gb-md">
      <Fact
        icon="universities"
        term={getLocaleText(locale, 'Studies at')}
        value={member.studies}
        translate={false}
        full={full}
      />
      <Fact
        icon="programs"
        term={getLocaleText(locale, 'Programme')}
        value={getLocaleText(locale, member.programme)}
        translate
        full={full}
      />
      {member.exchange ? (
        <Fact
          icon="planGlobalEducation"
          term={getLocaleText(locale, 'Exchange')}
          value={member.exchange}
          translate={false}
          full={full}
          className="col-span-2"
        />
      ) : null}
    </dl>
  );
}

function AchievementRow({
  text,
  category,
  locale,
  className = '',
}: {
  text: string;
  category: TeamAchievementCategory;
  locale: Locale;
  className?: string;
}) {
  return (
    <li className={`flex items-start gap-gb-md ${className}`}>
      <span
        aria-hidden="true"
        className="flex size-[28px] shrink-0 items-center justify-center rounded-gb-md border border-line bg-surface"
      >
        <GlowbalIcon name={CATEGORY_ICON[category]} size={16} />
      </span>
      <p className="min-w-0 pt-[4px] text-gb-sm leading-[20px] text-fg-secondary">
        <span className="sr-only">{getLocaleText(locale, category)}: </span>
        <AchievementText text={getLocaleText(locale, text)} figureClass="font-semibold text-fg-brand" />
      </p>
    </li>
  );
}

function TeamCard({
  member,
  photoUrl,
  locale,
  centre,
  onReadMore,
}: {
  member: HomeTeamMember;
  photoUrl: string | undefined;
  locale: Locale;
  centre: boolean;
  onReadMore: () => void;
}) {
  const { spotlight, rest } = splitSpotlight(member);
  const { cardRef, listRef, fit, cut } = useCardFit(rest.length);
  const hiddenRows = rest.length - fit;

  /* Phone: photo and crest top-left, name beside them, everything else
     below. From `md`: the design's two columns — photo over the crest cell
     on the left, the profile on the right. One grid, re-mapped by area. */
  return (
    <div
      ref={cardRef}
      inert={!centre}
      className="grid h-full grid-cols-[96px_minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] gap-x-gb-xl gap-y-gb-lg p-gb-2xl [grid-template-areas:'photo_header'_'body_body'] md:grid-cols-[minmax(0,31%)_minmax(0,1fr)] md:gap-x-gb-3xl md:gap-y-gb-lg md:p-gb-3xl md:[grid-template-areas:'photo_header'_'photo_body']"
    >
      <div className="flex min-h-0 flex-col gap-gb-md [grid-area:photo]">
        <div className="relative h-[96px] overflow-hidden rounded-gb-xl bg-surface-muted md:h-auto md:min-h-0 md:flex-1">
          <Photo member={member} photoUrl={photoUrl} sizes="(min-width: 768px) 300px, 192px" />
        </div>
        <div className="flex h-[36px] shrink-0 items-center justify-center rounded-gb-lg border border-line bg-surface px-gb-sm md:h-[52px]">
          <Crest member={member} size="card" />
        </div>
      </div>

      <header className="flex min-w-0 flex-col items-start justify-center gap-gb-sm [grid-area:header] md:flex-row md:flex-wrap md:items-center md:justify-start md:gap-x-gb-lg">
        <h3
          data-no-auto-translate
          className="font-display text-gb-xl font-semibold tracking-gb-display-tight text-fg md:text-gb-display-xs"
        >
          {member.name}
        </h3>
        <RoleChip member={member} locale={locale} />
      </header>

      <div className="flex min-h-0 min-w-0 flex-col gap-gb-lg [grid-area:body]">
        {member.intro ? (
          <p data-clamp className="line-clamp-2 text-pretty text-gb-sm leading-[20px] text-fg-tertiary">
            {getLocaleText(locale, member.intro)}
          </p>
        ) : null}

        {spotlight ? <SpotlightPanel spotlight={spotlight} locale={locale} full={false} /> : null}

        <Facts member={member} locale={locale} full={false} />

        <ul ref={listRef} className="relative flex min-h-0 flex-1 flex-col gap-gb-md overflow-hidden border-t border-line pt-gb-lg">
          {rest.map(([text, category], index) => (
            <AchievementRow
              key={text}
              text={text}
              category={category}
              locale={locale}
              className={index < fit ? '' : 'invisible'}
            />
          ))}
        </ul>

        {/* The foot is always there, so a card that fits keeps the same
            layout as one that is cut; only the cut ones fill it. */}
        <div className="-mt-gb-xs flex h-[36px] shrink-0 items-center justify-end">
          {cut ? (
            <button
              type="button"
              onClick={onReadMore}
              aria-haspopup="dialog"
              className="inline-flex min-h-[36px] items-center gap-gb-sm rounded-gb-full border border-gb-brand-200 bg-brand-subtle px-gb-lg text-gb-sm font-semibold text-fg-brand shadow-gb-xs transition-colors hover:bg-gb-brand-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              {hiddenRows > 0 ? (
                <span className="rounded-gb-full bg-brand px-gb-sm text-gb-xs leading-[18px] text-on-brand">
                  +{hiddenRows}
                </span>
              ) : null}
              {getLocaleText(locale, 'Read more')}
              <KitIcon art={ICONS.arrowRight} frame={14} />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** The whole profile, uncut. */
function TeamDialog({
  member,
  photoUrl,
  locale,
  onClose,
}: {
  member: HomeTeamMember | null;
  photoUrl: string | undefined;
  locale: Locale;
  onClose: () => void;
}) {
  const split = member ? splitSpotlight(member) : null;
  return (
    <Modal open={member !== null} onClose={onClose} label={member?.name ?? ''} className="max-w-3xl overflow-hidden p-0">
      {member && split ? (
        <div className="grid text-fg md:grid-cols-[240px_minmax(0,1fr)]">
          <div className="flex flex-col gap-gb-md bg-surface-muted p-gb-xl md:p-gb-2xl">
            <div className="relative h-[240px] overflow-hidden rounded-gb-xl bg-surface md:h-[300px]">
              <Photo member={member} photoUrl={photoUrl} sizes="(min-width: 768px) 240px, 100vw" />
            </div>
            <div className="flex h-[52px] items-center justify-center rounded-gb-lg border border-line bg-surface px-gb-sm">
              <Crest member={member} size="dialog" />
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-gb-xl p-gb-2xl md:p-gb-3xl">
            <button
              type="button"
              onClick={onClose}
              aria-label={getLocaleText(locale, 'Close')}
              className="absolute right-gb-lg top-gb-lg flex size-[44px] items-center justify-center rounded-gb-full bg-surface/80 text-fg-tertiary transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <KitIcon art={ICONS.close} frame={20} />
            </button>
            <header className="flex flex-wrap items-center gap-x-gb-lg gap-y-gb-sm pr-gb-5xl">
              <p data-no-auto-translate className="font-display text-gb-display-xs font-semibold tracking-gb-display-tight">
                {member.name}
              </p>
              <RoleChip member={member} locale={locale} />
            </header>
            {member.intro ? (
              <p className="-mt-gb-xs text-pretty text-gb-md text-fg-tertiary">{getLocaleText(locale, member.intro)}</p>
            ) : null}
            {split.spotlight ? <SpotlightPanel spotlight={split.spotlight} locale={locale} full /> : null}
            <Facts member={member} locale={locale} full />
            {split.rest.length > 0 ? (
              <ul className="flex flex-col gap-gb-md border-t border-line pt-gb-xl">
                {split.rest.map(([text, category]) => (
                  <AchievementRow key={text} text={text} category={category} locale={locale} />
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

function PauseGlyph({ paused }: { paused: boolean }) {
  return paused ? (
    <svg viewBox="0 0 16 16" width={14} height={14} aria-hidden="true" className="fill-current">
      <path d="M4.5 2.8v10.4a.6.6 0 0 0 .92.5l8.1-5.2a.6.6 0 0 0 0-1L5.42 2.3a.6.6 0 0 0-.92.5Z" />
    </svg>
  ) : (
    <svg viewBox="0 0 16 16" width={14} height={14} aria-hidden="true" className="fill-current">
      <rect x="3.5" y="2.5" width="3" height="11" rx="1" />
      <rect x="9.5" y="2.5" width="3" height="11" rx="1" />
    </svg>
  );
}

export function HomeTeam({ members = [], locale = 'en' }: { members?: readonly TeamMember[]; locale?: Locale }) {
  const [current, setCurrent] = useState(HOME_TEAM_START_INDEX);
  const [reading, setReading] = useState<HomeTeamMember | null>(null);
  const [userPaused, setUserPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [keyboardInside, setKeyboardInside] = useState(false);
  const [inView, setInView] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const pageVisible = usePageVisible();
  const stageRef = useRef<HTMLDivElement>(null);
  const swipeStart = useRef<number | null>(null);
  const swiped = useRef(false);
  const count = HOME_TEAM_ROSTER.length;

  const playing =
    !reducedMotion && !userPaused && !hovered && !keyboardInside && inView && pageVisible && reading === null;

  useEffect(() => {
    const node = stageRef.current;
    if (node === null) return undefined;
    const observer = new IntersectionObserver(
      (entries) => setInView(entries.some((entry) => entry.isIntersecting)),
      { threshold: 0.35 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const photos = new Map<string, string>();
  for (const member of members) {
    if (member.photo_url) photos.set(member.slug, member.photo_url);
  }
  const photoFor = (member: HomeTeamMember) =>
    member.portrait ?? member.photoSlugs.map((slug) => photos.get(slug)).find((url) => url !== undefined);

  const goTo = (index: number) => setCurrent(((index % count) + count) % count);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      goTo(current + 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      goTo(current - 1);
    }
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    swipeStart.current = event.clientX;
    swiped.current = false;
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (swipeStart.current === null) return;
    const dx = event.clientX - swipeStart.current;
    swipeStart.current = null;
    if (Math.abs(dx) > SWIPE_THRESHOLD_PX) {
      swiped.current = true;
      goTo(current + (dx < 0 ? 1 : -1));
    }
  };

  const turn: CSSProperties = { transitionDuration: `${TURN_MS}ms` };

  return (
    /* Pink from the numbers band above, easing to rose-100; the fade to white
       continues through journey and features (tokens.css,
       `--gb-home-band-team`). No border-top: a rule at
       the seam is exactly the banding the ramp removes. */
    <section
      id="team"
      className="scroll-mt-gb-9xl overflow-hidden bg-[image:var(--gb-home-band-team)] py-gb-7xl text-fg md:py-gb-9xl"
    >
      <div className="mx-auto flex max-w-gb-desktop flex-col items-start px-gb-xl md:px-gb-4xl">
        {/* No "The team behind your journey" eyebrow above the title — owner,
            2026-09-29: fewer text elements. Content PDF (3) §5: "GlowBal Team". */}
        <h2 className="max-w-[900px] text-balance font-display text-gb-display-sm font-semibold tracking-gb-display-tight text-fg md:text-gb-display-md">
          {highlightPhrases(getLocaleText(locale, 'GlowBal Team'), [getLocaleText(locale, 'Team')], 'tint')}
        </h2>
        <p className="mt-gb-3xl max-w-gb-width-xl text-pretty text-gb-md text-fg-tertiary md:text-gb-lg">
          {getLocaleText(
            locale,
            'GlowBal is driven by a distinguished team across technology, education, research, and communication, with first-hand experience in scholarships and study-abroad journeys. Combining student insight, specialist expertise, and technology, we turn fragmented advice into a clear, personalised system — from identifying the right competitions and research opportunities to strengthening CVs, SOPs, and overall application stories.',
          )}
        </p>
      </div>

      <div
        ref={stageRef}
        tabIndex={0}
        role="region"
        aria-roledescription="carousel"
        aria-label={getLocaleText(locale, 'The GlowBal team')}
        aria-live={playing ? 'off' : 'polite'}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerEnter={(event) => {
          if (event.pointerType === 'mouse') setHovered(true);
        }}
        onPointerLeave={() => setHovered(false)}
        onFocus={(event) => setKeyboardInside(event.target.matches(':focus-visible'))}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setKeyboardInside(false);
        }}
        onClickCapture={(event) => {
          // A swipe that ends on a side card must not also select it.
          if (swiped.current) {
            event.stopPropagation();
            swiped.current = false;
          }
        }}
        style={{ perspective: `calc(var(--team-card-w) * ${WALL_PERSPECTIVE})` }}
        className="relative mt-gb-6xl h-[var(--team-card-h)] touch-pan-y [--team-card-h:620px] [--team-card-w:min(100vw_-_40px,380px)] focus-visible:outline-2 focus-visible:outline-offset-8 focus-visible:outline-brand md:mt-gb-7xl md:[--team-card-h:500px] md:[--team-card-w:clamp(560px,46vw,680px)]"
      >
        {/* The soft rose shadow the centre card stands on. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-full h-[56px] w-[calc(var(--team-card-w)*0.9)] -translate-x-1/2 -translate-y-1/2 rounded-[50%] bg-gb-marketing-wine-700/25 blur-2xl"
        />
        {HOME_TEAM_ROSTER.map((member, index) => {
          const offset = ringOffset(index, current, count);
          const slot = Math.min(Math.abs(offset), PARKED_SLOT);
          const centre = offset === 0;

          return (
            <article
              key={member.name}
              aria-hidden={!centre}
              {...(centre ? { 'aria-roledescription': 'slide', 'aria-label': member.name } : {})}
              onClick={slot === 1 || slot === 2 ? () => goTo(index) : undefined}
              style={{ ...turn, transform: slotTransform(offset), zIndex: 10 - slot }}
              className={`absolute left-1/2 top-0 h-[var(--team-card-h)] w-[var(--team-card-w)] overflow-hidden rounded-gb-2xl border border-white/80 bg-surface text-left shadow-gb-lg transition-[transform,opacity] ease-[cubic-bezier(.65,0,.35,1)] [backface-visibility:hidden] motion-reduce:transition-none ${slotClass(slot)}`}
            >
              <TeamCard
                member={member}
                photoUrl={photoFor(member)}
                locale={locale}
                centre={centre}
                onReadMore={() => setReading(member)}
              />
              {/* The veil that sinks the side cards back into the band. Above
                  the content; side cards have nothing to press but the card. */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 z-[2] bg-gb-brand-50 transition-opacity ease-[cubic-bezier(.65,0,.35,1)] motion-reduce:transition-none"
                style={{ ...turn, opacity: SLOT_VEIL[slot] }}
              />
            </article>
          );
        })}
      </div>

      <div className="mt-gb-5xl flex items-center justify-center gap-gb-xl">
        {reducedMotion ? null : (
          <button
            type="button"
            onClick={() => setUserPaused((paused) => !paused)}
            /* The APG carousel pattern: the label says what pressing does,
               so no aria-pressed on top of it. */
            aria-label={getLocaleText(locale, userPaused ? 'Resume automatic rotation' : 'Pause automatic rotation')}
            className="flex size-[36px] items-center justify-center rounded-gb-full border border-line-strong bg-surface text-fg-secondary shadow-gb-xs transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <PauseGlyph paused={userPaused} />
          </button>
        )}
        <div className="flex items-center gap-gb-xs">
          {HOME_TEAM_ROSTER.map((member, index) => {
            const active = index === current;
            return (
              <button
                key={member.name}
                type="button"
                onClick={() => goTo(index)}
                aria-label={member.name}
                aria-current={active ? 'true' : undefined}
                className="flex h-gb-3xl items-center px-gb-xxs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <span
                  className={`relative block h-gb-md overflow-hidden rounded-gb-full transition-[width,background-color] duration-300 motion-reduce:transition-none ${
                    active ? 'w-gb-5xl bg-gb-brand-200' : 'w-gb-md bg-line-strong'
                  }`}
                >
                  {active ? (
                    /* The wall's clock: when this fill completes, the wall turns. */
                    <span
                      key={current}
                      aria-hidden="true"
                      onAnimationEnd={() => goTo(current + 1)}
                      style={{ animationDuration: `${DWELL_MS}ms` }}
                      className={`absolute inset-0 origin-left rounded-gb-full bg-brand animate-gb-team-dwell motion-reduce:animate-none motion-reduce:scale-x-100 ${
                        playing ? '' : '[animation-play-state:paused]'
                      }`}
                    />
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <TeamDialog
        member={reading}
        photoUrl={reading ? photoFor(reading) : undefined}
        locale={locale}
        onClose={() => setReading(null)}
      />
    </section>
  );
}
