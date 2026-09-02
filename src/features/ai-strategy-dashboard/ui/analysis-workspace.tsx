'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, ICONS, KitIcon, Panel, ProgressBar, usePrefersReducedMotion } from '@/shared/ui';
import { APPLICATION_REPORT_GENERATION_LIMIT } from '@/features/apply/domain';
import { useLanguage } from '@/lib/i18n';
import { formatUiDateTime } from '@/shared/lib';

type ReportStatus = 'waiting' | 'generating' | 'complete' | 'failed';
type ReportState = { status: ReportStatus; error?: string | undefined };
type ReportQuota = { count: number; limit: number };
type ReportErrorMessages = {
  generic: string;
  rateLimit: string;
  unavailable: string;
  limit: string;
};

const PERSONAL_REPORT_POLL_MS = 2_000;
const PERSONAL_REPORT_MAX_POLLS = 150;
const MATCHING_GENERATION_ATTEMPTS = 1;
const STRATEGY_GENERATION_ATTEMPTS = 1;

function waitForNextPersonalReportPoll() {
  return new Promise<void>((resolve) => window.setTimeout(resolve, PERSONAL_REPORT_POLL_MS));
}

function reportQuotaFromBody(body: unknown): ReportQuota | null {
  if (!body || typeof body !== 'object') return null;
  const value = body as { reportCount?: unknown; reportLimit?: unknown };
  return typeof value.reportCount === 'number' && typeof value.reportLimit === 'number'
    ? { count: Math.max(0, value.reportCount), limit: Math.max(1, value.reportLimit) }
    : null;
}

async function waitForPersonalReport(
  applicationId: string,
  errorMessages: ReportErrorMessages,
  options: { force: boolean; previousVersionId: string | null; onQuota: (quota: ReportQuota) => void },
): Promise<ReportState> {
  for (let poll = 0; poll < PERSONAL_REPORT_MAX_POLLS; poll += 1) {
    try {
      const response = await fetch(`/api/applications/${applicationId}/personal-report`);
      const body = await response.json().catch(() => ({}));
      const quota = reportQuotaFromBody(body);
      if (quota) options.onQuota(quota);

      if (response.ok) {
        const generationStatus = body.generation?.status ?? null;
        // A report can be saved by a direct/manual generation while an older
        // queue row is still active. The current snapshot is authoritative;
        // do not hold Matching behind that stale row.
        if (body.reportV2 && body.stale !== true) {
          if (!options.force || body.versionId !== options.previousVersionId) return { status: 'complete' };
        }
        if (generationStatus === 'blocked') {
          return {
            status: 'failed',
            error:
              body.generation?.error_code === 'REPORT_LIMIT_REACHED'
                ? errorMessages.limit
                : errorMessages.generic,
          };
        }
      } else if (response.status !== 503) {
        if (response.status === 429) return { status: 'failed', error: errorMessages.rateLimit };
        return { status: 'failed', error: body.error || errorMessages.generic };
      }
    } catch {
      // Keep polling; the durable worker owns generation and will retry.
    }
    await waitForNextPersonalReportPoll();
  }

  return { status: 'failed', error: errorMessages.unavailable };
}

/**
 * Generate the current application's Personal Report.
 */
