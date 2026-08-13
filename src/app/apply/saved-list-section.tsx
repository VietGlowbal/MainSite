'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  attachedOptions,
  bestCoveragePercent,
  computeNetTuition,
  formatDeadlineLabel,
  formatUsdCompact,
  scholarshipCandidates,
  scholarshipLabel,
} from '@/features/universities/domain';
import { SCHOLARSHIP_SCOPE_LABELS } from '@/lib/scholarship-constants';
import { TID, testId } from '@/shared/lib/testids';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { ICONS, KitIcon } from '@/shared/ui/icons';
import { Modal } from '@/shared/ui/modal';
import { ApplySectionHeading } from './section-heading';

/**
 * The saved list — the cart. A SECTION, not a page: it renders inside
 * `ApplicationProgressClient`, below "My application", and ships no chrome of
 * its own.
 *
 * Figma 562:15078 ("Trang lưu"), which draws the applications tracker and this
 * list as one screen — 562:15092 is the heading here, 562:15098 the rows. It
 * supersedes 375:12701, the standalone page this file used to be, and which
 * lived at /my-universities until that URL was folded into /apply. The
 * satellite frames are unchanged and still apply: 375:12841 for the
 * scholarship-attached state, 375:13295 for the picker, 375:13369 for the
 * scholarship detail panel and 502:18462 for the confirmation.
 *
 * ONE DEPARTURE FROM 562:15078, on the owner's instruction: the new frame drops
 * the "Ngành … / Chọn lại ngành tại đây" line from every row (it is why the
 * rows shrink 272px → 188px). It is kept. That line is the only entry to
 * /my-universities/program, and since the merge it is load-bearing — "Plan my
 * application" needs a chosen subject to have a course URL to track. Ship the
 * tighter row, keep the link.
 *
 * ⚠️ FIRST BUILT FROM THE RETIRED CANVAS. The original version of this file was
 * written against 223:8824 / 223:13621 / 223:13022, which are the pre-migration
 * drawings on "Tính năng". The migrated frames add three elements per row that
 * simply are not on the old ones — tuition, the chosen subject, and the link to
 * re-pick it — so anyone comparing this file to 223:8824 will find things it
 * does not explain. Build against 375:*.
 *
 * Where this departs from the frames, and why:
 *
 *  1. NO SCHOLARSHIP CODE FIELD. The picker (375:13295, and 223:13022 before it)
 *     leads with "Mã học bổng" + "ÁP DỤNG" — a redeem-a-code control. There is
 *     no code anywhere in the schema: no voucher table, no code column, no
 *     endpoint. The migration to the new canvas did not add one, so the field
 *     stays out; shipping it would be a dead control of the kind /auth had two
 *     removed from. Everything else in that dialog is real and is built.
 *
 *  2. NO INVENTED PROGRAMME LINE. The frame's supporting text reads "Viện kinh
 *     doanh — Chương trình cử nhân kinh doanh quốc tế", i.e. school + course.
 *     There is no course catalogue in the database — no `programs`, `majors` or
 *     `university_programs` table, checked live — so that exact sentence cannot
 *     be produced for any of the 97 universities without making it up. The slot
 *     keeps `best_for`, which is a real sentence about the university, and the
 *     student's own chosen subject gets its own line below (the frame's 375:12743
 *     "Ngành …"), which is a fact because they chose it.
 *
 *  3. COUNTRY MOVES TO THE PIN. The frame's badge row is
 *     [QS rank][THE rank][country][institution type] and its details line is
 *     [pin "Remote"][clock deadline] — "Remote" being leftover text from the
 *     kit's job-post card this row is an instance of. There is no city column to
 *     put on a map pin, so country goes there (a pin means a place) and the
 *     badge row keeps the three facts that are not places. Same slots, no fact
 *     printed twice.
 *
 *  4. "Xóa" IS text-md, NOT text-xl. The frame's node is 20px, which would make
 *     the destructive link the largest text in the row — larger than the
 *     university name. The layer is named "Supporting text" and carries "92%" in
 *     the sibling "My application" frames, so its size is inherited from a
 *     repurposed layer rather than chosen.
 *
 *  5. NO MOBILE FRAME EXISTS for this page, so the row reflows here: the
 *     checkbox and Remove share a top line, then the cover, then the card.
 *
 *  7. "PLAN MY APPLICATION" IS THE PRIMARY ACTION, NOT A STATE THE SCHOLARSHIP
 *     BAR SWAPS INTO. 375:12841 draws it replacing "Apply Học bổng" once an
 *     award is attached, which made creating an application conditional on
 *     having one — and a university with no scholarship in the directory could
 *     therefore never be planned at all. Since this is the only way to create
 *     an application (the URL importer is gone, 01/08), the two are now
 *     independent: plan whenever something is ticked, attach an award when
 *     there is one to attach. See the note on the buttons.
 *
 *  6. TICKING A ROW SHOWS ON THE ROW. The frame draws a checked box (562:15100)
 *     and changes nothing else, which was survivable when the tick only fed a
 *     dialog and is not now: the tick decides which universities "Apply
 *     scholarship" and "Plan my application" act on, and a 16px box at the far
 *     left of a 188px card is not enough signal for a destructive-ish batch
 *     action. The chosen row gets the brand border and a rose wash.
 *
 * Colour, added 01/08 after the owner called the page boring: the heading is
 * Rose/600 with the heart mark the frame draws beside it (both were missing —
 * see section-heading.tsx), the scholarship bar became the rose panel its own
 * rose gift icon and rose headline were already asking for, and the cover
 * answers the pointer.
 */

export type ScholarshipOption = {
  id: number;
  name: string;
  amountLabel: string | null;
  deadlineLabel: string | null;
  coverage: string | null;
  /* What the discount maths reads: `bestCoveragePercent` for the bar's headline
     and `computeNetTuition` for the row's net figure. */
  fundingType: string[] | null;
  amountMin: number | null;
  amountMax: number | null;
  amountCurrency: string | null;
  /* The rest feed the detail panel — Figma 375:13369, "Chi tiết voucer". */
  scope: string | null;
  eligibility: string | null;
  conditions: string | null;
  insight: string | null;
  appliesToText: string | null;
  sourceUrl: string | null;
};

