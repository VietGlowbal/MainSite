'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '@/lib/i18n';
import type {
  MatchingReportPageData,
  ProgrammeFit,
} from '../domain';
import {
  Avatar,
  Badge,
  Button,
  CheckItem,
  CheckList,
  Panel,
  ProgressBar,
} from '@/shared/ui';
import { useLoadingIndicator } from '@/shared/ui/loading-overlay';

const DIMENSIONS: Array<{
  key: keyof ProgrammeFit['dimensions'];
  label: string;
}> = [
  { key: 'academicCompetitiveness', label: 'Academic competitiveness' },
  { key: 'personaAlignment', label: 'Profile and programme fit' },
  { key: 'financialFeasibility', label: 'Financial feasibility' },
  { key: 'careerDirection', label: 'Career direction' },
  { key: 'applicationReadiness', label: 'Application readiness' },
];

function classificationLabel(classification: ProgrammeFit['classification']) {
  if (classification === 'safety') return 'Safety';
  if (classification === 'match') return 'Match';
  if (classification === 'reach') return 'Reach';
  if (classification === 'currently_ineligible') return 'Currently ineligible';
  return 'Not enough data to classify';
}

function classificationVariant(classification: ProgrammeFit['classification']) {
  if (classification === 'safety') return 'safe' as const;
  if (classification === 'match') return 'recommend' as const;
  if (classification === 'reach') return 'reach' as const;
  return 'neutral' as const;
}

function verified(value: string | null | undefined, fallback: string) {
  return value || fallback;
}

function eligibilityLabel(status: 'met' | 'not_met' | 'unknown') {
  if (status === 'met') return 'Met';
  if (status === 'not_met') return 'Not met';
  return 'Not verified';
}

