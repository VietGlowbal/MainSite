'use client';

import { useState } from 'react';
import { useT } from '@/lib/i18n';
import type { PersonalReport } from '../domain';
import { Badge, Button, Panel, ProgressBar } from '@/shared/ui';
import { useLoadingIndicator } from '@/shared/ui/loading-overlay';

type TabKey =
  | 'coreIdentity'
  | 'drivingForce'
  | 'signaturePattern'
  | 'emergingThemes'
  | 'personalPositioning'
  | 'proofOfMe';

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'coreIdentity', label: 'Core identity' },
  { key: 'drivingForce', label: 'Driving force' },
  { key: 'signaturePattern', label: 'Signature pattern' },
  { key: 'emergingThemes', label: 'Emerging themes' },
  { key: 'personalPositioning', label: 'Personal positioning' },
  { key: 'proofOfMe', label: 'Proof of me' },
];

function statusLabel(status: 'established' | 'emerging' | 'limited') {
  if (status === 'established') return 'Established';
  if (status === 'emerging') return 'Emerging';
  return 'Limited data';
}

function NarrativeCard({
  section,
}: {
  section: PersonalReport['coreIdentity'];
}) {
  const t = useT();
  return (
    <Panel className="flex flex-col gap-gb-xl">
      <div className="flex flex-wrap items-center gap-gb-md">
        <Badge variant={section.status === 'limited' ? 'neutral-chip' : 'brand-chip'}>
          {t(statusLabel(section.status))}
        </Badge>
        <span className="text-gb-xs text-fg-muted">{t('Confidence')}: {section.confidence}</span>
      </div>
      <div className="flex flex-col gap-gb-md">
        <h3 className="font-display text-gb-display-xs font-semibold tracking-gb-display-tight text-fg">
          {section.headline}
        </h3>
        <p className="whitespace-pre-line text-gb-md leading-relaxed text-fg-tertiary">
          {section.narrative}
        </p>
      </div>
      {section.evidenceRefs.length > 0 ? (
        <div className="flex flex-col gap-gb-sm">
          <p className="text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">
            {t('Supporting data')}
          </p>
          <div className="flex flex-wrap gap-gb-sm">
            {section.evidenceRefs.map((ref) => (
              <Badge key={ref.id} variant="neutral">
                {ref.label}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}
      {section.limitation ? (
        <p className="rounded-gb-xl bg-surface-muted p-gb-lg text-gb-sm text-fg-tertiary">
          {section.limitation}
        </p>
      ) : null}
    </Panel>
  );
}

export function PersonalReportView({
  initialReport,
  initialStale,
  generatedAt,
  migrationMissing,
}: {
  initialReport: PersonalReport | null;
  initialStale: boolean;
  generatedAt: string | null;
  migrationMissing: boolean;
}) {
  const t = useT();
  const [report, setReport] = useState(initialReport);
  const [stale, setStale] = useState(initialStale);
  const [activeTab, setActiveTab] = useState<TabKey>('coreIdentity');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    migrationMissing ? t('This feature is not enabled in the database.') : null,
  );
  const [nextAt, setNextAt] = useState<string | null>(null);
  useLoadingIndicator(busy, report ? t('Updating applicant profile') : t('Creating applicant profile'));

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/ai-strategy/personal-report', { method: 'POST' });
      const body = await response.json().catch(() => ({}));
      if (body.report) setReport(body.report as PersonalReport);
      if (body.nextRegenerationAt) setNextAt(body.nextRegenerationAt as string);
      if (!response.ok) throw new Error(body.error || t('Could not create the report.'));
      setStale(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t('Could not create the report.'));
    } finally {
      setBusy(false);
    }
  }

  if (!report) {
    return (
      <div className="flex min-h-[32rem] flex-col items-center justify-center gap-gb-2xl text-center">
        <Badge variant="brand-subtle">Personal Reflection</Badge>
        <div className="flex max-w-2xl flex-col gap-gb-md">
          <h1 className="font-display text-gb-display-md font-semibold tracking-gb-display-tight text-fg">
            {t('Your applicant profile')}
          </h1>
          <p className="text-gb-md text-fg-tertiary">
            {t('GlowBal rereads your profile, achievements, and activities to find evidence-backed patterns. Missing data is called out rather than filled in by AI.')}
          </p>
        </div>
        {error ? <p className="max-w-xl text-gb-sm text-fg-error">{error}</p> : null}
        <Button size="lg" onClick={generate} disabled={busy || migrationMissing}>
          {busy ? t('Creating report…') : t('Create report')}
        </Button>
        <Button href="/ai-strategy/reflection" variant="secondary">
          {t('Review Reflection')}
        </Button>
      </div>
    );
  }

  const narrativeSections = {
    coreIdentity: report.coreIdentity,
    drivingForce: report.drivingForce,
    signaturePattern: report.signaturePattern,
    personalPositioning: report.personalPositioning,
  };

  return (
    <div className="flex flex-col gap-gb-4xl" data-no-auto-translate>
      <header className="flex flex-col gap-gb-xl">
        <div className="flex flex-wrap items-center gap-gb-md">
          <Badge variant="brand-subtle">Personal Reflection</Badge>
          {stale ? <Badge variant="neutral">{t('Data is newer than this report')}</Badge> : null}
        </div>
        <div className="flex flex-col gap-gb-md">
          <h1 className="font-display text-gb-display-md font-semibold tracking-gb-display-tight text-fg">
            {t('Applicant profile')}
          </h1>
          <p className="max-w-3xl text-gb-md leading-relaxed text-fg-tertiary">{report.summary}</p>
        </div>
        <div className="grid gap-gb-lg rounded-gb-2xl bg-surface-inverse-deep p-gb-2xl text-fg-on-inverse sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="flex flex-col gap-gb-sm">
            <div className="flex items-center justify-between gap-gb-lg text-gb-sm">
              <span>{t('Data confidence')}</span>
              <strong>{report.confidence}%</strong>
            </div>
            <ProgressBar value={report.confidence} label={t('Report confidence')} />
          </div>
          <Button onClick={generate} disabled={busy} variant="secondary">
            {busy ? t('Updating…') : t('Update report')}
          </Button>
        </div>
        {generatedAt ? (
          <p className="text-gb-xs text-fg-muted">
            {t('Last generated')}: {new Date(generatedAt).toLocaleString('vi-VN')}
          </p>
        ) : null}
        {nextAt ? (
          <p className="text-gb-xs text-fg-muted">
            {t('Next free generation')}: {new Date(nextAt).toLocaleString('vi-VN')}
          </p>
        ) : null}
        {error ? <p className="text-gb-sm text-fg-error">{error}</p> : null}
      </header>

      {report.limitations.length > 0 ? (
        <Panel className="flex flex-col gap-gb-md">
          <h2 className="text-gb-md font-semibold text-fg">{t('Limits to know')}</h2>
          <ul className="flex list-disc flex-col gap-gb-sm pl-gb-xl text-gb-sm text-fg-tertiary">
            {report.limitations.map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <div
        role="tablist"
        aria-label={t('Applicant profile sections')}
        className="flex gap-gb-sm overflow-x-auto border-b border-line pb-gb-sm"
      >
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`shrink-0 rounded-gb-full px-gb-lg py-gb-sm text-gb-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
              activeTab === tab.key
                ? 'bg-brand text-fg-on-inverse'
                : 'bg-surface-muted text-fg-tertiary hover:text-fg'
            }`}
          >
            {t(tab.label)}
          </button>
        ))}
      </div>

      <section role="tabpanel" className="flex flex-col gap-gb-lg">
        {activeTab === 'emergingThemes' ? (
          report.emergingThemes.length > 0 ? (
            report.emergingThemes.map((theme) => (
              <div key={`${theme.theme}-${theme.headline}`} className="flex flex-col gap-gb-sm">
                <h2 className="text-gb-lg font-semibold text-fg-brand">{theme.theme}</h2>
                <NarrativeCard section={theme} />
              </div>
            ))
          ) : (
            <Panel>
              <p className="text-gb-sm text-fg-tertiary">
                {t('There is not enough data to identify a recurring theme.')}
              </p>
            </Panel>
          )
        ) : null}

        {activeTab === 'proofOfMe'
          ? report.proofOfMe.map((proof) => (
              <Panel key={`${proof.title}-${proof.evidenceRefs[0]?.id}`} className="flex flex-col gap-gb-lg">
                <div className="flex flex-wrap items-center justify-between gap-gb-md">
                  <div>
                    <h2 className="text-gb-lg font-semibold text-fg">{proof.title}</h2>
                    {proof.role ? <p className="text-gb-sm text-fg-muted">{proof.role}</p> : null}
                  </div>
                  <Badge variant={proof.evidenceStrength === 'strong' ? 'safe-chip' : 'neutral-chip'}>
                    {t('Evidence')}: {proof.evidenceStrength}
                  </Badge>
                </div>
                <p className="text-gb-sm text-fg-tertiary">{proof.contribution}</p>
                {proof.outcome ? <p className="text-gb-sm font-medium text-fg">{proof.outcome}</p> : null}
                <div className="flex flex-wrap gap-gb-sm">
                  {proof.competencies.map((competency) => (
                    <Badge key={competency} variant="brand-chip">
                      {competency}
                    </Badge>
                  ))}
                </div>
              </Panel>
            ))
          : null}

        {activeTab !== 'emergingThemes' && activeTab !== 'proofOfMe' ? (
          <NarrativeCard section={narrativeSections[activeTab]} />
        ) : null}
      </section>

      <div className="flex flex-wrap justify-between gap-gb-lg border-t border-line pt-gb-2xl">
        <Button href="/ai-strategy/reflection" variant="secondary">
          {t('Update Reflection')}
        </Button>
        <Button href="/ai-strategy/matching">{t('Continue to Matching Report')}</Button>
      </div>
    </div>
  );
}
