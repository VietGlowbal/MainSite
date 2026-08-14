'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Button, ICONS, KitIcon, Panel, ProgressBar, usePrefersReducedMotion } from '@/shared/ui';
import { useT } from '@/lib/i18n';

type ReportKey = 'personal' | 'matching';
type ReportStatus = 'generating' | 'complete' | 'failed';
type ReportState = { status: ReportStatus; error?: string };

/**
 * Generate the real user-level Personal Report first. The historical
 * application-scoped applicant-analysis is then maintained only as an
 * internal compatibility adapter because the current Strategy generator still
 * consumes that row. A user-visible "Personal Report complete" therefore
 * always means `/ai-strategy/personal-report` is actually ready.
 */
async function fetchOrGeneratePersonal(applicationId: string, genericError: string): Promise<ReportState> {
  try {
    const canonical = await fetch('/api/ai-strategy/personal-report', { method: 'POST' });
    const canonicalBody = await canonical.json().catch(() => ({}));
    if (!canonical.ok || !canonicalBody.reportV2) {
      return { status: 'failed', error: canonicalBody.error || genericError };
    }

    // Temporary adapter for the existing F7 Strategy route. This result is
    // never presented as a second Personal Report.
    const existingLegacy = await fetch(`/api/applications/${applicationId}/strategy/applicant-analysis`);
    const existingLegacyBody = await existingLegacy.json().catch(() => ({}));
    if (!existingLegacyBody.analysis) {
      const legacy = await fetch(`/api/applications/${applicationId}/strategy/applicant-analysis`, {
        method: 'POST',
      });
      const legacyBody = await legacy.json().catch(() => ({}));
      if (!legacy.ok || legacyBody.error) {
        return { status: 'failed', error: legacyBody.error || genericError };
      }
    }

    return { status: 'complete' };
  } catch {
    return { status: 'failed', error: genericError };
  }
}

async function fetchOrGenerateMatching(applicationId: string, genericError: string): Promise<ReportState> {
  try {
    const existing = await fetch(`/api/applications/${applicationId}/strategy/course-match`);
    const existingBody = await existing.json().catch(() => ({}));
    if (existingBody.analysis) return { status: 'complete' };

    const created = await fetch(`/api/applications/${applicationId}/match-insights`, { method: 'POST' });
    const createdBody = await created.json().catch(() => ({}));
    if (!created.ok || createdBody.error) return { status: 'failed', error: createdBody.error || genericError };
    return { status: 'complete' };
  } catch {
    return { status: 'failed', error: genericError };
  }
}

export function AnalysisWorkspace({
  applicationId,
  confirmedAt,
  matchingSubtitle,
}: {
  applicationId: string;
  confirmedAt?: string | null | undefined;
  matchingSubtitle?: string | undefined;
}) {
  const t = useT();
  const [personal, setPersonal] = useState<ReportState>({ status: 'generating' });
  const [matching, setMatching] = useState<ReportState>({ status: 'generating' });
  const ran = useRef<Record<ReportKey, boolean>>({ personal: false, matching: false });

  const personalHref = '/ai-strategy/personal-report';
  const matchingHref = `/ai-strategy/${applicationId}/matching-report`;
  const genericError = t('Something went wrong. Please try again.');

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (ran.current.personal) return;
    ran.current.personal = true;
    async function run() {
      setPersonal(await fetchOrGeneratePersonal(applicationId, genericError));
    }
    void run();
  }, [applicationId, genericError]);

  useEffect(() => {
    if (ran.current.matching) return;
    ran.current.matching = true;
    async function run() {
      setMatching(await fetchOrGenerateMatching(applicationId, genericError));
    }
    void run();
  }, [applicationId, genericError]);

  function retryPersonal() {
    setPersonal({ status: 'generating' });
    fetchOrGeneratePersonal(applicationId, genericError).then(setPersonal);
  }

  function retryMatching() {
    setMatching({ status: 'generating' });
    fetchOrGenerateMatching(applicationId, genericError).then(setMatching);
  }

  const completeCount = [personal, matching].filter((report) => report.status === 'complete').length;
  const allComplete = completeCount === 2;
  const anyFailed = personal.status === 'failed' || matching.status === 'failed';
  const confirmedDate = confirmedAt
    ? new Date(confirmedAt).toLocaleString('en-US', {
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
      </div>

      {!allComplete ? (
        <div className="flex flex-col items-center gap-gb-xl sm:flex-row sm:justify-center">
          <AnalysisLoadingVideo />
          <div className="flex w-full max-w-xs flex-col items-center gap-gb-md text-center sm:items-start sm:text-left">
            <p className="text-gb-lg font-semibold text-fg">{t('Building your personalised reports')}</p>
            <p className="text-gb-sm text-fg-tertiary">
              {t('{count} of {total} reports complete', { count: completeCount, total: 2 })}
            </p>
            <ProgressBar
              value={(completeCount / 2) * 100}
              label={t('Report generation progress')}
              className="w-full"
            />
          </div>
        </div>
      ) : null}

      <div aria-live="polite" className="sr-only">
        {personal.status === 'complete' ? t('Personal Report is ready.') : ''}
        {matching.status === 'complete' ? t('Matching Report is ready.') : ''}
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
          <Button href={personalHref} size="lg">
            {t('View my reports')}
          </Button>
          <Button href={matchingHref} variant="secondary" size="lg">
            {t('Open Matching Report')}
          </Button>
          <Button href="/apply" variant="secondary" size="lg">
            {t('Go to My Portal')}
          </Button>
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
  return (
    <span
      aria-hidden="true"
      className="mt-gb-xxs flex size-6 shrink-0 items-center justify-center rounded-gb-full border-2 border-line-strong"
    >
      <span className="size-2.5 animate-pulse rounded-gb-full bg-brand" />
    </span>
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
