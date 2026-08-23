'use client';

import { useState } from 'react';
import { useLanguage } from '@/lib/i18n';
import { formatUiDate } from '@/shared/lib';
import type {
  PersonalReportTrigger,
  PersonalReportV2,
  PersonalReportVersionSummary,
} from '../domain';
import { Badge, Button } from '@/shared/ui';
import { useLoadingIndicator } from '@/shared/ui/loading-overlay';
import {
  ApplicantSnapshotView,
  ConfidenceBadge,
  KeyTakeawaysView,
  PersonalCanvasWorkspace,
  PersonalReportPrintView,
  VersionHistoryPicker,
  withReturn,
} from './personal-report';

/**
 * Canonical user-level Personal Report.
 *
 * The evaluation engine, report snapshots and version history remain unchanged.
 * The six report chapters are explored through the interactive Personal Canvas
 * on screen. A linear, complete six-chapter fallback is rendered only for
 * print/PDF media so export never depends on which Canvas panel is open.
 */
export function PersonalReportV2View({
  initialReport,
  initialVersionId,
  initialVersions,
  studentName,
  generatedAt,
  migrationMissing,
  returnTo,
  matchingReportHref,
}: {
  initialReport: PersonalReportV2 | null;
  initialVersionId: string | null;
  initialVersions: PersonalReportVersionSummary[];
  studentName: string;
  generatedAt: string | null;
  migrationMissing: boolean;
  returnTo?: string | undefined;
  matchingReportHref?: string | undefined;
}) {
  const { t, lang } = useLanguage();
  const [report, setReport] = useState(initialReport);
  const [versions, setVersions] = useState(initialVersions);
  const [selectedVersionId, setSelectedVersionId] = useState(initialVersionId);
  const [latestVersionId, setLatestVersionId] = useState(initialVersionId);
  const [viewedGeneratedAt, setViewedGeneratedAt] = useState(generatedAt);
  const [busy, setBusy] = useState(false);
  const [versionLoading, setVersionLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    migrationMissing ? t('This feature is not enabled in the database.') : null,
  );

  useLoadingIndicator(
    busy,
    report ? t('Updating your Personal Report') : t('Creating your Personal Report'),
  );

  const isHistorical = Boolean(
    selectedVersionId && latestVersionId && selectedVersionId !== latestVersionId,
  );

  async function refreshVersions() {
    try {
      const response = await fetch('/api/ai-strategy/personal-report/versions');
      const body = await response.json().catch(() => ({}));
      if (response.ok && Array.isArray(body.versions)) {
        setVersions(body.versions as PersonalReportVersionSummary[]);
      }
    } catch {
      // Best-effort — the picker will refresh on the next page load.
    }
  }

  async function generate(trigger: PersonalReportTrigger = 'manual') {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch('/api/ai-strategy/personal-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger }),
      });
      const body = await response.json().catch(() => ({}));

      if (body.reportV2) setReport(body.reportV2 as PersonalReportV2);
      if (body.versionId) {
        setSelectedVersionId(body.versionId as string);
        setLatestVersionId(body.versionId as string);
      }
      if (body.generatedAt) setViewedGeneratedAt(body.generatedAt as string);

      if (!response.ok) throw new Error(body.error || t('Could not create the report.'));
      void refreshVersions();
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : t('Could not create the report.'),
      );
    } finally {
      setBusy(false);
    }
  }

  async function viewVersion(versionId: string) {
    if (versionId === selectedVersionId) return;

    setVersionLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/ai-strategy/personal-report/versions/${versionId}`);
      const body = await response.json().catch(() => ({}));

      if (!response.ok) throw new Error(body.error || t('Could not load that version.'));
      setReport(body.reportV2 as PersonalReportV2);
      setSelectedVersionId(versionId);
      setViewedGeneratedAt(body.generatedAt as string);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : t('Could not load that version.'),
      );
    } finally {
      setVersionLoading(false);
    }
  }

  function backToLatest() {
    if (latestVersionId) void viewVersion(latestVersionId);
  }

  if (!report) {
    return (
      <div className="flex min-h-[32rem] flex-col items-center justify-center gap-gb-2xl text-center">
        <Badge variant="brand-subtle">{t('Personal Report')}</Badge>
        <div className="flex max-w-2xl flex-col gap-gb-md">
          <h1 className="font-display text-gb-display-md font-semibold tracking-gb-display-tight text-fg">
            {t('Who is this applicant?')}
          </h1>
          <p className="text-gb-md text-fg-tertiary">
            {t(
              'GlowBal reads your reflection, achievements, and activities to find evidence-backed patterns. Missing data is called out rather than filled in by AI.',
            )}
          </p>
        </div>
        {error ? <p className="max-w-xl text-gb-sm text-fg-error">{error}</p> : null}
        <Button size="lg" onClick={() => void generate()} disabled={busy || migrationMissing}>
          {busy ? t('Creating report…') : t('Create report')}
        </Button>
        <Button href={withReturn('/ai-strategy/reflection', returnTo)} variant="secondary">
          {t('Review Reflection')}
        </Button>
      </div>
    );
  }

  const onRegenerate = isHistorical
    ? undefined
    : (trigger: PersonalReportTrigger) => {
        void generate(trigger);
      };

  return (
    <div className="flex flex-col gap-gb-3xl">
      <header className="flex flex-col gap-gb-lg">
        <div className="flex flex-wrap items-center gap-gb-sm">
          <Badge variant="brand-subtle">{t('Personal Report')}</Badge>
          <span className="text-gb-xs text-fg-muted">Personal Canvas</span>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-gb-lg">
          <div className="flex flex-col gap-gb-xs">
            <h1
              className="font-display text-gb-display-md font-semibold tracking-gb-display-tight text-fg"
              data-no-auto-translate
            >
              {studentName}
            </h1>
            <p className="max-w-2xl text-gb-sm text-fg-tertiary">
              A profile of who you are as an applicant — built from your reflected experiences,
              evidence and recurring patterns.
            </p>
            {viewedGeneratedAt ? (
              <p className="text-gb-xs text-fg-muted">
                {t('Generated')}: {formatUiDate(viewedGeneratedAt, lang)}
              </p>
            ) : null}
          </div>

          <div className="flex items-center gap-gb-md rounded-gb-xl bg-surface-muted px-gb-lg py-gb-md">
            <span className="text-gb-sm text-fg-tertiary">
              {t('Overall evidence confidence')}:
            </span>
            <ConfidenceBadge confidence={report.overallEvidenceConfidence} />
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-gb-lg border-t border-line pt-gb-lg print:hidden">
          <Button
            href={withReturn('/ai-strategy/reflection', returnTo)}
            variant="secondary"
            size="sm"
          >
            {t('View confirmed information')}
          </Button>
          <VersionHistoryPicker
            versions={versions}
            selectedVersionId={selectedVersionId}
            latestVersionId={latestVersionId}
            disabled={versionLoading || busy}
            onSelect={(versionId) => void viewVersion(versionId)}
          />
        </div>

        {isHistorical ? (
          <div className="flex flex-wrap items-center justify-between gap-gb-md rounded-gb-xl bg-surface-muted p-gb-lg print:hidden">
            <p className="text-gb-sm text-fg-tertiary">
              {t("You're viewing an older version of this report — it won't update or accept answers.")}
            </p>
            <Button
              size="sm"
              variant="secondary"
              onClick={backToLatest}
              disabled={versionLoading}
            >
              {t('Back to latest')}
            </Button>
          </div>
        ) : null}

        {error ? <p className="text-gb-sm text-fg-error">{error}</p> : null}
      </header>

      <ApplicantSnapshotView report={report} />

      <div className="print:hidden">
        <PersonalCanvasWorkspace
          report={report}
          returnTo={returnTo}
          onRegenerate={onRegenerate}
        />
      </div>

      <PersonalReportPrintView report={report} returnTo={returnTo} />

      <KeyTakeawaysView report={report} />

      {report.overallSummary && report.overallSummary.paragraphs.length > 0 ? (
        <section
          className="flex flex-col gap-gb-md rounded-gb-xl bg-surface-muted p-gb-xl"
          data-no-auto-translate
        >
          <p className="text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">
            What this report suggests overall
          </p>
          {report.overallSummary.paragraphs.map((paragraph) => (
            <p key={paragraph} className="text-gb-sm leading-relaxed text-fg-tertiary">
              {paragraph}
            </p>
          ))}
        </section>
      ) : null}

      <div className="flex flex-wrap justify-between gap-gb-lg border-t border-line pt-gb-2xl print:hidden">
        <Button href={withReturn('/ai-strategy/reflection', returnTo)} variant="secondary">
          {t('View confirmed information')}
        </Button>
        <Button href={matchingReportHref ?? '/ai-strategy/matching'}>
          {t('Continue to Matching Report')}
        </Button>
      </div>
    </div>
  );
}
