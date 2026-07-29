import Link from 'next/link';
import { GlowbalLogo } from '@/components/glowbal-logo';
import {
  FOOTER_COLUMNS,
  FOOTER_COPYRIGHT,
  FOOTER_RATINGS,
  FOOTER_SOCIAL,
  FOOTER_TAGLINE,
  MARKETING_NAV_ITEMS,
} from '@/features/marketing/ui';
import {
  Badge,
  Button,
  CheckItem,
  CheckList,
  Container,
  Footer,
  ICONS,
  KitIcon,
  MobileNav,
  SearchMark,
  TopNav,
} from '@/shared/ui';
import type { University } from '@/lib/types';
import { FadeInImage } from '../fade-in-image';

/**
 * /universities/[id] — Figma 375:10629 "Detail trường" (1440x4505).
 *
 * ONE page for all 97 universities, filled from the `universities` row. The
 * frame → column mapping is written up in docs/redesign-status.md; every
 * section below cites the node it came from.
 *
 * Three departures from the frame, each for the reason the earlier rebuilds
 * established:
 *
 *  - **375:10694 is lorem ipsum** ("Ipsum sit mattis nulla quam nulla…"). There
 *    is no column behind that paragraph, so it is not rendered rather than
 *    filled with something invented.
 *  - **The anchor bar names seven sections and the body has five.** "Các ngành"
 *    and "Xếp hạng" have no target — the ranks are badges in the header, not a
 *    section. Anchors are therefore derived from the sections that actually
 *    render, so a link never scrolls nowhere. VinUni gets the programmes anchor
 *    back, because it has programmes.
 *  - **The last button reads "AI lên chiến lược"** under a heading about talking
 *    to someone who studied here. The label belongs to another flow; the
 *    section is about mentors, so it goes to /mentors.
 *
 * Everything here is a Server Component: the page is read-only, and the only
 * interactive parts (nav, saved state) already own their own client boundaries.
 */

export type DetailSection = {
  /** Anchor id, and the target of the bar at the top. */
  id: string;
  label: string;
};

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

function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="scroll-mt-gb-9xl font-display text-gb-display-sm font-semibold text-fg"
    >
      {children}
    </h2>
  );
}

