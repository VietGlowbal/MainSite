'use client';

import Link from 'next/link';
import { intakeDisplayLabel } from '@/features/apply/domain';
import { useLanguage } from '@/lib/i18n';
import type { UploadedDocument, StudentProfile } from '@/lib/types';
import { SignOutButton } from '@/components/sign-out-button';
import {
  Avatar,
  Badge,
  Button,
  ICONS,
  KitIcon,
  Panel,
  PanelHeader,
  ProgressBar,
  ScoreRing,
} from '@/shared/ui';
import type { ProgressTone } from '@/shared/ui';

/**
 * /profile — rebuilt against the design tokens.
 *
 * ⚠️ NO FIGMA FRAME EXISTS FOR THIS PAGE. The owner asked for it to be brought
 * onto the new system without one, so every decision below is a judgment call
 * rather than a measurement. What it is built from: the token scale, the
 * primitives in shared/ui, and the dark-band vocabulary the footer and top nav
 * already use (`bg-surface-inverse-deep` + the `fg-on-inverse-*` ramp), so the
 * signed-in console reads as the same product as the marketing pages.
 *
 * WHAT THE OLD PAGE DID THAT THIS DELIBERATELY DOES NOT:
 *
 *  1. A "Verified" badge, green tick, shown to every single student. Nothing in
 *     the schema verifies anything about a student, so it was decoration
 *     wearing the clothes of a fact. Removed rather than restyled.
 *
 *  2. An applications card reading "Active N · Submitted 0 · Offers 0", where
 *     the last two were literals. Two thirds of that card was a claim about the
 *     student's applications that no query backed. It now shows the one figure
 *     that is real and links out for the rest.
 *
 *  3. Its own gradient ring, its own pink, its own eight icon colours — none of
 *     them from the token file. Progress is now ScoreRing and ProgressBar, and
 *     the only accent colour is the brand.
 *
 * NO ICONS ON THE SECTION CARDS, and that is on purpose. The eight icons the
 * old page drew were hand-rolled feather paths in eight hard-coded hues.
 * `ICONS` only carries what has been exported from Figma, none of which means
 * "passport" or "mortarboard", and inventing icon art here would be exactly the
 * thing icons.tsx exists to prevent. The cards lean on type and progress
 * instead.
 */

type ProfileDocument = Pick<UploadedDocument, 'id' | 'type' | 'file_name' | 'created_at'>;

type Props = {
  displayName: string;
  email: string;
  avatarUrl?: string;
  memberSince: string;
  profile: StudentProfile | null;
  documents: ProfileDocument[];
  activeApplications: number;
  workEntries: number;
  testScores: number;
  isMentor: boolean;
  plusStatus: boolean;
  plusPlan: string | null;
  returnTo?: string | undefined;
  applicationLabel?: string | undefined;
};

/* ─────────────────────────────────────────────────────────────────────────
   COMPLETENESS

   Two shapes of answer, so two helpers. `ratio` is for a section that is a
   fixed set of fields — the fraction that are filled. `band` is for a section
   that is a list the student grows; there is no "all of them", so one entry is
   a real start and two is as complete as the page can honestly call it.
───────────────────────────────────────────────────────────────────────── */

function ratio(flags: boolean[]): number {
  return Math.round((flags.filter(Boolean).length / flags.length) * 100);
}

function band(count: number): number {
  if (count <= 0) return 0;
  if (count === 1) return 50;
  return 100;
}