async function fetchOrGeneratePersonal(
  applicationId: string,
  errorMessages: ReportErrorMessages,
  force: boolean,
  onQuota: (quota: ReportQuota) => void,
): Promise<ReportState> {
  let previousVersionId: string | null = null;
  try {
    try {
      const existing = await fetch(`/api/applications/${applicationId}/personal-report`);
      const existingBody = await existing.json().catch(() => ({}));
      const quota = reportQuotaFromBody(existingBody);
      if (quota) onQuota(quota);
      previousVersionId = typeof existingBody.versionId === 'string' ? existingBody.versionId : null;
      if (!force && existing.ok && existingBody.reportV2 && existingBody.stale !== true) {
        return { status: 'complete' };
      }
      if (!existing.ok && existing.status !== 503) {
        return {
          status: 'failed',
          error:
            existing.status === 429
              ? errorMessages.rateLimit
              : existingBody.error || errorMessages.generic,
        };
      }
    } catch {
      // Continue to the idempotent POST when the read itself is unavailable.
    }

    const canonical = await fetch(`/api/applications/${applicationId}/personal-report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(force ? { trigger: 'manual', force: true } : {}),
    });
      const canonicalBody = await canonical.json().catch(() => ({}));
      const quota = reportQuotaFromBody(canonicalBody);
      if (quota) onQuota(quota);
      if (canonical.status === 202 && canonicalBody.queued) {
        return waitForPersonalReport(applicationId, errorMessages, {
          force,
          previousVersionId,
          onQuota,
        });
      }
      if (!canonical.ok || !canonicalBody.reportV2) {
      if (canonical.status === 429) {
        return { status: 'failed', error: errorMessages.rateLimit };
      }
      if (canonical.status === 503) {
        return { status: 'failed', error: errorMessages.unavailable };
      }
      if (canonicalBody.code === 'REPORT_LIMIT_REACHED') {
        return { status: 'failed', error: errorMessages.limit };
      }
      return { status: 'failed', error: canonicalBody.error || errorMessages.generic };
    }

    return { status: 'complete' };
  } catch {
    return { status: 'failed', error: errorMessages.generic };
  }
}

async function fetchOrGenerateMatching(
  applicationId: string,
  errorMessages: ReportErrorMessages,
  force: boolean,
): Promise<ReportState> {
  let lastFailure: ReportState = { status: 'failed', error: errorMessages.generic };

  for (let attempt = 0; attempt < MATCHING_GENERATION_ATTEMPTS; attempt += 1) {
    try {
      const existing = await fetch(`/api/applications/${applicationId}/strategy/course-match`);
      const existingBody = await existing.json().catch(() => ({}));
      if (!force && existingBody.analysis) return { status: 'complete' };

      const created = await fetch(
        `/api/applications/${applicationId}/match-insights`,
        force
          ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ force: true }) }
          : { method: 'POST' },
      );
      const createdBody = await created.json().catch(() => ({}));
      if (!created.ok || createdBody.error) {
        lastFailure = {
          status: 'failed',
          error:
            created.status === 429
              ? errorMessages.rateLimit
              : created.status === 503
                ? errorMessages.unavailable
                : createdBody.error || errorMessages.generic,
        };
        continue;
      }
      return { status: 'complete' };
    } catch {
      // Retry the complete read/create cycle immediately for transient failures.
    }
  }

  return lastFailure;
}

async function fetchOrGenerateStrategy(
  applicationId: string,
  errorMessages: ReportErrorMessages,
  force: boolean,
): Promise<ReportState> {
  let lastFailure: ReportState = { status: 'failed', error: errorMessages.generic };

  for (let attempt = 0; attempt < STRATEGY_GENERATION_ATTEMPTS; attempt += 1) {
    try {
      const existing = await fetch(`/api/applications/${applicationId}/strategy/recommendation`);
      const existingBody = await existing.json().catch(() => ({}));
      // This flow generates V3. Legacy rows are only a read fallback and must
      // not make a failed/missing V3 generation look complete.
      if (!force && existing.ok && existingBody.reportV3) {
        return { status: 'complete' };
      }

      const created = await fetch(
        `/api/applications/${applicationId}/strategy/recommendation`,
        force
          ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ force: true }) }
          : { method: 'POST' },
      );
      const createdBody = await created.json().catch(() => ({}));
      if (!created.ok || (!createdBody.reportV3 && !createdBody.reportV2 && !createdBody.recommendation)) {
        lastFailure = {
          status: 'failed',
          error:
            created.status === 429
              ? errorMessages.rateLimit
              : created.status === 503
                ? errorMessages.unavailable
                : createdBody.error || errorMessages.generic,
        };
        continue;
      }
      return { status: 'complete' };
    } catch {
      // Retry the complete read/create cycle immediately for transient failures.
    }
  }

  return lastFailure;
}

export function AnalysisWorkspace({
  applicationId,
  confirmedAt,
  matchingSubtitle,
  regenerateOnLoad = false,
}: {
  applicationId: string;
  confirmedAt?: string | null | undefined;
  matchingSubtitle?: string | undefined;
  regenerateOnLoad?: boolean;
}) {
  const { t, lang } = useLanguage();
  const [personal, setPersonal] = useState<ReportState>({ status: 'generating' });
  const [matching, setMatching] = useState<ReportState>({ status: 'generating' });
  const [strategy, setStrategy] = useState<ReportState>({ status: 'waiting' });
  const [quota, setQuota] = useState<ReportQuota>({ count: 0, limit: APPLICATION_REPORT_GENERATION_LIMIT });
  const [regenerating, setRegenerating] = useState(false);
  const regenerationInFlightRef = useRef(false);
  const startedApplicationRef = useRef<string | null>(null);

  const personalHref = `/ai-strategy/personal-report?return=${encodeURIComponent(`/ai-strategy/${applicationId}/strategy/analysis`)}`;
  const matchingHref = `/ai-strategy/${applicationId}/matching-report`;
  const errorMessages = useMemo(
    () => ({
      generic: t('Something went wrong. Please try again.'),
      rateLimit: t('Rate limit reached. Please wait a moment and try again.'),
      unavailable: t('Service temporarily unavailable. Please try again shortly.'),
      limit: t('You have reached the maximum number of report generations.'),
    }),
    [t],
  );

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (!regenerateOnLoad) return;
    const url = new URL(window.location.href);
    url.searchParams.delete('regenerate');
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }, [regenerateOnLoad]);

  useEffect(() => {
    if (startedApplicationRef.current === applicationId) return;
    startedApplicationRef.current = applicationId;
    let active = true;
    async function loadReports() {
      const personalState = await fetchOrGeneratePersonal(
        applicationId,
        errorMessages,
        regenerateOnLoad,
        setQuota,
      );
      if (!active) return;
      setPersonal(personalState);
      if (personalState.status !== 'complete') {
        setMatching({
          status: 'failed',
          error: personalState.status === 'failed' ? personalState.error : errorMessages.generic,
        });
        return;
      }
      const matchingState = await fetchOrGenerateMatching(applicationId, errorMessages, regenerateOnLoad);
      if (!active) return;
      setMatching(matchingState);
      if (matchingState.status !== 'complete') return;
      setStrategy({ status: 'generating' });
      const strategyState = await fetchOrGenerateStrategy(applicationId, errorMessages, regenerateOnLoad);
      if (active) setStrategy(strategyState);
    }
    void loadReports();
    return () => {
      active = false;
    };
  }, [applicationId, errorMessages, regenerateOnLoad]);

  const retryPersonal = useCallback(async () => {
    setPersonal({ status: 'generating' });
    setMatching({ status: 'generating' });
    setStrategy({ status: 'waiting' });
    const personalState = await fetchOrGeneratePersonal(applicationId, errorMessages, false, setQuota);
    setPersonal(personalState);
    if (personalState.status !== 'complete') {
      setMatching({
        status: 'failed',
        error: personalState.status === 'failed' ? personalState.error : errorMessages.generic,
      });
      return;
    }
    const matchingState = await fetchOrGenerateMatching(applicationId, errorMessages, false);
    setMatching(matchingState);
    if (matchingState.status !== 'complete') return;
    setStrategy({ status: 'generating' });
    setStrategy(await fetchOrGenerateStrategy(applicationId, errorMessages, false));
  }, [applicationId, errorMessages]);

  const retryMatching = useCallback(() => {
    if (personal.status !== 'complete') {
      void retryPersonal();
      return;
    }
    setMatching({ status: 'generating' });
    setStrategy({ status: 'waiting' });
    void fetchOrGenerateMatching(applicationId, errorMessages, false).then(async (matchingState) => {
      setMatching(matchingState);
      if (matchingState.status !== 'complete') return;
      setStrategy({ status: 'generating' });
      setStrategy(await fetchOrGenerateStrategy(applicationId, errorMessages, false));
    });
  }, [applicationId, errorMessages, personal.status, retryPersonal]);

  const retryStrategy = useCallback(() => {
    if (personal.status !== 'complete' || matching.status !== 'complete') {
      void retryMatching();
      return;
    }
    setStrategy({ status: 'generating' });
    void fetchOrGenerateStrategy(applicationId, errorMessages, false).then(setStrategy);
  }, [applicationId, errorMessages, matching.status, personal.status, retryMatching]);

  const regenerateReports = useCallback(async () => {
    if (regenerationInFlightRef.current || quota.count >= quota.limit) return;
    regenerationInFlightRef.current = true;
    setRegenerating(true);
    setPersonal({ status: 'generating' });
    setMatching({ status: 'waiting' });
    setStrategy({ status: 'waiting' });
    try {
      const personalState = await fetchOrGeneratePersonal(applicationId, errorMessages, true, setQuota);
      setPersonal(personalState);
      if (personalState.status !== 'complete') {
        setMatching({ status: 'failed', error: personalState.error ?? errorMessages.generic });
        return;
      }

      setMatching({ status: 'generating' });
      const matchingState = await fetchOrGenerateMatching(applicationId, errorMessages, true);
      setMatching(matchingState);
      if (matchingState.status !== 'complete') return;

      setStrategy({ status: 'generating' });
      setStrategy(await fetchOrGenerateStrategy(applicationId, errorMessages, true));
    } finally {
      regenerationInFlightRef.current = false;
      setRegenerating(false);
    }
  }, [applicationId, errorMessages, quota.count, quota.limit]);

  const completeCount = [personal, matching, strategy].filter((report) => report.status === 'complete').length;
  const allComplete = completeCount === 3;
  const anyFailed = [personal, matching, strategy].some((report) => report.status === 'failed');
  const confirmedDate = confirmedAt
    ? formatUiDateTime(confirmedAt, lang, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;

  return (
    <div className="mx-auto flex max-w-[65rem] flex-col gap-gb-4xl px-gb-xl py-gb-6xl">
      <div className="flex flex-col items-center gap-gb-md text-center">
        <span
          aria-hidden="true"
          className="flex size-12 items-center justify-center rounded-gb-full bg-tier-safe text-on-tier-safe"
        >
          <KitIcon art={ICONS.checkCircle} frame={24} />
        </span>
        <h1 className="font-display text-gb-display-sm font-semibold tracking-gb-display-tight text-fg">
          {allComplete ? t('Your reports are ready') : t('Your information is confirmed')}
        </h1>
        <p className="max-w-gb-width-xl text-gb-md text-fg-tertiary">
          {allComplete
            ? t("We've finished analysing your profile.")
            : t("We're now creating your personalised GlowBal reports.")}
        </p>
        {confirmedDate && !allComplete ? (
          <p className="text-gb-xs text-fg-muted">{t('Confirmed {date}', { date: confirmedDate })}</p>
        ) : null}
        <p className="text-gb-xs text-fg-muted">
          {t('Reports generated: {count}/{limit}', { count: quota.count, limit: quota.limit })}
        </p>
      </div>

      {!allComplete ? (
        <div className="flex flex-col items-center gap-gb-xl sm:flex-row sm:justify-center">
          <AnalysisLoadingVideo />
          <div className="flex w-full max-w-xs flex-col items-center gap-gb-md text-center sm:items-start sm:text-left">
            <p className="text-gb-lg font-semibold text-fg">{t('Building your personalised reports')}</p>
            <p className="text-gb-sm text-fg-tertiary">
              {t('{count} of {total} reports complete', { count: completeCount, total: 3 })}
            </p>
            <ProgressBar
              value={(completeCount / 3) * 100}
              label={t('Report generation progress')}
              className="w-full"
            />
          </div>
        </div>
      ) : null}

      <div aria-live="polite" className="sr-only">
        {personal.status === 'complete' ? t('Personal Report is ready.') : ''}
        {matching.status === 'complete' ? t('Matching Report is ready.') : ''}
        {strategy.status === 'complete' ? t('Strategy Report is ready.') : ''}
      </div>

      <ul className="flex flex-col gap-gb-lg">
        <ReportRow
          title={t('Personal Report')}
          description={t('A complete overview of your profile, strengths, achievements and academic background.')}
          state={personal}
          generatingLabel={t('Generating…')}
          failedLabel={t("We couldn't finish this report. We'll retry it using your confirmed information.")}
          retryLabel={t('Try again')}
          onRetry={retryPersonal}
          viewHref={personalHref}
          viewLabel={t('Open report')}
        />
        <ReportRow
          title={t('Matching Report')}
          description={
            matchingSubtitle ?? t('Shows how strongly your profile matches your selected university and course.')
          }
          state={matching}
          generatingLabel={t('Generating…')}
          failedLabel={t("We couldn't finish this report. We'll retry it using your confirmed information.")}
          retryLabel={t('Try again')}
          onRetry={retryMatching}
          viewHref={matchingHref}
          viewLabel={t('Open report')}
        />
        <ReportRow
          title={t('Strategy Report')}
          description={t('Your Strategy Report turns these findings into a prioritised plan and a set of tasks you can work through.')}
          state={strategy}
          waitingLabel={t('Waiting for Personal and Matching Reports…')}
          generatingLabel={t('Generating…')}
          failedLabel={t("We couldn't finish this report. We'll retry it using your confirmed information.")}
          retryLabel={t('Try again')}
          onRetry={retryStrategy}
          viewHref={`/ai-strategy/${applicationId}/strategy-report`}
          viewLabel={t('Open my Strategy Report')}
        />
      </ul>

      {anyFailed ? (
        <Panel className="text-center">
          <p className="text-gb-sm font-semibold text-fg-error">{t("We're still working on your reports")}</p>
          <p className="mt-gb-xs text-gb-sm text-fg-secondary">
            {t(
              "Some of your reports couldn't be completed. Your confirmed information is safe and we'll retry them.",
            )}
          </p>
        </Panel>
      ) : null}

      {allComplete ? (
        <div className="flex flex-wrap justify-center gap-gb-md">
          <Button
            type="button"
            size="lg"
            onClick={() => void regenerateReports()}
            disabled={quota.count >= quota.limit || regenerating}
          >
            {regenerating
              ? t('Generating all reports…')
              : t('Generate all reports again')}
          </Button>
          <Button href={personalHref} size="lg">
            {t('View my reports')}
          </Button>
          <Button href={matchingHref} variant="secondary" size="lg">
            {t('Open Matching Report')}
          </Button>
          <Button href={`/ai-strategy/${applicationId}/strategy-report`} variant="secondary" size="lg">
            {t('Open my Strategy Report')}
          </Button>
          <Button href="/apply" variant="secondary" size="lg">
            {t('Go to My Portal')}
          </Button>
          {quota.count >= quota.limit ? (
            <p className="basis-full text-center text-gb-sm text-fg-muted">
              {t('You have reached the maximum number of report generations.')}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-gb-md text-center">
          <p className="text-gb-sm text-fg-tertiary">
            {t("You don't need to keep this page open — we'll keep working in the background.")}
          </p>
          <Button href="/apply" variant="secondary" size="md">
            {t('Go to My Portal')}
          </Button>
        </div>
      )}

      <p className="text-center text-gb-xs text-fg-muted">
        {t('Reports are generated from the information you confirmed.')}{' '}
        <Link
          href={`/ai-strategy/reflection?return=${encodeURIComponent(`/ai-strategy/${applicationId}/strategy/analysis`)}`}
          className="underline hover:text-fg-secondary"
        >
          {t('View confirmed information')}
        </Link>
      </p>
    </div>
  );
}

function ReportRow({
  title,
  description,
  state,
  waitingLabel,
  generatingLabel,
  failedLabel,
  retryLabel,
  onRetry,
  viewHref,
  viewLabel,
}: {
  title: string;
  description: string;
  state: ReportState;
  waitingLabel?: string;
  generatingLabel: string;
  failedLabel: string;
  retryLabel: string;
  onRetry: () => void;
  viewHref: string;
  viewLabel: string;
}) {
  return (
    <Panel as="li" className="flex items-start gap-gb-lg">
      <StatusGlyph status={state.status} />
      <div className="flex min-w-0 flex-1 flex-col gap-gb-xs">
        <p className="text-gb-md font-semibold text-fg">{title}</p>
        <p className="text-gb-sm text-fg-tertiary">{description}</p>
        {state.status === 'generating' ? (
          <p className="text-gb-sm font-medium text-fg-brand">{generatingLabel}</p>
        ) : null}
        {state.status === 'waiting' && waitingLabel ? (
          <p className="text-gb-sm text-fg-tertiary">{waitingLabel}</p>
        ) : null}
        {state.status === 'failed' ? (
          <div className="flex flex-wrap items-center gap-gb-md">
            <p className="text-gb-sm text-fg-error">{failedLabel}</p>
            <Button type="button" size="sm" variant="secondary" onClick={onRetry}>
              {retryLabel}
            </Button>
          </div>
        ) : null}
        {state.status === 'complete' ? (
          <Button href={viewHref} size="sm" variant="secondary" className="self-start">
            {viewLabel}
          </Button>
        ) : null}
      </div>
    </Panel>
  );
}

function StatusGlyph({ status }: { status: ReportStatus }) {
  if (status === 'complete') {
    return (
      <span
        aria-hidden="true"
        className="flex size-6 shrink-0 items-center justify-center rounded-gb-full bg-tier-safe text-on-tier-safe"
      >
        <KitIcon art={ICONS.checkCircle} frame={14} />
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span
        aria-hidden="true"
        className="mt-gb-xxs flex size-6 shrink-0 items-center justify-center rounded-gb-full border-2 border-line-error"
      />
    );
  }
  if (status === 'generating') {
    return (
      <span
        aria-hidden="true"
        className="mt-gb-xxs flex size-6 shrink-0 items-center justify-center rounded-gb-full border-2 border-line-strong"
      >
        <span className="size-2.5 animate-pulse rounded-gb-full bg-brand" />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className="mt-gb-xxs flex size-6 shrink-0 items-center justify-center rounded-gb-full border-2 border-line-strong"
    />
  );
}

function AnalysisLoadingVideo() {
  const reduced = usePrefersReducedMotion();
  return (
    <div className="w-48 shrink-0 overflow-hidden rounded-gb-2xl shadow-gb-lg" aria-hidden="true">
      {reduced ? (
        <div
          className="aspect-[960/668] w-full bg-cover bg-center"
          style={{ backgroundImage: 'url(/ai-strategy-loading-poster.jpg)' }}
        />
      ) : (
        <video
          className="w-full"
          src="/ai-strategy-loading.mp4"
          poster="/ai-strategy-loading-poster.jpg"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
        />
      )}
    </div>
  );
}