export type SavedRow = {
  /** user_universities.id */
  id: number;
  universityId: number;
  name: string;
  country: string;
  type: string | null;
  qsRank: number | null;
  theRank: number | null;
  deadline: string | null;
  summary: string | null;
  imageUrl: string | null;
  /** Crest, shown beside each option in the picker (Figma 375:13305). */
  logoUrl: string | null;
  /** Resolved via features/universities/domain — null for most universities. */
  website: string | null;
  /** Card-sized tuition, already through `formatTuitionForCard`. "—" when absent. */
  tuition: string;
  /** The unabridged `tuition_usd` prose: the title attribute, and the net maths. */
  tuitionRaw: string | null;
  /**
   * The subject the student picked for this university (375:12743, "Ngành …").
   *
   * Null both when they have not picked one and when
   * supabase-saved-program.sql has not been applied — the row renders an
   * invitation to choose in either case, which is true either way.
   */
  program: string | null;
  /** A course page they pasted when the directory did not list their subject. */
  programUrl: string | null;
  attached: Array<{ savedId: number; id: number; name: string; amountLabel: string | null }>;
  options: ScholarshipOption[];
};

const CHECKBOX =
  'size-gb-4xl shrink-0 cursor-pointer rounded-gb-sm border-2 border-line-strong accent-brand ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';

/**
 * `scholarships.scope` as a label rather than the stored enum.
 *
 * Falls back to the raw value for a scope the map does not know, which is better
 * than blanking a badge the frame draws — and is how a new enum value would
 * announce itself rather than disappearing.
 */
function scopeLabel(scope: string): string {
  return (
    (SCHOLARSHIP_SCOPE_LABELS as Record<string, string | undefined>)[scope] ?? scope
  );
}

/**
 * The row's money line — Figma 375:12740, the rose badge under the summary.
 *
 * ONE BADGE, TWO MEANINGS, AND THE DIFFERENCE IS THE POINT. The frame draws
 * "10,000USD/ năm" on the plain state and "5.000USD/ năm" on the row that has a
 * scholarship attached (375:12841), while its bar reads "Học bổng 50%". So the
 * slot holds the price of the thing, and the price changes when the voucher is
 * applied — which is what makes the page a cart rather than a list.
 *
 * The net figure is only shown when it can be computed from real values:
 * `computeNetTuition` needs a parseable tuition range and either a coverage
 * percentage or a cash award it can convert. Roughly half the rows have prose
 * tuition that yields no range ("Approx. $15,000–18,000/year before subsidy
 * (program-dependent…)" does, "Varies by programme" does not), and those keep
 * the list price alone rather than showing a discount nobody can check.
 */