function filled(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

type SectionInputs = {
  profile: StudentProfile | null;
  documents: ProfileDocument[];
  workEntries: number;
  testScores: number;
};

type SectionDef = {
  key: string;
  href: string;
  title: string;
  description: string;
  pct: (input: SectionInputs) => number;
};

type SectionGroup = {
  key: string;
  title: string;
  description: string;
  /**
   * Which step of the categorical accent scale this group wears. Assigned in
   * reading order, so group one is the brand rose — see the token note.
   */
  accent: ProgressTone;
  sections: SectionDef[];
};

/**
 * Everything an accent step paints, resolved up front.
 *
 * A lookup rather than a template string because Tailwind scans source text
 * for finished class names — `bg-accent-${n}` compiles to nothing at all, and
 * the failure is silent: no error, just an uncoloured page.
 */
const ACCENT: Record<ProgressTone, { wash: string; solid: string; text: string; hover: string }> = {
  brand: {
    wash: 'bg-brand-subtle',
    solid: 'bg-brand',
    text: 'text-fg-brand',
    hover: 'hover:border-brand',
  },
  'accent-1': {
    wash: 'bg-accent-1-subtle',
    solid: 'bg-accent-1',
    text: 'text-accent-1',
    hover: 'hover:border-accent-1',
  },
  'accent-2': {
    wash: 'bg-accent-2-subtle',
    solid: 'bg-accent-2',
    text: 'text-accent-2',
    hover: 'hover:border-accent-2',
  },
  'accent-3': {
    wash: 'bg-accent-3-subtle',
    solid: 'bg-accent-3',
    text: 'text-accent-3',
    hover: 'hover:border-accent-3',
  },
};

/**
 * The eight editors under /profile, grouped the way the student already met
 * them rather than in an order invented here.
 *
 * ─── WHY THREE GROUPS ───────────────────────────────────────────────────────
 *
 * This grid is the edit surface for the onboarding quiz: a student comes back
 * to change an answer they gave at sign-up. So the grouping follows the flow
 * in `onboarding-wizard.tsx` — its eight steps, then `/onboarding/documents`:
 *
 *   1 study level ─────────────────→ Academic background
 *   2 subjects ─┐
 *   3 countries │
 *   4 budget    ├────────────────── → Target preferences
 *   5 campus    │
 *   8 support ──┘
 *   6 curriculum + grading ────────→ Academic background
 *   7 test results ────────────────→ Test scores
 *   9 documents ───────────────────→ Documents
 *
 * Group 1 is the "where and what" half of that quiz, group 2 the "what you
 * have got" half, group 3 the paperwork. Ungrouped, the eight cards read as
 * one undifferentiated wall and the student cannot see which of them they have
 * already answered.
 *
 * ─── WHY SOME CARDS SAY "NOT STARTED" TO A STUDENT WHO FINISHED ─────────────
 *
 * Only four of the eight hold quiz answers. Achievements, Work experience and
 * Application goals were NEVER ASKED — the goals question was câu 9 until the
 * owner removed it on 2026-07-30 (see the scope note in the wizard), and the
 * other two have never been in the flow. Personal information comes from
 * sign-up, not onboarding, which is why it is down with Documents and not up
 * with the answers.
 *
 * Within each group the quiz-backed cards lead and the never-asked ones
 * follow, so a group never opens on a "Not started" badge.
 *
 * Each `pct` counts only the fields its own editor writes — a card that can
 * never reach 100% because the page scores it on something the form does not
 * ask for is worse than no score at all.
 */
const SECTION_GROUPS: SectionGroup[] = [
  {
    key: 'direction',
    accent: 'accent-1',
    title: 'Your study direction',
    description: 'Where and what you want to study — the answers you gave when you signed up.',
    sections: [
      {
        key: 'preferences',
        href: '/profile/preferences',
        title: 'Target preferences',
        description: 'Countries, subjects, budget and preferred cities',
        pct: ({ profile: p }) =>
          ratio([
            filled(p?.preferred_countries),
            filled(p?.target_subjects),
            filled(p?.budget_range),
            filled(p?.campus_preferences),
            filled(p?.support_needs),
            filled(p?.study_mode_preference),
            filled(p?.target_intake),
          ]),
      },
      {
        key: 'goals',
        href: '/profile/goals',
        title: 'Application goals',
        description: 'What you want to achieve and your dream career',
        pct: ({ profile: p }) =>
          ratio([
            filled(p?.goals),
            filled(p?.career_interests),
            filled(p?.target_intake),
            filled(p?.application_cycle_year),
          ]),
      },
    ],
  },
  {
    key: 'record',
    accent: 'accent-2',
    title: 'Your academic record',
    description: 'Your grades, test results and everything you have done so far.',
    sections: [
      {
        key: 'academic',
        href: '/profile/academic',
        title: 'Academic background',
        description: 'Your education history, grades and subjects',
        pct: ({ profile: p }) =>
          ratio([
            filled(p?.study_level),
            filled(p?.current_institution),
            filled(p?.current_qualification),
            filled(p?.predicted_grades),
            filled(p?.academic_background),
            filled(p?.curriculum),
            filled(p?.curriculum_grades),
          ]),
      },
      {
        key: 'english',
        href: '/profile/english',
        title: 'Test scores',
        description: 'English-language and standardized test results',
        pct: ({ testScores }) => band(testScores),
      },
      {
        key: 'achievements',
        href: '/profile/achievements',
        title: 'Achievements',
        description: 'Awards, extracurriculars and leadership roles',
        pct: ({ profile: p }) =>
          Math.round((band(p?.achievements?.length ?? 0) + band(p?.skills?.length ?? 0)) / 2),
      },
      {
        key: 'work',
        href: '/profile/work',
        title: 'Work experience',
        description: 'Internships, jobs and volunteering',
        pct: ({ workEntries }) => band(workEntries),
      },
    ],
  },
  {
    key: 'paperwork',
    accent: 'accent-3',
    title: 'Documents & personal details',
    description: 'Files and contact details your applications are built on.',
    sections: [
      {
        key: 'documents',
        href: '/profile/documents',
        title: 'Documents',
        description: 'Upload important documents and certificates',
        pct: ({ documents }) => band(documents.length),
      },
      {
        key: 'personal',
        href: '/profile/personal',
        title: 'Personal information',
        description: 'Name, nationality, location and contact details',
        pct: ({ profile: p }) =>
          ratio([
            filled(p?.phone),
            filled(p?.date_of_birth),
            filled(p?.location),
            filled(p?.nationality),
            filled(p?.bio),
          ]),
      },
    ],
  },
];

/**
 * Flat view of the same eight, for the one figure that must not change shape
 * when the grouping does: overall profile strength.
 */
const SECTIONS: SectionDef[] = SECTION_GROUPS.flatMap((group) => group.sections);

const PLAN_LABELS: Record<string, string> = {
  // Current feature tiers
  'plus-starter': 'Starter plan',
  'plus-pro': 'Pro plan',
  'plus-premium': 'Premium plan',
  // Legacy duration-based plans (kept so existing subscribers still read nicely)
  'plus-6m': '6-month plan',
  'plus-12m': '12-month plan',
  'plus-24m': '24-month plan',
};

function formatDocDate(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  return new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* ─────────────────────────────────────────────────────────────────────────
   HERO — the one dark band on the page
───────────────────────────────────────────────────────────────────────── */

/**
 * A label/value pair on the dark band. `value` is null when the student has not
 * filled the field in, and the placeholder says so once rather than repeating
 * the label back ("Location not set" under a label reading "Location").
 */
function Fact({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex min-w-0 flex-col gap-gb-xxs">
      <dt className="text-gb-xs text-fg-on-inverse-muted">{label}</dt>
      <dd
        className={`truncate text-gb-sm ${value ? 'text-fg-on-inverse' : 'text-fg-on-inverse-muted'}`}
      >
        {value ?? 'Not set'}
      </dd>
    </div>
  );
}

function ProfileHero({
  displayName,
  email,
  avatarUrl,
  memberSince,
  profile,
  plusStatus,
  plusPlan,
  isMentor,
  strength,
  returnTo,
}: {
  displayName: string;
  email: string;
  avatarUrl?: string | undefined;
  memberSince: string;
  profile: StudentProfile | null;
  plusStatus: boolean;
  plusPlan: string | null;
  isMentor: boolean;
  strength: number;
  returnTo?: string | undefined;
}) {
  // Through the formatter, not raw: the column holds a `2027-09` month token
  // from /profile's picker or an `autumn-2027` season token from the
  // reflection flow, and this line used to print either one verbatim.
  //
  // Both the month and the sentence joining it to the cycle year are built
  // here rather than left to the page translator — /profile is a PII route,
  // where that translator can only substitute exact dictionary keys, and
  // neither of these strings exists until render.
  const { lang, t } = useLanguage();
  const intakeLabel = intakeDisplayLabel(profile?.target_intake, lang);
  const intake = intakeLabel
    ? profile?.application_cycle_year
      ? t('{intake} · applying {year}', { intake: intakeLabel, year: profile.application_cycle_year })
      : intakeLabel
    : null;

  const editProfileHref = returnTo
    ? `/profile/personal?return=${encodeURIComponent(returnTo)}`
    : '/profile/personal';

  return (
    <section className="flex flex-col gap-gb-4xl rounded-gb-2xl bg-surface-inverse-deep p-gb-3xl md:flex-row md:items-start md:justify-between md:p-gb-5xl">
      <div className="flex min-w-0 flex-col gap-gb-3xl">
        <div className="flex items-center gap-gb-xl">
          <Avatar name={displayName} src={avatarUrl} size="lg" />
          <div className="flex min-w-0 flex-col gap-gb-xxs">
            <div className="flex flex-wrap items-center gap-gb-md">
              <h1 className="font-display text-gb-display-xs font-semibold tracking-gb-display-tight text-fg-on-inverse">
                {displayName}
              </h1>
              {plusStatus ? <Badge variant="brand-chip">Plus</Badge> : null}
            </div>
            <p className="truncate text-gb-sm text-fg-on-inverse-muted">{email}</p>
          </div>
        </div>

        <dl className="grid gap-gb-2xl sm:grid-cols-2 lg:grid-cols-3">
          <Fact label="Location" value={profile?.location ?? null} />
          <Fact label="Nationality" value={profile?.nationality ?? null} />
          <Fact label="Study level" value={profile?.study_level ?? null} />
          <Fact label="Target intake" value={intake} />
          <Fact label="Member since" value={memberSince} />
          {plusStatus ? (
            <Fact
              label="Subscription"
              value={plusPlan ? (PLAN_LABELS[plusPlan] ?? plusPlan) : 'GlowBal Plus'}
            />
          ) : null}
        </dl>

        <div className="flex flex-wrap gap-gb-lg">
          <Button href={editProfileHref} variant="primary-on-dark" size="lg">
            Edit profile
          </Button>
          {isMentor ? (
            <Button href="/dashboard/advisor" variant="secondary-on-dark" size="lg">
              Advisor dashboard
            </Button>
          ) : null}
        </div>
      </div>

      {/*
        `showLabel={false}` and a heading of our own, rather than the ring's
        built-in caption: that caption is `text-fg-tertiary`, which is
        neutral-600 and unreadable on this band. The measure is still named
        immediately above the ring, which is the condition ScoreRing documents
        for turning its own label off.
      */}
      <div className="flex shrink-0 flex-col items-center gap-gb-lg self-stretch rounded-gb-xl border border-line-on-inverse p-gb-2xl text-center md:w-[240px] md:self-auto">
        <p className="text-gb-sm font-semibold text-fg-on-inverse">Profile strength</p>
        <ScoreRing value={strength} measure="progress" size="lg" showLabel={false} />
        <p className="text-gb-xs text-fg-on-inverse-muted">
          {strength >= 80
            ? 'Strong profile. Your matches and plans will be sharper for it.'
            : 'Fill in more sections for better course matches and stronger plans.'}
        </p>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   SECTION GROUP

   The owner's note on the first grouped build was that the three groups did
   not read as three things — a bold line and a grey line above a grid is not
   enough separation when every card below it is the same white rectangle.

   So a group leads with a banner it owns: its accent wash, a numbered tile in
   the solid accent, and a count of how many of its cards are finished. The
   number is the part that does the most work. "1 / 2 done" is a fact the page
   already knew and never said, and it turns each banner into a small scoreboard
   rather than a label.

   The accent then carries down into the cards through their progress fill and
   hover border, which is what ties a card to its banner once the student has
   scrolled the heading off screen.
───────────────────────────────────────────────────────────────────────── */

function SectionGroupBlock({
  group,
  index,
  input,
  returnTo,
}: {
  group: SectionGroup;
  index: number;
  input: SectionInputs;
  returnTo?: string | undefined;
}) {
  const { t } = useLanguage();
  const accent = ACCENT[group.accent];
  const done = group.sections.filter((section) => section.pct(input) >= 100).length;
  const total = group.sections.length;
  const allDone = done === total;
  const headingId = `profile-group-${group.key}`;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-gb-xl">
      <div className={`flex items-center gap-gb-xl rounded-gb-xl ${accent.wash} p-gb-xl`}>
        {/* Bricolage, because a lone numeral is the one place on this page a
            display face reads as a mark rather than as loud body text. */}
        <span
          aria-hidden="true"
          className={`flex size-gb-5xl shrink-0 items-center justify-center rounded-gb-lg ${accent.solid} font-display text-gb-lg font-semibold text-on-accent shadow-gb-xs`}
        >
          {index + 1}
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-gb-xxs">
          <h3 id={headingId} className="font-display text-gb-lg font-semibold text-fg">
            {t(group.title)}
          </h3>
          <p className="text-gb-sm text-fg-tertiary">{t(group.description)}</p>
        </div>

        {/* Reads as a tally, not a badge, so it does not compete with the
            per-card status chips it sits above. Solid once the group is
            finished — the only moment on this page that rewards completing
            something. */}
        <span
          className={`hidden shrink-0 items-center gap-gb-xs rounded-gb-full px-gb-lg py-gb-xs text-gb-sm font-semibold sm:inline-flex ${
            allDone ? `${accent.solid} text-on-accent` : `bg-surface ${accent.text}`
          }`}
        >
          {allDone ? <KitIcon art={ICONS.checkCircle} frame={16} /> : null}
          {t('{done} of {total} done', { done, total })}
        </span>
      </div>

      <div className="grid gap-gb-xl sm:grid-cols-2">
        {group.sections.map((section) => (
          <SectionCard
            key={section.key}
            section={section}
            input={input}
            accent={group.accent}
            returnTo={returnTo}
          />
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   SECTION CARD
───────────────────────────────────────────────────────────────────────── */

function SectionCard({
  section,
  input,
  accent,
  returnTo,
}: {
  section: SectionDef;
  input: SectionInputs;
  accent: ProgressTone;
  returnTo?: string | undefined;
}) {
  const { t } = useLanguage();
  const tone = ACCENT[accent];
  const pct = section.pct(input);
  const done = pct >= 100;
  const untouched = pct === 0;
  const href = returnTo
    ? `${section.href}?return=${encodeURIComponent(returnTo)}`
    : section.href;

  return (
    <Link
      href={href}
      className={`group flex flex-col gap-gb-lg rounded-gb-2xl border bg-surface p-gb-2xl shadow-gb-xs transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-gb-xxs hover:shadow-gb-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${tone.hover} ${
        /* Dashed while a card holds nothing, so an empty slot looks empty
           rather than looking like a filled card that happens to read 0%. */
        untouched ? 'border-dashed border-line-strong' : 'border-line'
      }`}
    >
      <div className="flex items-start justify-between gap-gb-md">
        {/* h4, not h3: the card sits inside a group whose banner is the h3, and
            a card title at the same level would flatten that nesting for anyone
            navigating the page by headings. */}
        <h4 className="min-w-0 text-gb-md font-semibold text-fg">{t(section.title)}</h4>
        <Badge variant={done ? 'safe-chip' : untouched ? 'neutral-chip' : 'brand-chip'}>
          {done ? t('Complete') : untouched ? t('Not started') : `${pct}%`}
        </Badge>
      </div>

      <p className="text-gb-sm text-fg-tertiary">{t(section.description)}</p>

      <div className="mt-auto flex flex-col gap-gb-lg pt-gb-md">
        <ProgressBar value={pct} label={t(section.title)} size="sm" tone={accent} />
        <span className={`inline-flex items-center gap-gb-xs text-gb-sm font-semibold ${tone.text}`}>
          {untouched ? t('Get started') : done ? t('Review') : t('Continue')}
          <KitIcon
            art={ICONS.arrowRight}
            frame={16}
            className="transition-transform group-hover:translate-x-gb-xxs"
          />
        </span>
      </div>
    </Link>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   RIGHT RAIL
───────────────────────────────────────────────────────────────────────── */

function DocumentsCard({
  documents,
  returnTo,
}: {
  documents: ProfileDocument[];
  returnTo?: string | undefined;
}) {
  const shown = documents.slice(0, 4);
  const manageHref = returnTo
    ? `/profile/documents?return=${encodeURIComponent(returnTo)}`
    : '/profile/documents';

  return (
    <Panel padding="sm" className="flex flex-col gap-gb-xl">
      <PanelHeader
        title="Your documents"
        action={
          <Link
            href={manageHref}
            className="text-gb-sm font-semibold text-fg-brand hover:underline"
          >
            Manage
          </Link>
        }
      />

      {shown.length > 0 ? (
        <ul className="flex flex-col gap-gb-lg">
          {shown.map((doc) => (
            <li key={doc.id} className="flex min-w-0 flex-col gap-gb-xxs">
              <span className="truncate text-gb-sm font-medium text-fg">{doc.file_name}</span>
              <span className="text-gb-xs text-fg-muted">
                {doc.type} · {formatDocDate(doc.created_at)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-gb-xl border border-dashed border-line-strong px-gb-xl py-gb-3xl text-center text-gb-sm text-fg-muted">
          No documents uploaded yet.
        </p>
      )}

      {documents.length > shown.length ? (
        <p className="text-gb-xs text-fg-muted">
          {documents.length - shown.length} more in your documents
        </p>
      ) : null}

      <Button href={manageHref} variant="secondary" size="lg" className="w-full">
        <KitIcon art={ICONS.uploadCloud} frame={20} />
        Upload a document
      </Button>
    </Panel>
  );
}

function ApplicationsCard({ activeApplications }: { activeApplications: number }) {
  return (
    <Panel padding="sm" className="flex flex-col gap-gb-xl">
      <PanelHeader title="Your applications" />

      <div className="flex items-baseline gap-gb-lg">
        <span className="font-display text-gb-display-sm font-semibold tracking-gb-display-tight text-fg">
          {activeApplications}
        </span>
        <span className="text-gb-sm text-fg-tertiary">
          {activeApplications === 1 ? 'application in progress' : 'applications in progress'}
        </span>
      </div>

      <Button href="/apply" variant="secondary" size="lg" className="w-full">
        Go to my applications
        <KitIcon art={ICONS.arrowRight} frame={20} />
      </Button>
    </Panel>
  );
}

function AccountCard({ email, plusStatus }: { email: string; plusStatus: boolean }) {
  return (
    <Panel padding="sm" className="flex flex-col gap-gb-xl">
      <PanelHeader title="Account" description={email} />

      <Link
        href="/plus"
        className="flex items-center justify-between gap-gb-lg rounded-gb-xl border border-line bg-surface-muted px-gb-xl py-gb-lg text-gb-sm font-medium text-fg-secondary transition-colors hover:border-brand hover:text-fg-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        {plusStatus ? 'Manage GlowBal Plus' : 'Upgrade to GlowBal Plus'}
        <KitIcon art={ICONS.arrowRight} frame={16} className="shrink-0" />
      </Link>

      <SignOutButton
        containerClassName="flex flex-col gap-gb-md border-t border-line pt-gb-xl"
        className="w-full rounded-gb-md border border-line-strong bg-surface px-gb-xl py-gb-lg text-gb-sm font-semibold text-fg-error shadow-gb-xs-skeuomorphic transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:pointer-events-none disabled:opacity-60"
      >
        Sign out
      </SignOutButton>
    </Panel>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   MAIN EXPORT
───────────────────────────────────────────────────────────────────────── */

export function ProfileClient({
  displayName,
  email,
  avatarUrl,
  memberSince,
  profile,
  documents,
  activeApplications,
  workEntries,
  testScores,
  isMentor,
  plusStatus,
  plusPlan,
  returnTo,
  applicationLabel,
}: Props) {
  const { t } = useLanguage();
  const input: SectionInputs = { profile, documents, workEntries, testScores };
  const strength = Math.round(
    SECTIONS.reduce((total, section) => total + section.pct(input), 0) / SECTIONS.length,
  );

  return (
    <div className="mx-auto flex max-w-gb-desktop flex-col gap-gb-4xl">
      {returnTo ? (
        <nav aria-label={t('Back')}>
          <Link
            href={returnTo}
            className="inline-flex items-center gap-gb-xs text-gb-sm font-semibold text-fg-brand hover:underline"
          >
            <KitIcon art={ICONS.arrowLeft} frame={16} />
            {applicationLabel ? `← ${applicationLabel}` : t('Back')}
          </Link>
        </nav>
      ) : null}

      <ProfileHero
        displayName={displayName}
        email={email}
        avatarUrl={avatarUrl}
        memberSince={memberSince}
        profile={profile}
        plusStatus={plusStatus}
        plusPlan={plusPlan}
        isMentor={isMentor}
        strength={strength}
        returnTo={returnTo}
      />

      <div className="grid gap-gb-4xl lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-gb-xl">
          <div className="flex flex-col gap-gb-xxs">
            <h2 className="font-display text-gb-xl font-semibold text-fg">{t('Profile sections')}</h2>
            <p className="text-gb-sm text-fg-tertiary">
              {t('Keep these up to date for better recommendations and stronger application plans.')}
            </p>
          </div>

          {SECTION_GROUPS.map((group, index) => (
            <SectionGroupBlock
              key={group.key}
              group={group}
              index={index}
              input={input}
              returnTo={returnTo}
            />
          ))}
        </div>

        <aside className="flex flex-col gap-gb-xl">
          <DocumentsCard documents={documents} returnTo={returnTo} />
          <ApplicationsCard activeApplications={activeApplications} />
          <AccountCard email={email} plusStatus={plusStatus} />
        </aside>
      </div>
    </div>
  );
}
