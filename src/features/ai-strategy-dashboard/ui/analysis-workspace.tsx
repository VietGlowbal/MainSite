'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Button, ICONS, KitIcon, Panel, ProgressBar, usePrefersReducedMotion } from '@/shared/ui';
import { useT } from '@/lib/i18n';

/**
 * `/ai-strategy/[applicationId]/strategy/analysis` — the Report Generation
 * page, shown immediately after Review & Confirm.
 *
 * ─── THIS PAGE NO LONGER RENDERS THE REPORTS ─────────────────────────────────
 *
 * It generates whichever of the Personal/Matching analyses is missing, then
 * hands off to `analysis/portrait`. The reports themselves are two other
 * pages — server components that render from stored rows — so all this does
 * is make sure both exist.
 *
 * ─── SCOPED TO WHAT THIS APP ACTUALLY GENERATES HERE ─────────────────────────
 *
 * The owner's spec for this screen describes four independently-tracked,
 * backend-persisted reports (Personal/Matching/Strategy/Evaluation) with a
 * generation-run record, a polling API, and per-report retry — real
 * infrastructure this app does not have. Only two reports are actually
 * generated at this step: Personal and Matching, both as one synchronous
 * request/response each, with no generation-run table and no server-side
 * job to poll. (Strategy — F7, "Personalized Strategy" — already exists in
 * this app, but as its own, later onboarding step with its own generation
 * call; "Evaluation Report" and "CV Suggestions" do not exist anywhere in
 * this codebase.) Per explicit product decision, this redesign keeps that
 * architecture and rebuilds the page around exactly the two reports it
 * generates — real per-report status, a real 2-of-2 progress count, and
 * independent retry for each — rather than a persisted multi-report system.
 *
 * ─── TWO INDEPENDENT REPORTS, NOT ONE COMBINED STATE ─────────────────────────
 *
 * The previous version tracked one `checking | generating | error` state for
 * both reports together (`Promise.all`), so a student could not see or open
 * a finished Personal Report while Matching was still running, and one
 * failure blanked out both. `personal`/`matching` are now tracked and
 * retried independently, so a report that finishes shows "Open report"
 * immediately, and a report that fails offers its own "Try again" without
 * touching the other.
 *
 * ─── "YOU CAN LEAVE THIS PAGE" IS TRUE HERE, WITHOUT A BACKGROUND JOB ────────
 *
 * Neither fetch below is wired to an `AbortController`, and this component
 * unmounting does not cancel an in-flight `fetch`. Clicking "Go to My
 * Portal" is a client-side route change — the tab stays open, so both
 * requests run to completion and their results land in the database exactly
 * as if the student had stayed and watched.
 */

type ReportKey = 'personal' | 'matching';
type ReportStatus = 'generating' | 'complete' | 'failed';
type ReportState = { status: ReportStatus; error?: string };

/**
 * The actual network work, kept as plain module-level functions with no
 * `setState` calls of their own — deliberately, not just for testability.
 * `react-hooks/set-state-in-effect` flags a `useCallback` that calls
 * `setState` the moment anything (even the async work's own effect-mount
 * call) references it from inside a `useEffect`, since its static analysis
 * cannot tell "before the first `await`" from "after it" and treats the
 * whole function as a synchronous-setState hazard. Keeping the fetch logic
 * setState-free and letting each caller (the mount effect, or a retry
 * button) apply the result themselves sidesteps that false positive while
 * also meaning this logic can be tested without rendering the component.
 */
async function fetchOrGeneratePersonal(applicationId: string, genericError: string): Promise<ReportState> {
  try {
    const existing = await fetch(`/api/applications/${applicationId}/strategy/applicant-analysis`);
    const existingBody = await existing.json();
    if (existingBody.analysis) return { status: 'complete' };

    const created = await fetch(`/api/applications/${applicationId}/strategy/applicant-analysis`, {
      method: 'POST',
    });
    const createdBody = await created.json();
    if (createdBody.error) return { status: 'failed', error: createdBody.error };
    return { status: 'complete' };
  } catch {
    return { status: 'failed', error: genericError };
  }
}

async function fetchOrGenerateMatching(applicationId: string, genericError: string): Promise<ReportState> {
  try {
    const existing = await fetch(`/api/applications/${applicationId}/strategy/course-match`);
    const existingBody = await existing.json();
    if (existingBody.analysis) return { status: 'complete' };

    // Generation posts to a different route than the read above — see the
    // note on this in the previous version of this file; unchanged here.
    const created = await fetch(`/api/applications/${applicationId}/match-insights`, { method: 'POST' });
    const createdBody = await created.json();
    if (createdBody.error) return { status: 'failed', error: createdBody.error };
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
  /** ISO timestamp from `student_profiles.confirmed_at`, when known. */
  confirmedAt?: string | null | undefined;
  /** e.g. "University of Cambridge — Engineering", when the course is known. */
  matchingSubtitle?: string | undefined;
}) {
  const t = useT();
  const [personal, setPersonal] = useState<ReportState>({ status: 'generating' });
  const [matching, setMatching] = useState<ReportState>({ status: 'generating' });
  const ran = useRef<Record<ReportKey, boolean>>({ personal: false, matching: false });

  const portraitHref = `/ai-strategy/${applicationId}/strategy/analysis/portrait`;
  const fitHref = `/ai-strategy/${applicationId}/strategy/analysis/fit`;

  const genericError = t('Something went wrong. Please try again.');

  // Arriving here is a client-side push from wherever the previous step left
  // the scroll position (often the bottom of a long form) — without this the
  // hero renders off-screen and looks like a blank/broken page.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (ran.current.personal) return;
    ran.current.personal = true;

    async function run() {
      const result = await fetchOrGeneratePersonal(applicationId, genericError);
      setPersonal(result);
    }
    void run();
  }, [applicationId, genericError]);

  useEffect(() => {
    if (ran.current.matching) return;
    ran.current.matching = true;

    async function run() {
      const result = await fetchOrGenerateMatching(applicationId, genericError);
      setMatching(result);
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

  const completeCount = [personal, matching].filter((r) => r.status === 'complete').length;
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

      {/* Meaningful status changes only — not every render — per the a11y
          requirement that this not turn into an animation-update firehose. */}
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
          viewHref={portraitHref}
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
          viewHref={fitHref}
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
          <Button href={portraitHref} size="lg">
            {t('View my reports')}
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
  // generating — a pulsing brand dot, the same "something is happening"
  // treatment `document-panel.tsx`'s own processing states already use,
  // rather than a spinning-ring glyph this design system has no icon for.
  return (
    <span
      aria-hidden="true"
      className="mt-gb-xxs flex size-6 shrink-0 items-center justify-center rounded-gb-full border-2 border-line-strong"
    >
      <span className="size-2.5 animate-pulse rounded-gb-full bg-brand" />
    </span>
  );
}

/**
 * Loops for as long as any report is generating (typically 30-60s, so
 * several loops of the ~10s clip) — same treatment `GlobeLoader`'s `Globe`
 * uses for `/loading-globe.mp4`: muted + `playsInline` (required for iOS
 * Safari autoplay), a `poster` for the gap before the first frame decodes,
 * and a static image instead of motion when the OS asks for reduced motion.
 *
 * Sized to ~200px, not the ~672px (`max-w-2xl`) the previous version used —
 * this is supportive decoration beside the report list now, not the page's
 * only indication that something is happening.
 */
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