export function MatchingReportView({
  data,
  migrationMissing,
}: {
  data: MatchingReportPageData;
  migrationMissing: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    migrationMissing ? t('Matching Report is not enabled in the database.') : null,
  );
  const [nextAt, setNextAt] = useState<string | null>(null);
  useLoadingIndicator(busy, t('Assessing programme fit'));

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/applications/${data.id}/match-insights`, {
        method: 'POST',
      });
      const body = await response.json().catch(() => ({}));
      if (body.nextRegenerationAt) setNextAt(body.nextRegenerationAt as string);
      if (!response.ok) throw new Error(body.error || t('Could not create Matching Report.'));
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : t('Could not create Matching Report.'),
      );
    } finally {
      setBusy(false);
    }
  }

  const analysis = data.analysis;
  if (!analysis) {
    return (
      <div className="flex min-h-[32rem] flex-col items-center justify-center gap-gb-2xl text-center">
        <Avatar name={data.universityName} src={data.university?.logoUrl} size="lg" />
        <div className="flex max-w-2xl flex-col gap-gb-md">
          <Badge variant="brand-subtle">GlowBal Matching Report</Badge>
          <h1 className="font-display text-gb-display-sm font-semibold tracking-gb-display-tight text-fg">
            {data.courseName}
          </h1>
          <p className="text-gb-md text-fg-tertiary">{data.universityName}</p>
          <p className="text-gb-sm text-fg-tertiary">
            {t('The report checks entry requirements first, then evaluates academic fit, profile, finances, career direction, and readiness separately.')}
          </p>
        </div>
        {error ? <p className="max-w-xl text-gb-sm text-fg-error">{error}</p> : null}
        <Button size="lg" onClick={generate} disabled={busy || migrationMissing}>
          {busy ? t('Creating report…') : t('Create Matching Report')}
        </Button>
        <Button href="/profile" variant="secondary">
          {t('Check profile data')}
        </Button>
      </div>
    );
  }

  const fit = analysis.fit;
  const allGaps = [
    ...new Set([
      ...analysis.weaknesses,
      ...DIMENSIONS.flatMap(({ key }) => fit.dimensions[key].gaps),
    ]),
  ];

  return (
    <div className="flex flex-col gap-gb-4xl" data-no-auto-translate>
      <header className="flex flex-col gap-gb-xl rounded-gb-2xl bg-surface-inverse-deep p-gb-3xl text-fg-on-inverse">
        <div className="flex flex-wrap items-start justify-between gap-gb-xl">
          <div className="flex min-w-0 items-center gap-gb-lg">
            <Avatar name={data.universityName} src={data.university?.logoUrl} size="lg" />
            <div className="min-w-0">
              <p className="text-gb-sm text-fg-on-inverse-muted">{data.universityName}</p>
              <h1 className="font-display text-gb-display-xs font-semibold tracking-gb-display-tight">
                {data.courseName}
              </h1>
              <p className="text-gb-sm text-fg-on-inverse-secondary">
                {[data.degreeLevel, data.country].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>
          <Badge variant={classificationVariant(fit.classification)}>
            {t(classificationLabel(fit.classification))}
          </Badge>
        </div>
        <div className="grid gap-gb-sm">
          <div className="flex items-center justify-between text-gb-sm">
            <span>{t('Data confidence')}</span>
            <strong>{fit.confidence}%</strong>
          </div>
          <ProgressBar value={fit.confidence} label={t('Matching Report confidence')} />
        </div>
        <div className="flex flex-wrap gap-gb-md">
          <Button onClick={generate} disabled={busy} variant="primary-on-dark">
            {busy ? t('Updating…') : t('Update report')}
          </Button>
          <Button href="/ai-strategy/matching" variant="secondary-on-dark">
            {t('Choose another profile')}
          </Button>
        </div>
      </header>

      {error ? <p className="text-gb-sm text-fg-error">{error}</p> : null}
      {nextAt ? (
        <p className="text-gb-xs text-fg-muted">
          {t('Next free generation')}: {new Date(nextAt).toLocaleString('vi-VN')}
        </p>
      ) : null}

      {fit.limitations.length > 0 ? (
        <Panel className="flex flex-col gap-gb-md">
          <h2 className="text-gb-md font-semibold text-fg">{t('Report limitations')}</h2>
          <ul className="list-disc space-y-gb-sm pl-gb-xl text-gb-sm text-fg-tertiary">
            {fit.limitations.map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <section className="flex flex-col gap-gb-lg">
        <h2 className="font-display text-gb-display-xs font-semibold tracking-gb-display-tight text-fg">
          {t('Five dimensions of fit')}
        </h2>
        <div className="grid gap-gb-lg md:grid-cols-2">
          {DIMENSIONS.map(({ key, label }) => {
            const dimension = fit.dimensions[key];
            return (
              <Panel key={key} className="flex flex-col gap-gb-lg">
                <div className="flex items-center justify-between gap-gb-md">
                  <h3 className="text-gb-md font-semibold text-fg">{label}</h3>
                  <span className="text-gb-sm font-semibold text-fg-brand">
                    {dimension.score === null ? 'N/A' : `${dimension.score}/5`}
                  </span>
                </div>
                <p className="text-gb-sm leading-relaxed text-fg-tertiary">{dimension.summary}</p>
                {dimension.limitation ? (
                  <p className="text-gb-xs text-fg-muted">{dimension.limitation}</p>
                ) : null}
              </Panel>
            );
          })}
        </div>
      </section>

      <div className="grid gap-gb-2xl lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex flex-col gap-gb-2xl">
          <Panel className="flex flex-col gap-gb-lg">
            <h2 className="text-gb-lg font-semibold text-fg">{t('Why this university?')}</h2>
            <p className="text-gb-sm leading-relaxed text-fg-tertiary">
            {verified(data.university?.insight || data.university?.bestFor, t('No verified data'))}
            </p>
            {analysis.strengths.length > 0 ? (
              <CheckList>
                {analysis.strengths.slice(0, 4).map((strength) => (
                  <CheckItem key={strength}>{strength}</CheckItem>
                ))}
              </CheckList>
            ) : null}
          </Panel>

          <Panel className="flex flex-col gap-gb-lg">
            <h2 className="text-gb-lg font-semibold text-fg">{t('Programme overview')}</h2>
            <p className="text-gb-sm leading-relaxed text-fg-tertiary">
              {verified(data.course.summary, t('No verified data'))}
            </p>
            <dl className="grid gap-gb-md sm:grid-cols-2">
              {([
                ['Study level', data.degreeLevel],
                ['Duration', data.course.duration],
                ['Study mode', data.studyMode],
                ['Intake', data.intake],
              ] as Array<[string, string | null | undefined]>).map(([label, value]) => (
                <div key={label} className="rounded-gb-xl bg-surface-muted p-gb-lg">
                  <dt className="text-gb-xs text-fg-muted">{t(label)}</dt>
                  <dd className="text-gb-sm font-medium text-fg">{verified(value, t('No verified data'))}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          <Panel className="flex flex-col gap-gb-lg">
            <h2 className="text-gb-lg font-semibold text-fg">{t('Personal fit')}</h2>
            <p className="text-gb-sm leading-relaxed text-fg-tertiary">
              {fit.dimensions.personaAlignment.summary}
            </p>
            {fit.dimensions.personaAlignment.evidence.length > 0 ? (
              <ul className="list-disc space-y-gb-sm pl-gb-xl text-gb-sm text-fg-tertiary">
                {fit.dimensions.personaAlignment.evidence.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </Panel>

          <Panel className="flex flex-col gap-gb-lg">
            <h2 className="text-gb-lg font-semibold text-fg">{t('Admission requirements')}</h2>
            <div className="grid gap-gb-md sm:grid-cols-2">
              {Object.entries(fit.eligibility).map(([key, status]) => (
                <div key={key} className="flex items-center justify-between gap-gb-md rounded-gb-xl bg-surface-muted p-gb-lg">
                  <span className="text-gb-sm text-fg-tertiary">
                    {key.replace(/([A-Z])/g, ' $1')}
                  </span>
                  <strong className="text-gb-xs text-fg">{t(eligibilityLabel(status))}</strong>
                </div>
              ))}
            </div>
            <p className="text-gb-sm text-fg-tertiary">
              {verified(data.course.entryRequirements, t('No verified data'))}
            </p>
            <p className="text-gb-sm text-fg-tertiary">
              {verified(data.course.englishRequirements, t('No verified data'))}
            </p>
          </Panel>

          <Panel className="flex flex-col gap-gb-lg">
            <h2 className="text-gb-lg font-semibold text-fg">{t('Costs and scholarships')}</h2>
            <p className="text-gb-sm text-fg-tertiary">
              {t('Tuition')}: {verified(data.course.tuition || data.university?.tuition, t('No verified data'))}
            </p>
            <p className="text-gb-sm text-fg-tertiary">
              {t('Living costs')}: {verified(data.university?.livingCost, t('No verified data'))}
            </p>
            {data.scholarships.length > 0 ? (
              <div className="flex flex-col gap-gb-md">
                {data.scholarships.map((scholarship) => (
                  <div key={scholarship.id} className="rounded-gb-xl border border-line p-gb-lg">
                    <p className="text-gb-sm font-semibold text-fg">{scholarship.name}</p>
                    <p className="text-gb-xs text-fg-tertiary">
                      {verified(scholarship.coverage, t('No verified data'))}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gb-sm text-fg-muted">
                {verified(data.university?.scholarship, t('No verified data'))}
              </p>
            )}
          </Panel>

          <Panel className="flex flex-col gap-gb-lg">
            <h2 className="text-gb-lg font-semibold text-fg">{t('Profile gaps')}</h2>
            {allGaps.length > 0 ? (
              <ul className="list-disc space-y-gb-sm pl-gb-xl text-gb-sm text-fg-tertiary">
                {allGaps.map((gap) => (
                  <li key={gap}>{gap}</li>
                ))}
              </ul>
            ) : (
              <p className="text-gb-sm text-fg-muted">
                {t('AI did not identify any evidence-backed gaps.')}
              </p>
            )}
          </Panel>
        </div>

        <aside className="h-fit lg:sticky lg:top-gb-3xl">
          <Panel className="flex flex-col gap-gb-lg">
            <h2 className="text-gb-md font-semibold text-fg">{t('Sources and freshness')}</h2>
            <dl className="flex flex-col gap-gb-md text-gb-sm">
              <div>
                <dt className="text-fg-muted">{t('Official source')}</dt>
                <dd className="break-words text-fg">
                  {data.courseUrl ? (
                    <a
                      href={data.courseUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-fg-brand hover:underline"
                    >
                      {t('Open programme page')}
                    </a>
                  ) : (
                    verified(null, t('No verified data'))
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-fg-muted">{t('Source confidence')}</dt>
                <dd className="text-fg">
                  {data.course.sourceConfidence === null
                    ? verified(null, t('No verified data'))
                    : `${Math.round(data.course.sourceConfidence * 100)}%`}
                </dd>
              </div>
              <div>
                <dt className="text-fg-muted">{t('Last extracted')}</dt>
                <dd className="text-fg">
                  {data.course.lastExtractedAt
                    ? new Date(data.course.lastExtractedAt).toLocaleString('vi-VN')
                    : verified(null, t('No verified data'))}
                </dd>
              </div>
              <div>
                <dt className="text-fg-muted">{t('Last analysed')}</dt>
                <dd className="text-fg">
                  {new Date(analysis.createdAt).toLocaleString('vi-VN')}
                </dd>
              </div>
            </dl>
            <Button href="/ai-strategy" variant="secondary">
              {t('Back to AI Strategy')}
            </Button>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
