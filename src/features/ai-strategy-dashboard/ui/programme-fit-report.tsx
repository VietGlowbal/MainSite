'use client';

import Link from 'next/link';
import type { Confidence, ProgrammeFit, RequirementRow } from '../domain';
import { CONFIDENCE_LABEL } from '../domain';
import { ReportPanel, ReportTabs, useReportTabs } from './report-chrome';
import { useLanguage } from '@/lib/i18n';
import { Badge, Panel, ScoreRing, type BadgeVariant } from '@/shared/ui';

/**
 * Programme Fit — "Phân tích mức độ phù hợp", the second report page.
 *
 * The mockup's six tabs, each backed by a real column: Why this university,
 * Programme overview, Persona alignment, Admission requirements, Costs and
 * scholarships, Profile gaps. See domain/evaluation/programme-fit.ts.
 *
 * ─── THE REQUIREMENTS LIST HAS NO TICKS ──────────────────────────────────────
 *
 * The design draws a tick beside every entry requirement, which reads as "you
 * meet this". We cannot know that: the university's `gpa_range` is free text
 * and the student's predicted grades are free text in another country's
 * marking system. A tick meaning "we did not check" is the most damaging thing
 * this page could carry — a student who applies believing they clear a bar they
 * miss has been harmed by the report. Rows state the requirement; the academic
 * competency score carries their standing.
 *
 * ─── A MISSING UNIVERSITY ROW IS NOT AN ERROR ────────────────────────────────
 *
 * `university_id` is resolved by a matcher during the course parse and does not
 * always land. Every section degrades on its own: no hero image, no rankings,
 * requirements fall back to the course's own summary. The page still renders,
 * because the student is still applying to the course either way.
 */

const CONFIDENCE_VARIANT: Record<Confidence, BadgeVariant> = {
  high: 'safe-chip',
  medium: 'info-chip',
  low: 'neutral-chip',
};

export function ProgrammeFitReport({
  applicationId,
  fit,
}: {
  applicationId: string;
  fit: ProgrammeFit;
}) {
  const { t } = useLanguage();

  const tabs = [
    { key: 'why', label: 'Why this university', has: fit.whyRecommended.length > 0 },
    { key: 'overview', label: 'Programme overview', has: fit.programmeOverview.length > 0 },
    { key: 'persona', label: 'Persona alignment', has: fit.personaAlignmentSummary !== null },
    { key: 'requirements', label: 'Admission requirements', has: fit.requirements.length > 0 },
    {
      key: 'costs',
      label: 'Costs and scholarships',
      has: fit.costs.length > 0 || fit.scholarshipNote !== null,
    },
    { key: 'gaps', label: 'Profile gaps', has: fit.profileGaps.length > 0 },
  ]
    .filter((tab) => tab.has)
    .map(({ key, label }) => ({ key, label }));

  const { active, setActive } = useReportTabs(tabs);
  const university = fit.university;

  return (
    <div className="flex flex-col gap-gb-3xl">
      <h1 className="max-w-3xl font-display text-gb-display-sm font-semibold text-fg">
        {t('How well you match this course, university and its scholarships')}
      </h1>

      <UniversityHero fit={fit} />

      <div className="grid gap-gb-3xl lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="flex flex-col gap-gb-2xl">
          <div className="flex flex-wrap items-center gap-gb-xl">
            <ScoreRing
              value={fit.overallFitPercent}
              measure="match"
              label={t('Overall fit')}
              size="md"
            />
            <div className="flex flex-col gap-gb-xs">
              <h2 className="font-display text-gb-xl font-semibold text-fg">
                {t('Overall fit')}
              </h2>
              <Badge variant={CONFIDENCE_VARIANT[fit.confidence]}>
                {t(CONFIDENCE_LABEL[fit.confidence])}
              </Badge>
            </div>
          </div>

          {tabs.length === 0 ? (
            <Panel className="flex flex-col gap-gb-md">
              <h2 className="text-gb-md font-semibold text-fg">
                {t('We do not have enough on this course yet')}
              </h2>
              <p className="text-gb-sm text-fg-tertiary">
                {t(
                  'Run your analysis, and the details we hold for this university will appear here.',
                )}
              </p>
            </Panel>
          ) : (
            <>
              <ReportTabs
                tabs={tabs}
                active={active}
                onSelect={setActive}
                label={t('Fit report sections')}
              />
              <ReportPanel tabKey={active}>
                {active === 'why' ? (
                  <Paragraphs
                    heading={t('Why this university was recommended')}
                    items={fit.whyRecommended}
                  />
                ) : null}
                {active === 'overview' ? (
                  <Paragraphs heading={t('Programme overview')} items={fit.programmeOverview} />
                ) : null}
                {active === 'persona' ? <PersonaAlignment fit={fit} /> : null}
                {active === 'requirements' ? (
                  <RequirementList
                    heading={t('Admission requirements')}
                    rows={fit.requirements}
                    note={t(
                      'What the course asks for. We do not tick these off against your grades — marking systems differ too much between countries for that to be safe.',
                    )}
                  />
                ) : null}
                {active === 'costs' ? <Costs fit={fit} /> : null}
                {active === 'gaps' ? <ProfileGaps fit={fit} /> : null}
              </ReportPanel>
            </>
          )}
        </div>

        <ReadyCard applicationId={applicationId} fit={fit} universityName={university?.name ?? fit.programme.universityName} />
      </div>
    </div>
  );
}

