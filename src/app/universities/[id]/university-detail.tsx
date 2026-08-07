import Link from 'next/link';
import { GlowbalLogo } from '@/components/glowbal-logo';
import { SiteNavigation } from '@/components/site-navigation';
import {
  FOOTER_COLUMNS,
  FOOTER_COPYRIGHT,
  FOOTER_RATINGS,
  FOOTER_SOCIAL,
  FOOTER_TAGLINE,
} from '@/features/marketing/ui';
import {
  formatAcceptanceForCard,
  formatDeadlineLabel,
  formatTuitionForCard,
  leadFragment,
  splitList,
} from '@/features/universities/domain';
import {
  Badge,
  Button,
  CheckItem,
  CheckList,
  Container,
  Footer,
  ICONS,
  KitIcon,
  SearchMark,
} from '@/shared/ui';
import { TID, testId } from '@/shared/lib/testids';
import type { University } from '@/lib/types';
import { FadeInImage } from '../fade-in-image';
import { DetailNav, type DetailSection } from './detail-nav';
import { UniversitySaveHeader } from './save-university-button';

/**
 * /universities/[id] — Figma 375:10629 "Detail trường" (1440x4505).
 *
 * ONE page for all 97 universities, filled from the `universities` row. The
 * frame → column mapping is written up in docs/redesign-status.md; every section
 * below cites the node it came from.
 *
 * ── Departures from the frame ────────────────────────────────────────────────
 *
 * The first three are the ones the 28/07 build established and are unchanged:
 *
 *  - **375:10694 is lorem ipsum** ("Ipsum sit mattis nulla quam nulla…"). There
 *    is no column behind that paragraph, so it is not rendered rather than
 *    filled with something invented.
 *  - **The anchor bar names seven sections and the body does not have seven.**
 *    "Xếp hạng" has no target — the ranks are badges in the header, not a
 *    section. Anchors are derived from the sections that actually render, so a
 *    link never scrolls nowhere. (The frame's "Các ngành" now DOES have a
 *    target; see `subjects` below.)
 *  - **The last button reads "AI lên chiến lược"** under a heading about talking
 *    to someone who studied here. The label belongs to another flow; the section
 *    is about mentors, so it goes to /mentors.
 *
 * The rest are additions made 2026-07-30, when the owner asked for the page to
 * be more interesting to read than the frame draws it. Each is data the table
 * already holds and the frame either buries or omits — none of it is invented:
 *
 *  - **The save heart is BUILT NOW** (Figma 522:8643). It is not a departure at
 *    all: it is in the frame and was missing from the code, because it was drawn
 *    after this page was built. See save-university-button.tsx.
 *  - **The section bar sticks and tracks the reader.** The frame's static row
 *    scrolls away after the first screen of a ~4,700px page. See detail-nav.tsx.
 *  - **A stat strip sits under the hero.** Rank, acceptance rate, GPA and
 *    tuition are the four figures a shortlisting decision turns on, and the
 *    frame has them as bullet points in three different sections a full screen
 *    apart. The strip is a summary, not a replacement — every value still
 *    renders in full, in prose, in its own section below.
 *  - **`strengths` and `best_for` render as chips.** Both are comma-separated
 *    lists on all 97 rows; the frame prints them as one long line each. This is
 *    the same call the mentor profile made for its own chip rows.
 *  - **`notes` is shown.** It is populated on all 97 rows, carries the most
 *    candid material in the table ("INSIGHT: 'psets' culture is intense…"), and
 *    was rendered nowhere on the site. Printed verbatim — the "VERIFIED:" /
 *    "INSIGHT:" prefixes some rows use are not parsed, because they are not
 *    consistent enough to key a UI off.
 *  - **`weaknesses` is shown**, though the frame has no counterweight to "why
 *    students choose". It is populated on all 97 rows and is the honest other
 *    half of a shortlisting decision.
 *  - **The sidebar carries a facts rail.** The frame's 384px column holds one
 *    250px card against a 4,700px scroll and is empty for the rest of it.
 *
 * Everything here is a Server Component except the save button and the section
 * bar, which own their own client boundaries.
 */

export type { DetailSection };

