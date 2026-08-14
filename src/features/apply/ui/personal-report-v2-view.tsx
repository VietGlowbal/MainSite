'use client';

import { useState } from 'react';
import { useT } from '@/lib/i18n';
import type { PersonalReportTrigger, PersonalReportV2, PersonalReportVersionSummary } from '../domain';
import { Badge, Button } from '@/shared/ui';
import { useLoadingIndicator } from '@/shared/ui/loading-overlay';
import {
  ConfidenceBadge,
  CoreIdentityView,
  DrivingForceView,
  EmergingThemesView,
  PersonalPositioningView,
  ProfileAtAGlanceView,
  ProofOfMeView,
  SignaturePatternView,
  VersionHistoryPicker,
  withReturn,
} from './personal-report';

/**
 * The canonical Personal Report — report-like, not a dashboard. Renders
 * `PersonalReportV2` (`src/features/apply/domain/personal-report.ts`),
 * which is itself a rendering of the Shared Evaluation Engine's
 * `ProfileEvaluation` — every claim shown here traces back to that
 * structured object. Each section lives in its own file under
 * `./personal-report/` (implementation spec §33); this file is the shell
 * that owns report state (current version, version history, generation)
 * and lays the sections out top to bottom.
 *
 * ─── WHY ONE LONG PAGE, NOT SIX TABS ─────────────────────────────────────────
 *
 * The v1 view (`personal-report-view.tsx`, now superseded) used a tab strip.
 * The rebuild spec asks for something "report-like, generous white space,
 * not dashboard-heavy" — a report is read top to bottom, not clicked through
 * section by section, and a PDF export (structural groundwork only, not
 * built yet) reads naturally from a single scroll rather than six hidden
 * panels. Each section is its own `<section>` with its own heading, so a
 * long page still has real in-page structure for a screen reader.
 *
 * ─── ONE CONFIDENCE NUMBER, LABELLED HONESTLY ────────────────────────────────
 *
 * `overallEvidenceConfidence` is exactly `ProfileEvaluation.confidence` — the
 * engine's own floor, not an average and not a new metric. It is shown once,
 * in the header, labelled "Overall evidence confidence" — never an
 * admissions-probability number.
 *
 * ─── ANALYTICS ARE OPTIONAL, NEVER A CRASH ───────────────────────────────────
 *
 * `report.analytics` / `report.overview` / `report.overallSummary` are all
 * optional on `PersonalReportV2` — a version generated before this redesign
 * shipped has none of them. Every place below that reads them is written to
 * render nothing extra rather than throw when they're absent, so an old
 * version in the history dropdown still opens cleanly.
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
  /** The id of `initialReport`'s own version row, when a report exists. */
  initialVersionId: string | null;
  /** Every past version's id/date/trigger, newest first — powers the version-history dropdown. */
  initialVersions: PersonalReportVersionSummary[];
  studentName: string;
  generatedAt: string | null;
  migrationMissing: boolean;
  /**
   * This application's own `?return=` path, when the report was opened from
   * one — verified server-side by the page, never trusted from the URL
   * directly. See the file-level comment on `PersonalReportPage`. Threaded
   * into every link below that should carry the student back to where they
   * came from, but never stored as part of the report itself.
   */
  returnTo?: string | undefined;
  /** This application's own Matching Report, when known; the generic chooser otherwise. */
  matchingReportHref?: string | undefined;
}) {
  const t = useT();
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
  useLoadingIndicator(busy, report ? t('Updating your Personal Report') : t('Creating your Personal Report'));

  const isHistorical = Boolean(selectedVersionId && latestVersionId && selectedVersionId !== latestVersionId);

  async function refreshVersions() {
    try {
      const response = await fetch('/api/ai-strategy/personal-report/versions');
      const body = await response.json().catch(() => ({}));
      if (response.ok && Array.isArray(body.versions)) setVersions(body.versions as PersonalReportVersionSummary[]);
    } catch {
      // Best-effort — the dropdown just won't show the newest entry until the next load.
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
      // Assigned together (spec §24) — a partial swap could pair a new
      // report body with the previous version's id/date.
      if (body.reportV2) setReport(body.reportV2 as PersonalReportV2);
      if (body.versionId) {
        setSelectedVersionId(body.versionId as string);
        setLatestVersionId(body.versionId as string);
      }
      if (body.generatedAt) setViewedGeneratedAt(body.generatedAt as string);
      if (!response.ok) throw new Error(body.error || t('Could not create the report.'));
      void refreshVersions();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t('Could not create the report.'));
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
      // Same atomic swap as `generate` above — report, id, and date all move
      // together so the header date can never point at a different
      // version's content mid-render.
      setReport(body.reportV2 as PersonalReportV2);
      setSelectedVersionId(versionId);
      setViewedGeneratedAt(body.generatedAt as string);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t('Could not load that version.'));
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
            {t('GlowBal reads your reflection, achievements, and activities to find evidence-backed patterns. Missing data is called out rather than filled in by AI.')}
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

  const onAnswered = isHistorical ? undefined : () => void generate('supplement_answer');

  return (
    <div className="flex flex-col gap-gb-3xl">
      <header className="flex flex-col gap-gb-lg">
        <Badge variant="brand-subtle">{t('Personal Report')}</Badge>
        <div className="flex flex-wrap items-end justify-between gap-gb-lg">
          <div className="flex flex-col gap-gb-xs">
            <h1 className="font-display text-gb-display-md font-semibold tracking-gb-display-tight text-fg" data-no-auto-translate>
              {studentName}
            </h1>
            {viewedGeneratedAt ? (
              <p className="text-gb-xs text-fg-muted">
                {t('Generated')}: {new Date(viewedGeneratedAt).toLocaleDateString('en-US')}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-gb-md">
            <span className="text-gb-sm text-fg-tertiary">{t('Overall evidence confidence')}:</span>
            <ConfidenceBadge confidence={report.overallEvidenceConfidence} />
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-gb-lg border-t border-line pt-gb-lg print:hidden">
          <Button href={withReturn('/ai-strategy/reflection', returnTo)} variant="secondary" size="sm">
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
            <Button size="sm" variant="secondary" onClick={backToLatest} disabled={versionLoading}>
              {t('Back to latest')}
            </Button>
          </div>
        ) : null}
        {error ? <p className="text-gb-sm text-fg-error">{error}</p> : null}
      </header>

      <ProfileAtAGlanceView overview={report.overview} analytics={report.analytics} />
      <CoreIdentityView section={report.coreIdentity} returnTo={returnTo} />
      <DrivingForceView section={report.drivingForce} returnTo={returnTo} onAnswered={onAnswered} />
      <SignaturePatternView
        section={report.signaturePattern}
        patternSupport={report.analytics?.signaturePatternSupport}
        returnTo={returnTo}
      />
      <EmergingThemesView
        section={report.emergingThemes}
        themeMaturity={report.analytics?.themeMaturity}
        returnTo={returnTo}
      />
      <PersonalPositioningView
        section={report.personalPositioning}
        positioningDimensions={report.analytics?.positioningDimensions}
        returnTo={returnTo}
      />
      <ProofOfMeView
        section={report.proofOfMe}
        evidenceSummary={report.analytics?.evidenceSummary}
        overallSummary={report.overallSummary}
        returnTo={returnTo}
      />

      <div className="flex flex-wrap justify-between gap-gb-lg border-t border-line pt-gb-2xl print:hidden">
        <Button href={withReturn('/ai-strategy/reflection', returnTo)} variant="secondary">
          {t('View confirmed information')}
        </Button>
        <Button href={matchingReportHref ?? '/ai-strategy/matching'}>{t('Continue to Matching Report')}</Button>
      </div>
    </div>
  );
}