/**
 * The cover image with the name and ranking badges over it, from the mockup.
 *
 * Falls back to a plain heading with no image when the university row (or its
 * `image_url`) is missing, rather than a grey placeholder box — an empty frame
 * where a photo should be looks broken, a heading does not.
 */
function UniversityHero({ fit }: { fit: ProgrammeFit }) {
  const { t } = useLanguage();
  const university = fit.university;
  const name = university?.name || fit.programme.universityName;
  const imageUrl = university?.imageUrl;

  const badges = [
    university?.qsRank != null ? t('#{n} QS world ranking', { n: university.qsRank }) : null,
    university?.theRank != null ? t('#{n} THE ranking', { n: university.theRank }) : null,
    university?.country,
    university?.type,
  ].filter((value): value is string => Boolean(value));

  if (!imageUrl) {
    return (
      <Panel className="flex flex-col gap-gb-md">
        <h2 className="font-display text-gb-xl font-semibold text-fg">{name}</h2>
        <p className="text-gb-sm text-fg-tertiary">{fit.programme.courseName}</p>
        {badges.length > 0 ? (
          <ul className="flex flex-wrap gap-gb-xs">
            {badges.map((badge) => (
              <li key={badge}>
                <Badge variant="neutral">{badge}</Badge>
              </li>
            ))}
          </ul>
        ) : null}
      </Panel>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-gb-xl border border-line-on-image">
      {/* eslint-disable-next-line @next/next/no-img-element -- university imagery
          is remote and host-varied (the imagery cron writes whatever the source
          gives), so next/image's per-host allowlist cannot cover it. */}
      <img
        src={imageUrl}
        alt=""
        className="h-[18rem] w-full object-cover sm:h-[22rem]"
        loading="lazy"
      />
      {/* The scrim token — the bottom-up darkening that keeps white text
          legible over an arbitrary photograph. Same treatment as the team
          cover photos in marketing/ui/about-team.tsx. */}
      <div className="absolute inset-x-0 bottom-0 h-3/5 bg-linear-to-t from-scrim to-transparent" />
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-gb-md p-gb-xl">
        <h2 className="font-display text-gb-xl font-semibold text-white">{name}</h2>
        {badges.length > 0 ? (
          <ul className="flex flex-wrap gap-gb-xs">
            {badges.map((badge) => (
              <li
                key={badge}
                className="rounded-gb-sm bg-brand px-gb-md py-gb-xxs text-gb-xs font-medium text-white"
              >
                {badge}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

function PersonaAlignment({ fit }: { fit: ProgrammeFit }) {
  const { t } = useLanguage();
  return (
    <section className="flex flex-wrap items-start gap-gb-xl">
      <ScoreRing
        value={fit.personaAlignmentPercent}
        measure="match"
        label={t('Persona alignment')}
        size="sm"
      />
      <div className="flex min-w-[14rem] max-w-2xl flex-1 flex-col gap-gb-md">
        <h2 className="text-gb-lg font-semibold text-fg">{t('Persona alignment')}</h2>
        <p className="text-gb-sm leading-relaxed text-fg-secondary">
          {fit.personaAlignmentSummary}
        </p>
      </div>
    </section>
  );
}

function Paragraphs({ heading, items }: { heading: string; items: readonly string[] }) {
  return (
    <section className="flex flex-col gap-gb-md">
      <h2 className="text-gb-lg font-semibold text-fg">{heading}</h2>
      {items.map((item) => (
        <p key={item} className="max-w-2xl text-gb-sm leading-relaxed text-fg-secondary">
          {item}
        </p>
      ))}
    </section>
  );
}

function RequirementList({
  heading,
  rows,
  note,
}: {
  heading: string;
  rows: readonly RequirementRow[];
  note?: string;
}) {
  if (rows.length === 0) return null;
  return (
    <section className="flex flex-col gap-gb-md">
      <h2 className="text-gb-lg font-semibold text-fg">{heading}</h2>
      {note ? <p className="max-w-2xl text-gb-xs text-fg-tertiary">{note}</p> : null}
      <dl className="flex flex-col">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex flex-wrap justify-between gap-gb-lg border-b border-line py-gb-lg last:border-b-0"
          >
            <dt className="text-gb-sm font-medium text-fg">{row.label}</dt>
            <dd className="max-w-md text-gb-sm text-fg-secondary sm:text-right">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Costs({ fit }: { fit: ProgrammeFit }) {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col gap-gb-2xl">
      <RequirementList heading={t('Costs')} rows={fit.costs} />
      {fit.scholarshipNote ? (
        <section className="flex flex-col gap-gb-md">
          <h2 className="text-gb-lg font-semibold text-fg">{t('Scholarships')}</h2>
          <p className="max-w-2xl text-gb-sm leading-relaxed text-fg-secondary">
            {fit.scholarshipNote}
          </p>
        </section>
      ) : null}
    </div>
  );
}

function ProfileGaps({ fit }: { fit: ProgrammeFit }) {
  const { t } = useLanguage();
  return (
    <section className="flex flex-col gap-gb-md">
      <h2 className="text-gb-lg font-semibold text-fg">{t('Profile gaps')}</h2>
      <p className="max-w-2xl text-gb-xs text-fg-tertiary">
        {t('The distance between where you are ({current}%) and where you could be ({goal}%).', {
          current: fit.overallFitPercent,
          goal: fit.goalFitPercent,
        })}
      </p>
      <ul className="flex flex-col gap-gb-xs">
        {fit.profileGaps.map((gap) => (
          <li key={gap} className="text-gb-sm text-fg-secondary">
            {gap}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The sticky call-to-action card from the mockup's right column. */
function ReadyCard({
  applicationId,
  fit,
  universityName,
}: {
  applicationId: string;
  fit: ProgrammeFit;
  universityName: string;
}) {
  const { t } = useLanguage();
  return (
    <Panel className="flex flex-col gap-gb-lg lg:sticky lg:top-gb-4xl">
      <h2 className="text-gb-md font-semibold text-fg">
        {t('Ready to study at {university}?', { university: universityName })}
      </h2>
      <p className="text-gb-sm text-fg-tertiary">
        {t('Turn this report into a plan for {course}, built around the gaps above.', {
          course: fit.programme.courseName,
        })}
      </p>
      <Link
        href={`/ai-strategy/${applicationId}/strategy/intro`}
        className="rounded-gb-md bg-brand px-gb-xl py-gb-lg text-center text-gb-sm font-semibold text-white transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        {t('Build my strategy')}
      </Link>
      {fit.programme.courseUrl ? (
        <a
          href={fit.programme.courseUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-center text-gb-xs text-fg-tertiary hover:underline"
        >
          {t('Check the official course page')}
        </a>
      ) : null}
    </Panel>
  );
}