/** A label/value pair rendered as a check row — Figma 375:10792. */
function LabelledCheck({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex gap-gb-lg">
      <span className="mt-gb-xxs shrink-0 text-brand" aria-hidden="true">
        <KitIcon art={ICONS.checkCircle} frame={24} />
      </span>
      <span className="min-w-0">
        <span className="block text-gb-md font-semibold text-fg">{label}</span>
        <span className="block text-gb-md text-fg-tertiary">{value}</span>
      </span>
    </li>
  );
}

/**
 * A section heading with a short rose rule above it.
 *
 * `scroll-mt` has to clear whatever is pinned above the heading when an anchor
 * jumps to it, and that differs by breakpoint: on mobile the 64px app header
 * (--gb-header-mobile) sits above the ~57px section bar, while from `md` up the
 * top nav scrolls away and only the bar remains. Composed from tokens rather
 * than hard-coded so the mobile figure tracks the header if it ever changes.
 */
export function SectionHeading({
  id,
  eyebrow,
  children,
}: {
  id: string;
  eyebrow?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="scroll-mt-[calc(var(--gb-header-mobile)+var(--spacing-gb-7xl))] md:scroll-mt-gb-9xl" id={id}>
      <span aria-hidden="true" className="mb-gb-lg block h-[3px] w-[32px] rounded-gb-full bg-brand" />
      {eyebrow ? (
        <p className="mb-gb-xs text-gb-xs font-semibold tracking-gb-display-open text-fg-muted uppercase">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="font-display text-gb-display-sm font-semibold text-fg">{children}</h2>
    </div>
  );
}

/** A comma-separated editorial field, rendered as the list it always was. */
function ChipRow({ label, value }: { label: string; value: string }) {
  const items = splitList(value);
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-gb-lg">
      <p className="text-gb-md font-semibold text-fg">{label}</p>
      <ul className="flex flex-wrap gap-gb-md">
        {items.map((item) => (
          <li key={item}>
            <Badge variant="brand-chip">{item}</Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * One figure in the strip under the hero.
 *
 * Not the `Metric` primitive: that renders its value at 48px, holds about nine
 * glyphs, and drops its label onto a second line the moment it overflows. These
 * values are prose ("Estimated ~60–65%", "$15,000–18,000/year before subsidy"),
 * so this clamps instead and keeps the untruncated string on `title`.
 */
function Stat({ label, value, full }: { label: string; value: string; full?: string }) {
  return (
    /*
     * Each tile carries its own border rather than the row carrying dividers.
     * The strip has between two and four tiles and reflows from four columns to
     * two, so a `divide-x` row loses its separators the moment it wraps — and
     * which tiles are present depends on the university.
     */
    <div className="flex h-full flex-col gap-gb-xs rounded-gb-xl border border-line bg-surface-muted px-gb-2xl py-gb-xl">
      <span className="text-gb-xs font-semibold tracking-gb-display-open text-fg-muted uppercase">
        {label}
      </span>
      <span
        className="font-display text-gb-xl font-semibold text-fg"
        {...(full && full !== value ? { title: full } : {})}
      >
        {value}
      </span>
    </div>
  );
}

/** A label/value line in the sidebar rail. */
function RailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-gb-xxs border-b border-line py-gb-lg last:border-b-0 last:pb-0">
      <span className="text-gb-xs font-semibold tracking-gb-display-open text-fg-muted uppercase">
        {label}
      </span>
      <span className="text-gb-sm text-fg">{value}</span>
    </div>
  );
}

export function UniversityDetail({
  university,
  scholarships,
  sections,
  extras,
  officialSite,
  isSignedIn,
  isSaved,
}: {
  university: University;
  scholarships: readonly {
    id: number;
    name: string;
    fundingType: readonly string[];
    eligibility: string | null;
    deadlineLabel: string | null;
    sourceUrl: string | null;
  }[];
  sections: readonly DetailSection[];
  /** Per-university extra content. Only VinUni has any — see university-extras. */
  extras?: React.ReactNode;
  officialSite: string | null;
  isSignedIn: boolean;
  /** Whether this university is already on the signed-in student's list. */
  isSaved: boolean;
  userName?: string | null;
  userAvatarUrl?: string | null;
}) {
  // ── The strip under the hero ──────────────────────────────────────────────
  // Built by filtering, not by padding: a university with no QS rank gets three
  // tiles rather than one reading "—". Below two the strip is not a comparison
  // any more, so it is dropped entirely.
  const acceptance = university.accept_rate ? formatAcceptanceForCard(university.accept_rate) : null;
  const gpa = leadFragment(university.gpa_range, 24);
  const tuition = university.tuition_usd ? formatTuitionForCard(university.tuition_usd) : null;
  const stats: { label: string; value: string; full?: string }[] = [
    ...(university.qs_rank != null
      ? [{ label: 'QS World Rank', value: `#${university.qs_rank}` }]
      : []),
    ...(acceptance && acceptance !== '—'
      ? [{ label: 'Acceptance rate', value: acceptance, full: university.accept_rate ?? '' }]
      : []),
    ...(gpa ? [{ label: 'Typical GPA', value: gpa, full: university.gpa_range ?? '' }] : []),
    ...(tuition && tuition !== '—'
      ? [{ label: 'Tuition / year', value: tuition, full: university.tuition_usd ?? '' }]
      : []),
  ];

  const deadline = formatDeadlineLabel(university.application_deadline);
  const hasSubjects =
    splitList(university.strengths).length > 0 || splitList(university.best_for).length > 0;

  return (
    /*
     * `uniDetailPanel` lives here now. It used to mark the in-page panel on
     * /universities; that panel is deleted and this page is what a card opens,
     * so the testid follows the thing it names — signed-in.spec.ts's "click a
     * card, expect the detail panel" now asserts the redesigned page, and
     * guest-universities.spec.ts's "expect count 0" still holds because a guest
     * is stopped by the login gate before navigating.
     */
    <div
      {...testId(TID.uniDetailPanel)}
      className="gb-page-full-bleed gb-has-mobile-header bg-surface"
    >
      <SiteNavigation tone="light" showSaved />

      <main>
        {/* ── Header, Figma 375:10642 ─────────────────────────────────────── */}
        <Container as="section" className="flex flex-col gap-gb-4xl pt-gb-6xl">
          {/*
           * Figma 375:10648 draws this as a search input, complete with a
           * magnifier. It is not one — the text reads "Quay về trang tìm trường
           * đại học" and there is nothing to search on this page. Rendered as
           * the link it describes, keeping the frame's shape.
           */}
          <Link
            href="/universities"
            className="flex h-[44px] items-center gap-gb-md rounded-gb-md bg-surface px-gb-md text-gb-sm text-fg-tertiary shadow-xs transition-colors hover:text-fg"
          >
            <span className="text-fg-muted" aria-hidden="true">
              <SearchMark frame={16} />
            </span>
            Back to university search
          </Link>

          <div className="flex flex-col gap-gb-3xl">
            <UniversitySaveHeader
              universityId={university.id}
              universityName={university.name}
              isSignedIn={isSignedIn}
              initialSaved={isSaved}
            />

            {/* Figma 375:10655. Ranks are brand-subtle, facts are neutral. */}
            <div className="flex flex-wrap items-start gap-gb-3xl">
              {university.qs_rank != null ? (
                <Badge variant="brand-subtle">#{university.qs_rank} QS World Ranking</Badge>
              ) : null}
              {university.the_rank != null ? (
                <Badge variant="brand-subtle">#{university.the_rank} THE Ranking</Badge>
              ) : null}
              {university.country ? <Badge variant="neutral">{university.country}</Badge> : null}
              {university.type ? <Badge variant="neutral">{university.type}</Badge> : null}
            </div>
          </div>

          {university.image_url ? (
            /*
             * The muted backdrop is not decoration. `image_url` is not reliably
             * a photograph — Harvard's is a coat of arms on transparency and
             * MIT's is a PNG with a cut-out sky — and a transparent image over
             * the page's white surface loses its own edges. A surface behind it
             * gives every row the same frame whatever the asset turns out to be.
             */
            <div
              {...testId(TID.uniDetailHero)}
              className="relative aspect-[1216/640] w-full overflow-hidden rounded-gb-xl bg-surface-muted ring-1 ring-line"
            >
              <FadeInImage
                src={university.image_url}
                alt=""
                sizes="(max-width: 767px) calc(100vw - 32px), (max-width: 1279px) calc(100vw - 64px), 1216px"
                className="object-cover"
              />
            </div>
          ) : null}

          {stats.length >= 2 ? (
            <ul className="grid grid-cols-2 gap-gb-lg lg:grid-cols-4">
              {stats.map((stat) => (
                <li key={stat.label}>
                  <Stat {...stat} />
                </li>
              ))}
            </ul>
          ) : null}
        </Container>

        {/*
         * ── Section bar, Figma 375:10665 ─────────────────────────────────
         *
         * A DIRECT child of <main>, and the top spacing is a margin inside the
         * component rather than padding on a wrapper here. A sticky element only
         * sticks while its own parent box is on screen, so wrapping this in a
         * `<div className="pt-gb-5xl">` pinned it to a 103px-tall parent and it
         * scrolled away with that parent immediately — sticky in the computed
         * style, never sticky on screen.
         */}
        <DetailNav sections={sections} officialSite={officialSite} />

        {/* ── Body: 720 rich text + 384 sidebar, Figma 375:10690 ──────────── */}
        <Container className="flex flex-col gap-gb-7xl py-gb-7xl lg:flex-row lg:items-start">
          <div className="flex min-w-0 flex-1 flex-col gap-gb-6xl">
            {/* Intro — 375:10692, 375:10693 */}
            <section className="flex flex-col gap-gb-2xl">
              <SectionHeading id="about" eyebrow="Overview">
                About {university.name}
              </SectionHeading>
              {university.specific_insight ? (
                <p className="text-gb-lg text-fg-tertiary">{university.specific_insight}</p>
              ) : null}
              <ul className="flex flex-col gap-gb-lg">
                {university.international_environment ? (
                  <LabelledCheck
                    label="International environment"
                    value={university.international_environment}
                  />
                ) : null}
                {university.teaching_style ? (
                  <LabelledCheck label="Teaching style" value={university.teaching_style} />
                ) : null}
              </ul>
            </section>

            {/*
             * Subjects — the frame's "Các ngành" anchor, which the 28/07 build
             * dropped because nothing on the page answered it. `strengths` and
             * `best_for` do answer it; they were just being printed as prose
             * inside two other sections.
             */}
            {hasSubjects ? (
              <section className="flex flex-col gap-gb-2xl">
                <SectionHeading id="subjects" eyebrow="Academics">
                  Subjects and fit
                </SectionHeading>
                {university.strengths ? (
                  <ChipRow label="Strongest subjects" value={university.strengths} />
                ) : null}
                {university.best_for ? (
                  <ChipRow label="Best for" value={university.best_for} />
                ) : null}
              </section>
            ) : null}

            {/* Admissions — 375:10696 */}
            <section className="flex flex-col gap-gb-2xl">
              <SectionHeading id="admissions" eyebrow="Getting in">
                Admission requirements
              </SectionHeading>
              <CheckList>
                {university.gpa_range ? <CheckItem>GPA: {university.gpa_range}</CheckItem> : null}
                {university.english_requirement ? (
                  <CheckItem>{university.english_requirement}</CheckItem>
                ) : null}
                {university.standardized_test ? (
                  <CheckItem>{university.standardized_test}</CheckItem>
                ) : null}
                {university.admission_difficulty ? (
                  <CheckItem>Difficulty: {university.admission_difficulty}</CheckItem>
                ) : null}
                {university.accept_rate ? (
                  <CheckItem>Acceptance rate: {university.accept_rate}</CheckItem>
                ) : null}
                {university.application_deadline ? (
                  <CheckItem>Deadline: {university.application_deadline}</CheckItem>
                ) : null}
              </CheckList>
            </section>

            {/* Campus & location — 375:10702 */}
            {university.housing ? (
              <section className="flex flex-col gap-gb-2xl">
                <SectionHeading id="location" eyebrow="On campus">
                  Campus and location
                </SectionHeading>
                <p className="text-gb-lg text-fg-tertiary">{university.housing}</p>
              </section>
            ) : null}

            {/* Scholarships — 375:10709 */}
            <section className="flex flex-col gap-gb-2xl">
              <SectionHeading id="costs" eyebrow="Money">
                Costs and scholarships
              </SectionHeading>
              <ul className="flex flex-col gap-gb-lg">
                {university.tuition_usd ? (
                  <LabelledCheck label="Tuition (USD)" value={university.tuition_usd} />
                ) : null}
                {university.living_cost_usd ? (
                  <LabelledCheck label="Living cost (USD)" value={university.living_cost_usd} />
                ) : null}
                {university.scholarship ? (
                  <LabelledCheck label="Scholarships" value={university.scholarship} />
                ) : null}
              </ul>

              {scholarships.length > 0 ? (
                <>
                  <ul className="flex flex-col gap-gb-xl">
                    {scholarships.map((scholarship) => (
                      <li
                        key={scholarship.id}
                        className="flex flex-col gap-gb-lg rounded-gb-xl border border-line p-gb-3xl transition-shadow hover:shadow-gb-lg"
                      >
                        <p className="text-gb-lg font-semibold text-fg">{scholarship.name}</p>
                        {scholarship.fundingType.length > 0 ? (
                          <div className="flex flex-wrap gap-gb-md">
                            {scholarship.fundingType.map((type) => (
                              <Badge key={type} variant="brand-subtle">
                                {type}
                              </Badge>
                            ))}
                          </div>
                        ) : null}
                        {scholarship.eligibility ? (
                          <p className="text-gb-sm text-fg-tertiary">{scholarship.eligibility}</p>
                        ) : null}
                        <div className="flex flex-wrap items-start gap-gb-3xl text-gb-sm text-fg-tertiary">
                          {/*
                           * The kit's job-post card puts "Remote" on a map pin
                           * here — the same leak the saved list and the
                           * applications list hit. There is no city column, so
                           * the country is what a pin would point at.
                           */}
                          {university.country ? (
                            <span className="flex shrink-0 items-start gap-gb-xs">
                              <span className="mt-gb-xxs shrink-0" aria-hidden="true">
                                <KitIcon art={ICONS.markerPin02} frame={16} />
                              </span>
                              {university.country}
                            </span>
                          ) : null}
                          {scholarship.deadlineLabel ? (
                            <span className="flex min-w-0 flex-1 items-start gap-gb-xs">
                              <span className="mt-gb-xxs shrink-0" aria-hidden="true">
                                <KitIcon art={ICONS.clock} frame={16} />
                              </span>
                              {/*
                               * Clamped, not truncated to a date. The frame
                               * assumes "Hạn chót: 5 tháng 1 năm 2026"; real
                               * rows carry prose — CMU's is a 40-word paragraph
                               * about there being no fixed deadline. Keeping
                               * the prose and clamping it is the call the saved
                               * list already made; parsing a date out of it
                               * would invent one.
                               */}
                              <span className="line-clamp-2">{scholarship.deadlineLabel}</span>
                            </span>
                          ) : null}
                        </div>
                        {scholarship.sourceUrl ? (
                          <div className="flex">
                            <Button href={scholarship.sourceUrl} variant="secondary" size="sm">
                              Official link
                            </Button>
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                  <div className="flex">
                    <Button href="/scholarships">See all scholarships</Button>
                  </div>
                </>
              ) : null}
            </section>

            {/* Careers — 375:10784 */}
            <section className="flex flex-col gap-gb-2xl">
              <SectionHeading id="careers" eyebrow="After graduation">
                Careers and outcomes
              </SectionHeading>
              <ul className="flex flex-col gap-gb-lg">
                {university.industry_connections ? (
                  <LabelledCheck
                    label="Industry connections"
                    value={university.industry_connections}
                  />
                ) : null}
                {university.internship_coop ? (
                  <LabelledCheck label="Internships" value={university.internship_coop} />
                ) : null}
                {university.employability ? (
                  <LabelledCheck label="Employability" value={university.employability} />
                ) : null}
              </ul>
            </section>

            {/* Why students choose — 375:10813 */}
            <section className="flex flex-col gap-gb-2xl">
              <SectionHeading id="why" eyebrow="The honest view">
                Why students choose {university.name}
              </SectionHeading>
              {/*
               * The frame derives this list from `strengths`,
               * `industry_connections`, `scholarship` and `employability` — but
               * all four now render in full in their own sections above
               * (Subjects, Careers, Costs), so repeating them here would say the
               * same thing a third time. Only `scholarship` is kept, because it
               * is the one that reads as a reason rather than a fact, and the
               * two cards below carry the section instead. They are the only
               * material on the page that is not a selling point.
               */}
              <CheckList>
                {university.scholarship ? <CheckItem>{university.scholarship}</CheckItem> : null}
                {university.employability ? (
                  <CheckItem>Employability: {university.employability}</CheckItem>
                ) : null}
              </CheckList>

              <div className="grid gap-gb-xl md:grid-cols-2">
                {university.weaknesses ? (
                  <div className="rounded-gb-xl border border-line bg-surface-muted p-gb-3xl">
                    <p className="text-gb-md font-semibold text-fg">Worth knowing</p>
                    <p className="mt-gb-md text-gb-md text-fg-tertiary">{university.weaknesses}</p>
                  </div>
                ) : null}
                {/*
                 * `notes` verbatim. Several rows lead with "VERIFIED:" or
                 * "INSIGHT:", but not consistently enough to key a UI off, so
                 * the prefixes are left in the text rather than turned into
                 * badges that would be missing on the rows that omit them.
                 */}
                {university.notes ? (
                  <div className="rounded-gb-xl border border-brand-surface bg-brand-subtle p-gb-3xl">
                    <p className="text-gb-md font-semibold text-fg-brand">
                      GlowBal&rsquo;s insider note
                    </p>
                    <p className="mt-gb-md text-gb-md text-fg-tertiary">{university.notes}</p>
                  </div>
                ) : null}
              </div>
            </section>

            {extras}

            {/* Talk to someone — 375:10826 */}
            <section className="flex flex-col gap-gb-2xl">
              <SectionHeading id="mentors" eyebrow="Ask a human">
                Talk to someone who studied here
              </SectionHeading>
              <p className="text-gb-lg text-fg-tertiary">
                Book a 1-1 session with a current student or alumnus for honest advice about your
                application and life on campus.
              </p>
              <div className="flex">
                {/* The frame labels this "AI lên chiến lược" — see the note at
                    the top of this file. */}
                <Button href="/advisors">Find an advisor</Button>
              </div>
            </section>
          </div>

          {/* Sidebar — Figma 375:10831 */}
          <aside className="flex w-full shrink-0 flex-col gap-gb-2xl lg:sticky lg:top-gb-9xl lg:w-[384px]">
            {/*
             * The facts rail. Everything on it is repeated in full further down
             * the page — it exists so the four things a reader keeps scrolling
             * back for stay on screen while they read the rest.
             */}
            <div className="flex flex-col rounded-gb-xl border border-line p-gb-3xl">
              <p className="pb-gb-lg text-gb-md font-semibold text-fg">At a glance</p>
              {deadline ? <RailRow label="Application deadline" value={deadline} /> : null}
              {university.admission_difficulty ? (
                <RailRow label="Admission difficulty" value={university.admission_difficulty} />
              ) : null}
              {university.living_cost_usd ? (
                <RailRow label="Living cost (USD / year)" value={university.living_cost_usd} />
              ) : null}
              {university.english_requirement ? (
                <RailRow label="English requirement" value={university.english_requirement} />
              ) : null}
            </div>

            <div className="flex flex-col gap-gb-3xl rounded-gb-xl border border-line bg-surface-muted p-gb-4xl shadow-xs">
              <span className="flex size-[56px] items-center justify-center rounded-gb-lg border border-line-strong bg-surface text-brand shadow-xs">
                <KitIcon art={ICONS.zapFast} frame={28} />
              </span>
              <div className="flex flex-col gap-gb-xs">
                <p className="text-gb-xl font-semibold text-fg">
                  Ready to study at {university.name}?
                </p>
                <p className="text-gb-md text-fg-tertiary">
                  Find courses and start building your application with GlowBal&rsquo;s AI course
                  picker.
                </p>
              </div>
              {/*
               * The frame's label is "Lên Chiến lược Ứng tuyển ngay". This page
               * is university-level — no course is selected yet, so there is no
               * applicationId to deep-link a specific Strategy into (see
               * .kiro/specs/ai-strategy-dashboard/requirements.md Requirement
               * 1.1, "one Strategy per course"). /ai-strategy is the right
               * target: a signed-in student sees their existing strategies
               * there, or a prompt to pick a course if they have none.
               */}
              <Button href="/ai-strategy" className="w-full">
                Build your application strategy
              </Button>
            </div>
          </aside>
        </Container>
      </main>

      <Footer
        logo={<GlowbalLogo height={28} />}
        tagline={FOOTER_TAGLINE}
        columns={FOOTER_COLUMNS}
        social={FOOTER_SOCIAL}
        copyright={FOOTER_COPYRIGHT}
        ratings={FOOTER_RATINGS}
      />
    </div>
  );
}