export function UniversityDetail({
  university,
  scholarships,
  sections,
  extras,
  officialSite,
  isSignedIn,
  userName,
  userAvatarUrl,
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
  userName?: string | null;
  userAvatarUrl?: string | null;
}) {
  const navUser =
    isSignedIn && userName
      ? { user: { name: userName, avatarUrl: userAvatarUrl ?? null, href: '/profile' } }
      : { secondaryAction: { href: '/auth', label: 'Sign in' } };

  return (
    <div className="gb-page-full-bleed gb-has-mobile-header bg-surface">
      <TopNav
        tone="light"
        logo={<GlowbalLogo height={28} />}
        items={MARKETING_NAV_ITEMS}
        primaryAction={{ href: '/universities', label: 'Search universities' }}
        {...navUser}
      />
      <MobileNav
        logo={
          <Link href="/" aria-label="GlowBal home" className="inline-flex items-center">
            <GlowbalLogo height={28} />
          </Link>
        }
        items={MARKETING_NAV_ITEMS}
        primaryAction={{ href: '/universities', label: 'Search universities' }}
        secondaryAction={
          isSignedIn ? { href: '/profile', label: 'Profile' } : { href: '/auth', label: 'Sign in' }
        }
        openLabel="Menu"
        closeLabel="Close menu"
      />

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
            <h1 className="font-display text-gb-display-sm font-semibold tracking-gb-display-tight text-fg md:text-gb-display-lg">
              {university.name}
            </h1>

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
            <FadeInImage
              src={university.image_url}
              alt=""
              className="aspect-[1216/640] w-full rounded-gb-xl object-cover"
            />
          ) : null}
        </Container>

        {/* ── Anchor bar, Figma 375:10665 ─────────────────────────────────── */}
        <Container as="nav" className="pt-gb-5xl" aria-label="On this page">
          <div className="flex flex-wrap items-center justify-between gap-gb-lg rounded-gb-md bg-surface-muted px-[18px] py-gb-lg">
            <div className="flex flex-wrap items-center gap-gb-5xl">
              {sections.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="text-gb-sm text-fg transition-colors hover:text-fg-brand"
                >
                  {section.label}
                </a>
              ))}
            </div>
            <div className="flex items-center gap-gb-lg">
              {/*
               * There is no website column. `officialWebsite` is the project's
               * answer to "where does this university live" and it is honest
               * about partial coverage — when it misses, the button is not
               * rendered rather than linking nowhere.
               */}
              {officialSite ? (
                <Button href={officialSite} variant="secondary" size="sm">
                  Official website
                </Button>
              ) : null}
              <Button href="/universities" size="sm">
                Search universities
              </Button>
            </div>
          </div>
        </Container>

        {/* ── Body: 720 rich text + 384 sidebar, Figma 375:10690 ──────────── */}
        <Container className="flex flex-col gap-gb-7xl py-gb-7xl lg:flex-row lg:items-start">
          <div className="flex min-w-0 flex-1 flex-col gap-gb-6xl">
            {/* Intro — 375:10692, 375:10693 */}
            <section className="flex flex-col gap-gb-2xl">
              <SectionHeading id="about">About {university.name}</SectionHeading>
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

            {/* Admissions — 375:10696 */}
            <section className="flex flex-col gap-gb-2xl">
              <SectionHeading id="admissions">Admission requirements</SectionHeading>
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
                <SectionHeading id="location">Campus and location</SectionHeading>
                <p className="text-gb-lg text-fg-tertiary">{university.housing}</p>
              </section>
            ) : null}

            {/* Scholarships — 375:10709 */}
            <section className="flex flex-col gap-gb-2xl">
              <SectionHeading id="costs">Costs and scholarships</SectionHeading>
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
                        className="flex flex-col gap-gb-lg rounded-gb-xl border border-line p-gb-3xl"
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
                           *
                           * No pin icon: marker-pin-02 (Figma 41:4011) has
                           * never been exported into ICONS, and hand-drawing
                           * one is the thing icons.tsx exists to prevent. The
                           * label carries the meaning instead.
                           */}
                          {university.country ? (
                            <span className="shrink-0">{university.country}</span>
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
              <SectionHeading id="careers">Careers and outcomes</SectionHeading>
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
                {university.best_for ? (
                  <LabelledCheck label="Best for" value={university.best_for} />
                ) : null}
              </ul>
            </section>

            {/* Why students choose — 375:10813 */}
            <section className="flex flex-col gap-gb-2xl">
              <SectionHeading id="why">Why students choose {university.name}</SectionHeading>
              <CheckList>
                {university.strengths ? <CheckItem>{university.strengths}</CheckItem> : null}
                {university.employability ? (
                  <CheckItem>Employability: {university.employability}</CheckItem>
                ) : null}
                {university.scholarship ? <CheckItem>{university.scholarship}</CheckItem> : null}
              </CheckList>
              {/*
               * The frame has no counterweight to this list. `weaknesses` is
               * populated on all 97 rows and is the honest other half of a
               * shortlisting decision, so it is shown rather than dropped.
               */}
              {university.weaknesses ? (
                <div className="rounded-gb-xl border border-line bg-surface-muted p-gb-3xl">
                  <p className="text-gb-md font-semibold text-fg">Worth knowing</p>
                  <p className="mt-gb-md text-gb-md text-fg-tertiary">{university.weaknesses}</p>
                </div>
              ) : null}
            </section>

            {extras}

            {/* Talk to someone — 375:10826 */}
            <section className="flex flex-col gap-gb-2xl">
              <SectionHeading id="mentors">Talk to someone who studied here</SectionHeading>
              <p className="text-gb-lg text-fg-tertiary">
                Book a 1-1 session with a current student or alumnus for honest advice about your
                application and life on campus.
              </p>
              <div className="flex">
                {/* The frame labels this "AI lên chiến lược" — see the note at
                    the top of this file. */}
                <Button href="/mentors">Find a mentor</Button>
              </div>
            </section>
          </div>

          {/* Sidebar — Figma 375:10831 */}
          <aside className="w-full shrink-0 lg:sticky lg:top-gb-5xl lg:w-[384px]">
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
               * The frame's label is "Lên Chiến lược Ứng tuyển ngay" and points
               * at the strategy flow. /ai-strategy does not exist yet — the nav
               * and footer already carry that deliberate, tracked 404 (see
               * nav-items.tsx), so this is consistent rather than a new dead
               * end. It starts working when Phase 2 lands.
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
