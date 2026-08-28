'use client';

import { useEffect, useState } from 'react';
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
  applicationId,
  applicationConfirmed,
  stale,
  studentName,
  generatedAt,
  migrationMissing,
  returnTo,
  matchingReportHref,
}: {
  initialReport: PersonalReportV2 | null;
  initialVersionId: string | null;
  initialVersions: PersonalReportVersionSummary[];
  applicationId?: string | undefined;
  applicationConfirmed?: boolean | undefined;
  stale?: boolean | undefined;
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
  const [waitingForGeneration, setWaitingForGeneration] = useState(false);
  const [versionLoading, setVersionLoading] = useState(false);
  const reportEndpoint = applicationId
    ? `/api/applications/${applicationId}/personal-report`
    : '/api/ai-strategy/personal-report';
  const versionsEndpoint = applicationId
    ? `${reportEndpoint}/versions`
    : '/api/ai-strategy/personal-report/versions';
  const [error, setError] = useState<string | null>(
    migrationMissing
      ? t('This feature is not enabled in the database.')
      : applicationConfirmed === false
        ? t('Confirm Candidate Information before generating this report.')
        : stale
          ? t('This report is based on an older confirmed snapshot. Generate the latest version to update it.')
          : null,
  );

  useLoadingIndicator(
    busy || waitingForGeneration,
    report ? t('Updating your Personal Report') : t('Creating your Personal Report'),
  );

  const isHistorical = Boolean(
    selectedVersionId && latestVersionId && selectedVersionId !== latestVersionId,
  );

  async function refreshVersions() {
    try {
      const response = await fetch(versionsEndpoint);
      const body = await response.json().catch(() => ({}));
      if (response.ok && Array.isArray(body.versions)) {
        setVersions(body.versions as PersonalReportVersionSummary[]);
      }
    } catch {
      // Best-effort — the picker will refresh on the next page load.
    }
  }

  async function generate(trigger: PersonalReportTrigger = 'manual', force = false) {
    if (applicationId && applicationConfirmed === false) {
      setError(t('Confirm Candidate Information before generating this report.'));
      return;
    }
    setBusy(true);
    setError(null);

    let queued = false;
    try {
      const response = await fetch(reportEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trigger,
          ...(force
            ? {
                force: true,
                idempotencyKey:
                  globalThis.crypto?.randomUUID?.() ??
                  `report-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              }
            : {}),
        }),
      });
      const body = await response.json().catch(() => ({}));

      if (response.status === 202 && body.queued) {
        queued = true;
        setWaitingForGeneration(true);
        return;
      }

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
      if (!queued) setBusy(false);
    }
  }

  useEffect(() => {
    if (!waitingForGeneration) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const response = await fetch(reportEndpoint);
        const body = await response.json().catch(() => ({}));
        if (cancelled || !response.ok) return;
        if (body.generation?.status === 'blocked') {
          setError(t('Could not create the report.'));
          setWaitingForGeneration(false);
          setBusy(false);
          return;
        }
        const generationActive = ['pending', 'processing', 'retry'].includes(body.generation?.status);
        const reportIsFresh = Boolean(
          body.reportV2 &&
            (!body.generation ||
              (body.generation.status === 'complete' && body.generation.report_version_id === body.versionId)),
        );
        if (reportIsFresh && !generationActive) {
          setReport(body.reportV2 as PersonalReportV2);
          setSelectedVersionId(body.versionId as string | null);
          setLatestVersionId(body.versionId as string | null);
          setViewedGeneratedAt(body.generatedAt as string | null);
          setWaitingForGeneration(false);
          setBusy(false);
          return;
        }
        if (body.generation?.status === 'blocked') {
          setError(body.generation.error_message || t('Could not create the report.'));
          setWaitingForGeneration(false);
          setBusy(false);
        }
      } catch {
        // Keep the existing animation running; the durable job will retry.
      }
    };
    void poll();
    const interval = window.setInterval(() => void poll(), 2_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [reportEndpoint, t, waitingForGeneration]);

  async function viewVersion(versionId: string) {
    if (versionId === selectedVersionId) return;

    setVersionLoading(true);
    setError(null);

    try {
      const response = await fetch(`${versionsEndpoint}/${versionId}`);
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
        <Button
          size="lg"
          onClick={() => void generate('manual', true)}
          disabled={
            busy ||
            migrationMissing ||
            !applicationId ||
            applicationConfirmed === false
          }
        >
          {busy ? t('Creating report…') : t('Create report')}
        </Button>
        <Button href={withReturn('/ai-strategy/reflection', returnTo)} variant="secondary">
          {t('Review Reflection')}
        </Button>
      </div>
    );
  }

  const onRegenerate = !applicationId || isHistorical || applicationConfirmed === false
    ? undefined
    : (trigger: PersonalReportTrigger) => {
        void generate(trigger, true);
      };

  return (
    <div className="flex flex-col gap-gb-3xl" data-report-auto-translate>
      <header className="flex flex-col gap-gb-xl">
        <div className="flex items-center gap-gb-xs">
          <Badge variant="brand-subtle">{t('Personal Report')}</Badge>
          <span className="text-gb-xs text-fg-muted">/</span>
          <span className="text-gb-xs font-medium text-fg-tertiary">Personal Canvas</span>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-gb-xl">
          <div className="flex max-w-2xl flex-col gap-gb-xs">
            <h1
              className="font-display text-gb-display-md font-semibold tracking-gb-display-tight text-fg"
              data-no-auto-translate
            >
              {studentName}
            </h1>
            <p className="text-gb-sm leading-relaxed text-fg-tertiary">
              A profile of who you are as an applicant — built from your reflected experiences,
              evidence and recurring patterns.
            </p>
            {viewedGeneratedAt ? (
              <p className="mt-gb-xxs text-gb-xs text-fg-muted">
                {t('Generated')}: {formatUiDate(viewedGeneratedAt, lang)}
              </p>
            ) : null}
          </div>

          <div className="flex items-center gap-gb-sm rounded-gb-xl border border-line bg-surface-muted/60 px-gb-lg py-gb-sm">
            <span className="text-gb-xs font-medium text-fg-muted">
              {t('Overall evidence confidence')}:
            </span>
            <ConfidenceBadge confidence={report.overallEvidenceConfidence} />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-gb-md border-t border-line/70 pt-gb-md print:hidden">
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
          applicationId={applicationId}
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