function TuitionBadges({ row }: { row: SavedRow }) {
  const attached = attachedOptions(row);
  const net = computeNetTuition(row.tuitionRaw, attached);
  const hasTuition = row.tuition !== '—';

  if (!hasTuition) return null;

  /*
   * "Free" is a whole answer, not an amount, so it does not take the period.
   * `formatTuitionForCard` returns it for the tuition-free systems in the table
   * (Paris-Saclay, and the other publicly funded rows), and "Free / year" reads
   * like a broken template.
   */
  const isFree = row.tuition === 'Free';

  if (!net) {
    return (
      <div className="flex flex-wrap items-center gap-gb-md">
        {/* `title` on a wrapper rather than on Badge: the primitive takes only
            `variant` and `className`, and widening a design-system component so
            one page can hang a tooltip on it is the wrong direction. */}
        <span title={row.tuitionRaw ?? undefined}>
          {/* " / year" is its own text node so the dictionary can reach it — the
              amount beside it is a formatted number and must not be translated. */}
          <Badge variant="brand-subtle">
            {row.tuition}
            {isFree ? null : <span className="font-normal"> / year</span>}
          </Badge>
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-gb-md">
      <span title={net.scholarshipName}>
        <Badge variant="brand-subtle">
          {formatUsdCompact(net.netLo, net.netHi)}
          <span className="font-normal"> / year</span>
        </Badge>
      </span>
      {/* The list price stays visible and struck through: a student comparing
          two saved rows needs to know which number is the discounted one. */}
      <span
        className="text-gb-sm text-fg-muted line-through"
        title={row.tuitionRaw ?? undefined}
      >
        {row.tuition}
      </span>
    </div>
  );
}

/**
 * "Ngành … / Chọn lại ngành tại đây" — Figma 375:12741.
 *
 * When nothing has been picked the label is an invitation rather than a value.
 * The frame only draws the chosen state, and printing a plausible-looking
 * subject into an empty slot would be inventing the student's own answer.
 */
function ProgramRow({ row }: { row: SavedRow }) {
  const href = `/my-universities/program?u=${row.universityId}`;

  return (
    <div className="flex flex-wrap items-center gap-gb-lg">
      {row.program ? (
        /* The label and the value are separate text nodes on purpose: DomTranslator
           keys on whole nodes, so "Subject:" is a dictionary hit and the subject
           itself — which is the university's own wording — is left alone. */
        <span className="text-gb-md text-fg">
          <span className="text-fg-tertiary">Subject:</span> {row.program}
        </span>
      ) : (
        <span className="text-gb-md text-fg-tertiary">No subject chosen yet</span>
      )}
      {row.programUrl ? (
        <a
          href={row.programUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="flex items-center gap-gb-xs text-gb-sm font-semibold text-fg-tertiary hover:text-fg"
        >
          Course page
          <KitIcon art={ICONS.arrowUpRight} frame={16} />
        </a>
      ) : null}
      <Link
        href={href}
        className="flex items-center gap-gb-xs text-gb-sm font-semibold text-brand hover:text-brand-hover"
      >
        {row.program ? 'Change subject here' : 'Choose a subject here'}
        <KitIcon art={ICONS.arrowUpRight} frame={20} />
      </Link>
    </div>
  );
}

/**
 * The awards the student has attached to this row — Figma 375:12841's badge row.
 *
 * ⚠️ THIS IS THE ONE SLOT ON THE CARD HOLDING AN UNBOUNDED PROVIDER STRING, and
 * it shipped printing it whole. `Badge` bakes `whitespace-nowrap` (the primitive
 * documents this as its known trap), so a real name — "Amsterdam Merit
 * Scholarships for Master's Students at University of Amsterdam 2026 (Fully
 * Funded) · 2,000–25,900 EUR" — rendered an 840px pill inside a 779px card and
 * hung 87px out over the page. Reported by the owner 01/08 with a screenshot,
 * reproduced and measured at 1440 before this was written.
 *
 * Two fixes, in this order, because they are not alternatives:
 *
 *  1. `scholarshipLabel` drops the " at <university>" the card's own heading
 *     already says. That is 26 of those 96 characters and, unlike an ellipsis,
 *     it costs the reader nothing.
 *  2. What is left truncates against the card. `min-w-0` at every level down to
 *     the pill is what makes that possible — a flex item defaults to
 *     `min-width: auto`, i.e. "never shrink below my content", which is
 *     precisely how a nowrap pill grows past its parent. The untouched name
 *     stays reachable on `title`.
 *
 * THE MONEY DOES NOT TRUNCATE. `amountLabel` is short, exact, and the reason a
 * student scans this row at all, so it is `shrink-0` and the name gives way
 * first — the same priority the picker's card sets by drawing the value largest.
 */
function AttachedScholarships({ row }: { row: SavedRow }) {
  return (
    <ul className="flex min-w-0 flex-wrap gap-gb-md">
      {row.attached.map((s) => (
        /* `title` on the wrapper, not the pill: `Badge` takes only `variant`
           and `className`, as the tuition badge above also notes. */
        <li key={s.savedId} className="flex min-w-0 max-w-full" title={s.name}>
          <Badge variant="brand-subtle" className="min-w-0 max-w-full">
            <span className="min-w-0 truncate">{scholarshipLabel(s.name, row.name)}</span>
            {s.amountLabel ? (
              <span className="shrink-0">{' · '}{s.amountLabel}</span>
            ) : null}
          </Badge>
        </li>
      ))}
    </ul>
  );
}

function SavedRowItem({
  row,
  selected,
  onToggle,
  onRemove,
  removing,
}: {
  row: SavedRow;
  selected: boolean;
  onToggle: (universityId: number) => void;
  onRemove: (row: SavedRow) => void;
  removing: boolean;
}) {
  const deadline = formatDeadlineLabel(row.deadline);

  return (
    <li
      {...testId(TID.uniCard)}
      /* The scroll target for ?focus=<universityId> — see the effect in
         SavedListSection. A data attribute rather than an id: `id` on a list row
         is a document-wide name, and these are already keyed by university. */
      data-university-id={row.universityId}
      className={`group flex flex-wrap items-center gap-gb-lg lg:gap-gb-3xl ${
        removing ? 'pointer-events-none opacity-50' : ''
      }`}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onToggle(row.universityId)}
        aria-label={`Select ${row.name}`}
        className={`order-1 ${CHECKBOX}`}
      />

      <button
        type="button"
        onClick={() => onRemove(row)}
        className="order-2 ml-auto rounded-gb-md px-gb-sm py-gb-xs text-gb-md font-medium text-fg-tertiary transition-colors hover:text-fg-error focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand lg:order-4 lg:ml-0"
      >
        Remove
      </button>

      <div
        className={`relative order-3 w-full overflow-hidden rounded-gb-2xl bg-surface-muted transition-shadow duration-200 lg:order-2 lg:h-[188px] lg:w-[260px] lg:shrink-0 ${
          selected ? 'ring-2 ring-brand' : ''
        }`}
      >
        {row.imageUrl ? (
          /* Plain <img>, matching FadeInImage on /universities: cover images come
             from arbitrary hosts and next/image would reject anything not in
             next.config.ts's remotePatterns. */
          <Image
            src={row.imageUrl}
            alt=""
            fill
            sizes="(max-width: 1024px) 100vw, 260px"
            className="aspect-[260/188] w-full object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100 lg:h-full"
          />
        ) : (
          <div className="flex aspect-[260/188] w-full items-center justify-center lg:h-full">
            <span className="font-display text-gb-display-sm text-fg-muted">
              {row.name.slice(0, 1)}
            </span>
          </div>
        )}
      </div>

      {/*
        `lg:min-h-[188px]` is the cover's height, and it is load-bearing rather
        than decorative: every row in the frame is exactly as tall as its cover
        because the mockup's cards all carry the same fields. Real rows do not —
        a university with no ranking, summary or type collapses to two lines, and
        without the floor the cover sticks out above and below a card half its
        height. With it, `justify-between` drops the details line to the bottom
        and the row keeps the design's geometry.

        The floor is the COVER's 188px, not the frame's 272px card. 375:12726 is
        272 tall because it holds two more lines than 223:9485 did, and those two
        lines are conditional here (a university with no tuition and no chosen
        subject renders neither). Pinning 272 would leave that row padded with
        empty space instead of closing up.
      */}
      <article
        className={`order-4 flex w-full flex-col justify-between gap-gb-2xl rounded-gb-2xl border p-gb-3xl transition duration-200 group-hover:shadow-gb-lg lg:order-3 lg:min-h-[188px] lg:min-w-0 lg:flex-1 ${
          /*
            Departure (6): the tick has to be legible from across the card.
            A DOUBLED ROSE EDGE, NOT A ROSE FILL. Washing the card in Rose/50
            was the first attempt and it erases the row's own content — the
            rank pills, the tuition badge and any attached scholarship are all
            `brand-subtle`, i.e. that exact Rose/50, so they vanish into the
            card the moment it is ticked. The border keeps the surface white
            and the badges readable; the cover's ring and the rose checkbox
            carry the rest of the signal.
          */
          selected
            ? 'border-brand bg-surface shadow-gb-lg ring-1 ring-brand'
            : 'border-line bg-surface group-hover:border-gb-brand-300'
        }`}
      >
        <div className="flex flex-col gap-gb-xl">
          <div className="flex flex-col gap-gb-md">
            {/* h3: this row sits under the section's own h2 ("Saved list"),
                which sits under the page's h1 ("My application"). It was an h2
                when this section was a page with its own h1. */}
            <h3 className="text-gb-md font-semibold text-fg">{row.name}</h3>
            <div className="flex flex-wrap gap-gb-lg">
              {/*
                Number and label as separate text nodes, for the reason given on
                the scholarship bar: no machine-translation fallback on this
                route, so "#90 THE Ranking" as one node can never be a dictionary
                hit. It showed half-translated in Vietnamese — the QS badge only
                worked because a stale entry survived in the localStorage MT cache
                from before /my-universities was marked PII.
              */}
              {row.qsRank != null ? (
                <Badge variant="brand-subtle">
                  #{row.qsRank} <span>QS World Ranking</span>
                </Badge>
              ) : null}
              {row.theRank != null ? (
                <Badge variant="brand-subtle">
                  #{row.theRank} <span>THE Ranking</span>
                </Badge>
              ) : null}
              {row.type ? <Badge variant="neutral">{row.type}</Badge> : null}
            </div>
          </div>
          {/* 375:12739. `best_for` — see departure (2) in the header. */}
          {row.summary ? (
            <p className="line-clamp-2 text-gb-md text-fg-tertiary">{row.summary}</p>
          ) : null}
          <TuitionBadges row={row} />
          <ProgramRow row={row} />
          {row.attached.length > 0 ? <AttachedScholarships row={row} /> : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-gb-lg">
          <div className="flex flex-wrap items-center gap-gb-xl">
            <span className="flex items-center gap-gb-sm text-gb-sm font-semibold text-fg-tertiary">
              <KitIcon art={ICONS.markerPin02} frame={20} className="text-fg-muted" />
              {row.country}
            </span>
            {deadline ? (
              <span className="flex items-center gap-gb-sm text-gb-sm font-semibold text-fg-tertiary">
                <KitIcon art={ICONS.clock} frame={20} className="text-fg-muted" />
                <span>Deadline:</span> {deadline}
              </span>
            ) : null}
          </div>
          {row.website ? (
            <a
              href={row.website}
              target="_blank"
              rel="noreferrer noopener"
              className="flex items-center gap-gb-xs text-gb-sm font-semibold text-brand hover:text-brand-hover"
            >
              Official site
              <KitIcon art={ICONS.arrowUpRight} frame={20} />
            </a>
          ) : (
            /* No website in the lookup — a link labelled "Official site" that
               points at a guess would be worse than one that points somewhere
               real, so it points at the in-app profile instead.

               `/universities/<id>`, not the old `?u=<id>`: that query form is now
               only a compatibility shim that client-side `router.replace`s to
               this URL, so linking to it costs a redirect for no reason. */
            <Link
              href={`/universities/${row.universityId}`}
              className="flex items-center gap-gb-xs text-gb-sm font-semibold text-brand hover:text-brand-hover"
            >
              View profile
              <KitIcon art={ICONS.arrowRight} frame={20} />
            </Link>
          )}
        </div>
      </article>
    </li>
  );
}

/** One labelled prose block on the detail panel. Hidden when the column is null. */
function DetailBlock({ heading, body }: { heading: string; body: string | null }) {
  if (!body) return null;
  return (
    <div className="flex flex-col gap-gb-md">
      <h3 className="text-gb-sm font-semibold text-fg">{heading}</h3>
      {/* The columns are free prose with real newlines in them, so preserve the
          author's line breaks rather than collapsing them into one paragraph. */}
      <p className="whitespace-pre-line text-gb-sm leading-relaxed text-fg-tertiary">{body}</p>
    </div>
  );
}

/**
 * The scholarship detail panel — Figma 375:13369, "Chi tiết voucer" (337:19349
 * on the retired canvas; the two are the same drawing).
 *
 * Despite the frame's name there is no voucher here: every field on it maps to a
 * real `scholarships` column (coverage, eligibility, conditions, insight,
 * applies_to_text, deadline). The picker it opens from leads with a "Mã học bổng"
 * redeem-a-code control, which is the part with no schema behind it and stays
 * unbuilt — see the note at the top of this file.
 */
function ScholarshipDetail({
  option,
  universityName,
  universityLogoUrl,
  onBack,
}: {
  option: ScholarshipOption;
  universityName: string;
  universityLogoUrl?: string | null;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col gap-gb-3xl">
      {/* Figma 337:19352 — title and "Trở về" */}
      <div className="flex items-start justify-between gap-gb-xl">
        <h2 className="text-gb-lg font-semibold text-fg">{option.name}</h2>
        <Button variant="secondary" size="sm" onClick={onBack} className="shrink-0">
          Back
        </Button>
      </div>

      {option.scope ? (
        <div className="flex flex-wrap gap-gb-md">
          <Badge variant="brand-subtle">{scopeLabel(option.scope)}</Badge>
        </div>
      ) : null}

      {/* Figma 337:19366 — the value card */}
      <div className="flex items-start gap-gb-xl rounded-gb-xl border border-line p-gb-xl">
        {universityLogoUrl ? (
          /* Crests come from arbitrary hosts, so a plain <img> as elsewhere. */
          <Image
            src={universityLogoUrl}
            alt=""
            width={64}
            height={64}
            className="size-gb-7xl shrink-0 object-contain"
          />
        ) : null}
        <div className="flex min-w-0 flex-col gap-gb-md">
          <span className="text-gb-sm text-fg-secondary">Scholarship value</span>
          {option.amountLabel ? (
            <span className="text-gb-display-xs font-semibold text-brand">{option.amountLabel}</span>
          ) : (
            <span className="text-gb-md text-fg-tertiary">Value not published</span>
          )}
          {option.coverage ? (
            <p className="whitespace-pre-line text-gb-sm text-fg-tertiary">{option.coverage}</p>
          ) : null}
          {option.deadlineLabel ? (
            <span className="flex items-center gap-gb-sm text-gb-sm text-fg-tertiary">
              <KitIcon art={ICONS.clock} frame={20} className="shrink-0" />
              <span>Deadline:</span> {option.deadlineLabel}
            </span>
          ) : null}
        </div>
      </div>

      <DetailBlock heading="Who it is for" body={option.eligibility} />
      <DetailBlock heading="Application conditions" body={option.conditions} />
      <DetailBlock heading="Analysis" body={option.insight} />

      {/* Figma 337:19470 — "Trường áp dụng". The free-text column is the
          scholarship's own wording; the saved university is the structured link
          that actually put this option in front of the student. */}
      <div className="flex flex-col gap-gb-md">
        <h3 className="text-gb-sm font-semibold text-fg">Applies to</h3>
        <div className="flex flex-wrap gap-gb-md">
          <Badge variant="neutral">{universityName}</Badge>
        </div>
        {/* The free-text column very often just restates the university the
            badge above already names ("Massachusetts Institute of Technology
            (MIT)"), so it is shown only when it adds something. */}
        {option.appliesToText && !option.appliesToText.includes(universityName) ? (
          <p className="text-gb-sm text-fg-tertiary">{option.appliesToText}</p>
        ) : null}
      </div>

      {option.sourceUrl ? (
        <Link
          href={option.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-gb-xs text-gb-sm font-semibold text-brand hover:text-brand-hover"
        >
          Open the official page
          <KitIcon art={ICONS.arrowUpRight} frame={20} />
        </Link>
      ) : null}
    </div>
  );
}

type Candidate = {
  option: ScholarshipOption;
  universityId: number;
  universityName: string;
  universityLogoUrl?: string | null;
};

/**
 * One scholarship in the picker — Figma 375:13305.
 *
 * The frame's layout, which is different from the one this dialog used to have:
 * crest on the left behind a vertical rule, then the scope badge, the name, the
 * value in large rose type, and a footer of deadline + "Xem chi tiết". The radio
 * sits on the right. Value is the loudest thing in the card because it is what
 * the student is choosing between.
 */
function ScholarshipCandidateCard({
  candidate,
  chosen,
  onChoose,
  onView,
  selectable,
}: {
  candidate: Candidate;
  chosen: boolean;
  onChoose: () => void;
  onView: () => void;
  /**
   * Browse mode (opened from "Scholarships here") lists what is on offer and
   * has nothing to confirm, so it draws no radio. An input that leads to a
   * disabled button is a dead control.
   */
  selectable: boolean;
}) {
  const { option, universityName, universityLogoUrl } = candidate;

  const body = (
    <>
      {universityLogoUrl ? (
        /* Same reason as the row cover: crests come from arbitrary hosts, so a
           plain <img> rather than next/image. */
        <Image
          src={universityLogoUrl}
          alt=""
          width={110}
          height={48}
          className="h-gb-6xl w-[110px] shrink-0 object-contain"
        />
      ) : (
        /* The frame always has a crest. 9 of 106 rows have no logo_url, and
           without a placeholder the divider and text jump left on those. */
        <span className="flex h-gb-6xl w-[110px] shrink-0 items-center justify-center font-display text-gb-xl text-fg-muted">
          {universityName.slice(0, 1)}
        </span>
      )}

      {/* 375:13309 sits behind a 1px rule in the frame. */}
      <span className="flex min-w-0 flex-1 flex-col gap-gb-md border-l border-line pl-gb-xl">
        {/* The label, not the raw enum. `scope` is stored as "university" /
            "country" / "consortium" / "provider", and printing it straight into
            the frame's badge slot leaks a database value into the UI — the
            scholarships directory has mapped it through
            SCHOLARSHIP_SCOPE_LABELS since it was built, and the dictionary
            already carries the four translations. */}
        {option.scope ? (
          <span className="flex">
            <Badge variant="brand-subtle">{scopeLabel(option.scope)}</Badge>
          </span>
        ) : null}
        <span className="text-gb-sm font-semibold text-fg">{option.name}</span>
        {/* Real scholarship names are frequently "<award> at <university>
            <year>", so printing the university underneath would say it twice.
            Shown only when the name does not already carry it. */}
        {option.name.includes(universityName) ? null : (
          <span className="text-gb-sm text-fg-tertiary">{universityName}</span>
        )}
        {option.amountLabel ? (
          <span className="text-gb-xl font-semibold text-brand">{option.amountLabel}</span>
        ) : (
          <span className="text-gb-sm text-fg-tertiary">Value not published</span>
        )}
        <span className="flex w-full min-w-0 flex-wrap items-center justify-between gap-gb-lg">
          {option.deadlineLabel ? (
            /*
              CLAMPED TO ONE LINE. `deadline_text` is free prose and some rows run
              to a paragraph — "Đợt 1 (Gia hạn cho L2/M1 lên năm tiếp theo): Nộp
              đơn từ 15/04 đến 30/04 … Đợt 2 …" is six lines on this card, which
              pushes the next scholarship out of the dialog. The full string stays
              reachable as a title and again, unclamped, in the detail panel.
            */
            <span
              className="flex min-w-0 flex-1 items-center gap-gb-sm text-gb-sm text-fg-tertiary"
              title={option.deadlineLabel}
            >
              <KitIcon art={ICONS.clock} frame={20} className="shrink-0" />
              <span className="shrink-0">Deadline:</span>
              <span className="truncate">{option.deadlineLabel}</span>
            </span>
          ) : (
            <span />
          )}
          {/*
            A <button>, not a nested link, and outside the <label> below for the
            same reason: a control inside a label is activated by clicking the
            label, so putting "Xem chi tiết" in there would open the detail panel
            every time the student picked the scholarship.
          */}
          <button
            type="button"
            onClick={onView}
            className="flex shrink-0 items-center gap-gb-xs rounded-gb-md text-gb-sm font-semibold text-brand hover:text-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            See details
            <KitIcon art={ICONS.arrowUpRight} frame={20} />
          </button>
        </span>
      </span>
    </>
  );

  return (
    <div
      className={`flex min-w-0 items-center gap-gb-xl rounded-gb-xl border p-gb-xl transition-colors ${
        chosen ? 'border-brand bg-brand-subtle' : 'border-line'
      }`}
    >
      {selectable ? (
        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-gb-xl">
          {body}
          <input
            type="radio"
            name="scholarship-choice"
            checked={chosen}
            onChange={onChoose}
            aria-label={`Choose ${option.name}`}
            className="size-gb-2xl shrink-0 cursor-pointer accent-brand"
          />
        </label>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-gb-xl">{body}</div>
      )}
    </div>
  );
}

function ScholarshipPicker({
  open,
  mode,
  onClose,
  candidates,
  onApply,
  busy,
}: {
  open: boolean;
  /**
   * `apply` is the frame's dialog: pick one, confirm. `browse` is the same list
   * opened from "Scholarships here" — read-only, so it drops the radios and the
   * confirm button.
   */
  mode: 'apply' | 'browse';
  onClose: () => void;
  /** Every scholarship linked to the universities in scope, with its university. */
  candidates: Candidate[];
  onApply: (choice: { scholarshipId: number; universityId: number }) => void;
  busy: boolean;
}) {
  const [chosen, setChosen] = useState<string | null>(null);
  /* `${universityId}:${scholarshipId}` of the row whose detail panel is open. */
  const [viewing, setViewing] = useState<string | null>(null);

  const viewed = viewing
    ? candidates.find(({ option, universityId }) => `${universityId}:${option.id}` === viewing)
    : undefined;

  /*
   * The detail panel takes over the same dialog rather than stacking a second
   * one: the frame draws one surface with a "Trở về" that returns to the list,
   * and nesting modals would trap focus twice over.
   */
  // Closing the dialog from the detail panel must not leave it open behind the
  // scrim for the next time the picker is used.
  const close = () => {
    setViewing(null);
    onClose();
  };

  if (viewed) {
    return (
      <Modal
        open={open}
        onClose={close}
        label={viewed.option.name}
        className="max-h-[85vh] max-w-[720px] overflow-y-auto p-gb-3xl"
      >
        <ScholarshipDetail
          option={viewed.option}
          universityName={viewed.universityName}
          universityLogoUrl={viewed.universityLogoUrl}
          onBack={() => setViewing(null)}
        />
      </Modal>
    );
  }

  const heading = mode === 'apply' ? 'Apply a scholarship' : 'Scholarships for your saved list';

  return (
    <Modal open={open} onClose={close} label={heading} className="max-w-[720px] p-gb-3xl">
      <h2 className="text-gb-lg font-semibold text-fg">{heading}</h2>
      <p className="mt-gb-md text-gb-sm text-fg-tertiary">
        {candidates.length === 0
          ? mode === 'apply'
            ? 'None of the universities you selected have a scholarship in our directory yet.'
            : 'None of the universities on your saved list have a scholarship in our directory yet.'
          : mode === 'apply'
            ? 'Pick a scholarship to attach to your saved university. It will show on the university and in your plan.'
            : 'Everything our directory links to the universities you saved. Open one to see who it is for and what it covers.'}
      </p>

      {/*
        `min-w-0` on the fieldset below is load-bearing, not tidiness: <fieldset>
        computes to `min-width: min-content` by default, so a `truncate` inside it
        has nothing to truncate against and the widest scholarship's prose
        deadline stretches the whole dialog past the viewport instead. Measured —
        the dialog rendered 1440px wide before this.
      */}
      {candidates.length > 0 ? (
        <fieldset className="mt-gb-3xl flex max-h-[52vh] min-w-0 flex-col gap-gb-lg overflow-y-auto">
          <legend className="sr-only">Available scholarships</legend>
          {candidates.map((candidate) => {
            const value = `${candidate.universityId}:${candidate.option.id}`;
            return (
              <ScholarshipCandidateCard
                key={value}
                candidate={candidate}
                chosen={chosen === value}
                onChoose={() => setChosen(value)}
                onView={() => setViewing(value)}
                selectable={mode === 'apply'}
              />
            );
          })}
        </fieldset>
      ) : null}

      {/* 375:13368 — the actions sit bottom-right. Browse mode has one button,
          because there is nothing to confirm. */}
      <div className="mt-gb-3xl flex items-center justify-end gap-gb-lg">
        <Button variant="secondary" size="lg" onClick={close}>
          {mode === 'apply' ? 'Back' : 'Close'}
        </Button>
        {mode === 'apply' ? (
          <Button
            size="lg"
            disabled={!chosen || busy}
            onClick={() => {
              if (!chosen) return;
              const [uni, sch] = chosen.split(':');
              onApply({ universityId: Number(uni), scholarshipId: Number(sch) });
            }}
          >
            {busy ? 'Please wait...' : 'Apply scholarship now'}
          </Button>
        ) : null}
      </div>
    </Modal>
  );
}

/**
 * The confirmation — Figma 502:18462, the last frame in the "Trang lưu" cluster.
 *
 * A dialog rather than a route. The frame is a full page, but it is the end of an
 * action taken on this one and has nothing of its own to load; giving it a URL
 * would make it reachable by typing, and a congratulations page that congratulates
 * you for nothing is worse than no page.
 *
 * The frame's heading reads "Thanh you for you applycation". Shipped as "Thank
 * you for your application" — three typos in a row is a slip, not a voice.
 */
function ScholarshipApplied({
  open,
  onClose,
  onGoToApplications,
  scholarshipName,
}: {
  open: boolean;
  onClose: () => void;
  onGoToApplications: () => void;
  scholarshipName: string | null;
}) {
  return (
    <Modal open={open} onClose={onClose} label="Scholarship added" className="max-w-[560px] p-gb-5xl">
      <div className="flex flex-col items-center gap-gb-2xl text-center">
        {/*
          The frame draws a solid green disc with a white tick. The token set has
          no solid green surface — `tier-safe` is the pale Green/50 fill and
          `on-tier-safe` its Green/700 ink, which is the pairing the whole
          admission-tier system uses. Rather than reach past the tokens for one
          decorative circle, this is that pairing: pale disc, green tick. Same
          meaning, and it stays correct if the ramp is ever retuned.
        */}
        <span className="flex size-gb-7xl items-center justify-center rounded-gb-full bg-tier-safe text-on-tier-safe">
          <KitIcon art={ICONS.checkCircle} frame={32} />
        </span>
        <h2 className="font-display text-gb-display-sm font-medium tracking-gb-display-tight text-fg">
          Thank you for your application
        </h2>
        {/* Name on its own line rather than inside the sentence — see the note on
            the bar above: this route gets no machine-translation fallback, so an
            interpolated sentence could never be translated. */}
        {scholarshipName ? (
          <p className="text-gb-md font-semibold text-fg">{scholarshipName}</p>
        ) : null}
        <p className="text-gb-md text-fg-tertiary">
          Your scholarship is now part of your plan.
        </p>
        <div className="mt-gb-lg flex flex-wrap items-center justify-center gap-gb-lg">
          <Button variant="secondary" size="lg" onClick={onClose}>
            Back to my saved list
          </Button>
          {/*
            Was `href="/apply"`. Since the merge that is this same page, so the
            CTA scrolls to "My application" instead of navigating — which is
            also what it always meant: "show me what this is now part of".
          */}
          <Button size="lg" onClick={onGoToApplications}>
            Go to my plan
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function SavedListSection({
  rows: initialRows,
  onPlan,
  onGoToApplications,
  planning = false,
  focusUniversityId = null,
}: {
  rows: SavedRow[];
  /**
   * "Lên kế hoạch ứng tuyển" — hand the ticked rows up to the shell, which
   * creates their applications and scrolls to "My application".
   *
   * The shell owns it rather than this section because the scroll target and
   * the `?planFor` return trip from the subject picker both live up there. This
   * section's job stops at "these are the rows the student ticked".
   */
  onPlan: (rows: SavedRow[]) => void;
  /** The confirmation modal's CTA — scroll up rather than navigate. */
  onGoToApplications: () => void;
  /** Disables the CTA while the shell is mid-create. */
  planning?: boolean;
  /**
   * The university `?focus=<id>` arrived pointing at. Ticked and scrolled to on
   * arrival so "Plan my application" acts on the one they came for.
   */
  focusUniversityId?: number | null;
}) {
  const router = useRouter();

  const [rows, setRows] = useState(initialRows);
  const [selected, setSelected] = useState<number[]>([]);
  const [removing, setRemoving] = useState<number[]>([]);
  /** null = closed. The mode decides scope and whether anything is selectable. */
  const [picker, setPicker] = useState<'apply' | 'browse' | null>(null);
  const [applying, setApplying] = useState(false);
  /** Non-null once an award has been attached: drives the 502:18462 confirmation. */
  const [applied, setApplied] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const toggle = useCallback((universityId: number) => {
    setSelected((prev) =>
      prev.includes(universityId)
        ? prev.filter((id) => id !== universityId)
        : [...prev, universityId],
    );
  }, []);

  /*
   * ?focus=<universityId>: tick that row and bring it into view. Ticking is the
   * useful half — the student arrived from /scholarships intending to plan this
   * one, and the CTAs act on the ticked rows.
   *
   * The tick is applied DURING RENDER rather than from an effect. React
   * documents this as the way to adjust state when a prop changes, and the
   * lint rule that bans `setState` inside an effect is pointing at the real
   * cost: from an effect this would render the list unticked, then immediately
   * again ticked. `focusedRow` is the "previous prop" guard that keeps it to
   * one extra render and lets the student untick afterwards.
   */
  const [focusedRow, setFocusedRow] = useState<number | null>(null);
  if (focusUniversityId != null && focusUniversityId !== focusedRow) {
    setFocusedRow(focusUniversityId);
    setSelected((prev) => (prev.includes(focusUniversityId) ? prev : [...prev, focusUniversityId]));
  }

  // The scroll is a real side effect and stays in one, after the row is drawn.
  useEffect(() => {
    if (focusUniversityId == null) return;
    const node = document.querySelector(`[data-university-id="${focusUniversityId}"]`);
    if (!node) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    node.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
  }, [focusUniversityId]);

  const remove = useCallback(
    async (row: SavedRow) => {
      setRemoving((prev) => [...prev, row.universityId]);
      const supabase = await import('@/lib/supabase/client')
        .then(({ createClient }) => createClient())
        .catch(() => null);
      if (!supabase) {
        setRemoving((prev) => prev.filter((id) => id !== row.universityId));
        showToast('Could not remove that university. Please try again.');
        return;
      }
      const { error } = await supabase
        .from('user_universities')
        .delete()
        .eq('id', row.id);

      if (error) {
        setRemoving((prev) => prev.filter((id) => id !== row.universityId));
        showToast('Could not remove that university. Please try again.');
        return;
      }
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      setSelected((prev) => prev.filter((id) => id !== row.universityId));
      setRemoving((prev) => prev.filter((id) => id !== row.universityId));
      showToast(`Removed ${row.name}`);
    },
    [showToast],
  );

  /**
   * Every offerable scholarship, flattened for the picker. The crest is joined on
   * here rather than inside `scholarshipCandidates`, which stays a pure selection
   * rule with no display fields in it.
   *
   * TWO SCOPES, BECAUSE THE TWO DOORS MEAN DIFFERENT THINGS. "Apply scholarship"
   * acts on the ticked rows, since attaching an award means attaching it to a
   * particular saved university. "Scholarships here" is a browse, so it covers
   * every saved row — asking a student to tick something first only to show them
   * a read-only list would be a step for nothing.
   */
  const withCrest = useCallback(
    (universityIds: number[]) => {
      const logos = new Map(rows.map((row) => [row.universityId, row.logoUrl]));
      return scholarshipCandidates(rows, universityIds).map((candidate) => ({
        ...candidate,
        universityLogoUrl: logos.get(candidate.universityId) ?? null,
      }));
    },
    [rows],
  );

  const applyCandidates = useMemo(() => withCrest(selected), [withCrest, selected]);
  const browseCandidates = useMemo(
    () => withCrest(rows.map((row) => row.universityId)),
    [withCrest, rows],
  );

  const applyScholarship = useCallback(
    async ({ scholarshipId, universityId }: { scholarshipId: number; universityId: number }) => {
      setApplying(true);
      const supabase = await import('@/lib/supabase/client')
        .then(({ createClient }) => createClient())
        .catch(() => null);
      if (!supabase) {
        setApplying(false);
        showToast('Could not attach that scholarship. Please try again.');
        return;
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setApplying(false);
        showToast('Your session expired. Please sign in again.');
        return;
      }

      const { error } = await supabase.from('user_scholarships').upsert(
        { user_id: user.id, scholarship_id: scholarshipId, university_id: universityId },
        { onConflict: 'user_id,scholarship_id' },
      );
      setApplying(false);

      if (error) {
        showToast('Could not attach that scholarship. Please try again.');
        return;
      }
      // Name it from what is already on screen. Reading it back would mean
      // waiting on the refresh below before the confirmation could say anything.
      const name =
        rows
          .flatMap((row) => row.options)
          .find((option) => option.id === scholarshipId)?.name ?? null;
      setPicker(null);
      setApplied(name);
      // The row's badge list and net tuition are server-derived, so re-read
      // rather than guess at what the server would have produced.
      router.refresh();
    },
    [showToast, router, rows],
  );

  const attachedCount = rows.reduce((sum, row) => sum + row.attached.length, 0);
  /**
   * The ticked rows themselves, not just their ids — "Plan my application"
   * needs each row's `programUrl` to know whether it can create the application
   * outright or has to send the student to pick a subject first.
   */
  const selectedRows = useMemo(
    () => rows.filter((row) => selected.includes(row.universityId)),
    [rows, selected],
  );
  /**
   * The bar's headline on 375:12841 reads "Học bổng 50%".
   *
   * Null whenever no attached award states a percentage — many are cash sums, and
   * a sum is not a proportion of a bill whose size is free prose. The bar then
   * falls back to the count, which is still true.
   */
  const coveragePercent = bestCoveragePercent(rows);

  return (
    <section className="flex flex-col gap-gb-6xl">
      {/*
        Figma 562:15092. h2, not h1 — on 562:15078 this heading and
        "My application" are drawn identically, but they are two sections of one
        page and only one of them can be its title. The frame's own wording is
        "Saved University"; shipped in the plural, since it labels a list.
      */}
      <ApplySectionHeading as="h2" title="Saved universities" mark="heart">
        {rows.length > 0
          ? 'The universities you have saved, with their deadlines and any scholarships you have attached.'
          : 'Nothing saved yet — the universities you save while browsing show up here.'}
      </ApplySectionHeading>

      {rows.length === 0 ? (
        <div className="flex flex-col items-start gap-gb-xl rounded-gb-2xl border border-gb-brand-100 bg-brand-subtle p-gb-5xl">
          <span className="flex size-gb-6xl items-center justify-center rounded-gb-full bg-surface text-brand">
            <KitIcon art={ICONS.heart} frame={28} />
          </span>
          <p className="text-gb-md text-fg-tertiary">
            Save a university from the search page and it will appear here with its deadline and the
            scholarships attached to it.
          </p>
          <Button href="/universities" size="lg">
            Search universities
          </Button>
        </div>
      ) : (
        <ul {...testId(TID.uniResultsGrid)} className="flex flex-col gap-gb-5xl">
          {rows.map((row) => (
            <SavedRowItem
              key={row.id}
              row={row}
              selected={selected.includes(row.universityId)}
              onToggle={toggle}
              onRemove={remove}
              removing={removing.includes(row.universityId)}
            />
          ))}
        </ul>
      )}

      {/*
        Scholarship bar — Figma 562:15184 (375:12813 before the merge), and
        375:12841 for the state after an award is attached. Three things change
        between the two frames: the headline becomes the discount, and the
        primary button stops being "Apply Học bổng" and becomes "Lên kế hoạch
        ứng tuyển" — once a scholarship is on the plan, the next step is the
        application, not another award.

        "Scholarships here" and the primary button are two doors to the same
        dialog with different scope: the link browses everything linked to the
        saved list, the button attaches one award to the ticked rows. See the
        `candidates` memo.

        THE ROSE PANEL IS NOT IN THE FRAME, which draws a hairline rule and
        white. Everything inside it already is rose — the gift icon, the
        "Học bổng 50%" headline, the link and the CTA — so the strip was four
        rose elements floating on the same white as the rows above it, reading
        as more list rather than as the page's one summary. Rose/50 with a
        Rose/100 edge is the pairing the empty states and the heading marks use.
      */}
      {rows.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-gb-xl rounded-gb-2xl border border-gb-brand-100 bg-brand-subtle px-gb-4xl py-gb-3xl">
          <div className="flex flex-wrap items-center gap-gb-5xl">
            <span className="flex items-center gap-gb-xl">
              <KitIcon art={ICONS.gift01} frame={32} className="shrink-0 text-brand" />
              {/*
                The label and the number are separate text nodes throughout.
                /apply is a PII route, so DomTranslator's machine fallback is
                switched off here (dom-translate.tsx) and every string must be a
                static dictionary hit — an interpolated "Scholarship 50%" would
                never be one, and would sit in English on a Vietnamese page
                forever.
              */}
              <span
                className={`text-gb-md font-semibold ${
                  coveragePercent != null ? 'text-brand' : 'text-fg'
                }`}
              >
                {coveragePercent != null ? (
                  <>
                    <span>Scholarship</span> {coveragePercent}%
                  </>
                ) : attachedCount > 0 ? (
                  <>
                    {attachedCount}{' '}
                    <span>
                      {attachedCount === 1 ? 'scholarship attached' : 'scholarships attached'}
                    </span>
                  </>
                ) : (
                  'See all the scholarships you could apply for'
                )}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setPicker('browse')}
              className="flex items-center gap-gb-xs rounded-gb-md text-gb-sm font-semibold text-brand hover:text-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              Scholarships here
              <KitIcon art={ICONS.arrowUpRight} frame={20} />
            </button>
          </div>
          {/*
            ⚠️ "PLAN MY APPLICATION" IS ALWAYS THE PRIMARY ACTION NOW (01/08).

            These two buttons used to swap, on the rule "once the ticked rows
            have no scholarship left to attach and at least one is attached, the
            next step is the application". Read against the live data that rule
            hides the only way to create an application behind a scholarship:
            a university with NO scholarships in the directory has
            `applyCandidates.length === 0` and `attachedCount === 0`, which fell
            to the else branch and offered "Apply scholarship" — a button whose
            dialog opens to say there are none. A dead end, on the page's one
            job.

            The owner's flow is "tick a university, attach a scholarship IF
            there is one, then plan". So planning is the primary action whenever
            anything is ticked, and attaching an award is the secondary one,
            shown only when the ticked rows actually have an award to attach.
            Both frames' states are still reachable; neither blocks the other.
          */}
          <div className="flex flex-wrap items-center gap-gb-lg">
            {applyCandidates.length > 0 ? (
              <Button
                variant="secondary"
                size="lg"
                disabled={selected.length === 0}
                onClick={() => setPicker('apply')}
              >
                Apply scholarship
              </Button>
            ) : null}
            <Button
              size="lg"
              disabled={planning || selectedRows.length === 0}
              onClick={() => onPlan(selectedRows)}
            >
              Plan my application
            </Button>
          </div>
        </div>
      ) : null}

      {/* The buttons above are disabled rather than hidden when nothing is
          ticked, so say what to do about it. */}
      {rows.length > 0 && selected.length === 0 ? (
        <p className="-mt-gb-4xl text-gb-sm text-fg-muted">
          Tick a university to plan its application.
        </p>
      ) : null}

      <ScholarshipPicker
        open={picker !== null}
        mode={picker ?? 'apply'}
        onClose={() => setPicker(null)}
        candidates={picker === 'browse' ? browseCandidates : applyCandidates}
        onApply={applyScholarship}
        busy={applying}
      />

      <ScholarshipApplied
        open={applied !== null}
        onClose={() => setApplied(null)}
        onGoToApplications={() => {
          setApplied(null);
          onGoToApplications();
        }}
        scholarshipName={applied}
      />

      {toast ? (
        <div
          {...testId(TID.toast)}
          role="status"
          className="fixed bottom-gb-4xl left-1/2 z-50 -translate-x-1/2 rounded-gb-md bg-surface-inverse-strong px-gb-xl py-gb-lg text-gb-sm font-medium text-white shadow-gb-lg"
        >
          {toast}
        </div>
      ) : null}
    </section>
  );
}
