'use client';

import { useState } from 'react';
import { useT } from '@/lib/i18n';
import { Badge, Button, ICONS, KitIcon } from '@/shared/ui';
import {
  SECTION_LABEL,
  applyLayoutOrder,
  countEntries,
  sectionTitle,
  type CvMissingSignal,
  type CvReview,
  type CvStrength,
  type StructuredCv,
} from '../domain';
import { CvSteps } from './cv-steps';
import { StrategyPanel } from './panel';
import {
  AnalysisFailedState,
  AnalysisNotRunState,
  GeneratingState,
  MissingCvContentState,
  OutdatedReviewState,
  StateBlock,
} from './states';

/**
 * "AI ASSESSMENT" — CV step 3. Reproduces the approved frame: the assessment
 * panel, three strengths, missing signals, and a CV preview beside them.
 *
 * WHY THE PREVIEW IS ON THIS PAGE AT ALL. The feedback is about specific lines. A
 * student reading "your projects section does not show scale" needs to see their
 * projects section without leaving the feedback, or they will read the advice,
 * navigate away, and forget which of four bullets it was about.
 *
 * THE SEVEN STATES. Not analyzed, analyzing, complete, outdated, failed, missing
 * content, and critical-gaps-resolved. They are enumerated explicitly rather than
 * derived from truthiness because each one needs different copy and a different
 * single recovery action, and the ones that get forgotten — outdated, resolved —
 * are the ones that matter for trust.
 */

export type CvReviewWorkspaceProps = {
  applicationId: string;
  cv: StructuredCv | null;
  initialReview: CvReview | null;
  /** From domain/staleness, computed server-side against the real versions. */
  outdated: boolean;
  hasTargetProfile: boolean;
};

export function CvReviewWorkspace({
  applicationId,
  cv,
  initialReview,
  outdated: initialOutdated,
  hasTargetProfile,
}: CvReviewWorkspaceProps) {
  const t = useT();
  const [review, setReview] = useState<CvReview | null>(initialReview);
  const [outdated, setOutdated] = useState(initialOutdated);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissedOutdated, setDismissedOutdated] = useState(false);
  const [expandedStrength, setExpandedStrength] = useState<number | null>(0);

  const hasContent = cv != null && countEntries(cv.sections) > 0;

  async function runReview() {
    setRunning(true);
    setError(null);
    try {
      const response = await fetch(`/api/applications/${applicationId}/cv/review`, {
        method: 'POST',
      });
      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        review?: CvReview;
        error?: string;
      };

      if (!response.ok || !data.review) {
        setError(data.error ?? t('We could not finish the review.'));
        return;
      }

      setReview(data.review);
      // A fresh review was just run against the current content, so by definition
      // it is not stale.
      setOutdated(false);
      setDismissedOutdated(false);
    } catch {
      setError(t('We could not reach Glowbal. Check your connection and try again.'));
    } finally {
      setRunning(false);
    }
  }

  const criticalCount = review?.missingSignals.filter((s) => s.critical).length ?? 0;
  const showOutdated = outdated && !dismissedOutdated && !running;

  return (
    <div className="flex flex-col gap-gb-3xl">
      <CvSteps applicationId={applicationId} current="review" furthestReached="review" />

      <header className="flex flex-col gap-gb-lg">
        <div className="flex flex-wrap items-center justify-between gap-gb-lg">
          <h1 className="font-display text-gb-display-sm font-semibold tracking-gb-display-tight text-fg">
            AI Assessment
          </h1>
          {review && !outdated ? (
            <span className="text-gb-xs text-fg-muted">
              Reviewed against version {review.contentVersion} of your CV
            </span>
          ) : null}
        </div>
        <p className="max-w-3xl text-gb-md text-fg-tertiary">
          {t('Your CV is compared with the target profile — what this programme needs you to prove. This is a content review, not a formatting review.')}
        </p>
      </header>

      {!hasContent ? <MissingCvContentState applicationId={applicationId} /> : null}

      {hasContent && !hasTargetProfile ? (
        <StateBlock
          title={t('No target profile yet')}
          body={t('The review uses the target profile, so create it first.')}
          action={{
            label: t('Create target profile'),
            href: `/ai-strategy/${applicationId}/cv/target-profile`,
          }}
        />
      ) : null}

      {running ? (
        <GeneratingState
          title={t('Reviewing your CV')}
          body={t('Reading your CV against every part of your target profile.')}
        />
      ) : null}

      {error && !running ? (
        <AnalysisFailedState
          what="review"
          onRetry={() => void runReview()}
          onContinue={() => setError(null)}
        />
      ) : null}

      {hasContent && hasTargetProfile && !review && !running && !error ? (
        <AnalysisNotRunState
          title={t('CV has not been reviewed yet')}
          body={t('AI will read your CV, compare it with each target-profile area, and identify three strengths and what is missing.')}
          actionLabel={t('Review my CV')}
          onRun={() => void runReview()}
        />
      ) : null}

      {showOutdated ? (
        <OutdatedReviewState
          onRerun={() => void runReview()}
          onContinue={() => setDismissedOutdated(true)}
          running={running}
        />
      ) : null}

      {review && !running ? (
        <>
          {review.summary ? (
            <StrategyPanel>
              <h2 className="text-gb-md font-semibold text-fg">{t('Overview')}</h2>
              <p className="text-gb-md text-fg-secondary">{review.summary}</p>
            </StrategyPanel>
          ) : null}

          {/* "Critical gaps resolved" — its own state, because a student who fixed
              two blocking gaps should be told, not left to infer it from an empty
              list. */}
          {criticalCount === 0 && review.missingSignals.length > 0 ? (
            <div className="flex items-center gap-gb-md rounded-gb-xl border border-line bg-surface-muted px-gb-2xl py-gb-lg">
              <span aria-hidden className="text-fg-verified">
                <KitIcon art={ICONS.checkCircle} frame={16} />
              </span>
              <p className="text-gb-sm text-fg-secondary">
                {t('There are no serious gaps left. The suggestions below will make the CV stronger.')}
              </p>
            </div>
          ) : null}

          <div className="grid gap-gb-2xl lg:grid-cols-[1.15fr_1fr]">
            <div className="flex flex-col gap-gb-2xl">
              <StrengthsPanel
                strengths={review.strengths}
                expanded={expandedStrength}
                onToggle={(index) => setExpandedStrength(expandedStrength === index ? null : index)}
              />
              <MissingSignalsPanel
                signals={review.missingSignals}
                applicationId={applicationId}
              />
            </div>

            {/* Below the feedback on mobile, beside it from lg up. */}
            <CvPreviewPanel cv={cv} />
          </div>

          <div className="flex flex-wrap items-center gap-gb-xl">
            <Button size="lg" href={`/ai-strategy/${applicationId}/cv/layout`}>
              {t('Choose a layout and export PDF')}
            </Button>
            <button
              type="button"
              onClick={() => void runReview()}
              disabled={running}
              className="rounded-gb-md text-gb-sm font-medium text-fg-tertiary underline decoration-line-strong underline-offset-4 hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60"
            >
              {t('Review again')}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

function StrengthsPanel({
  strengths,
  expanded,
  onToggle,
}: {
  strengths: readonly CvStrength[];
  expanded: number | null;
  onToggle: (index: number) => void;
}) {
  const t = useT();
  if (strengths.length === 0) {
    return (
      <StrategyPanel>
        <h2 className="text-gb-md font-semibold text-fg">{t('Strengths')}</h2>
        <p className="text-gb-sm text-fg-tertiary">
          {t('We could not find any clearly evidenced strengths in the CV. Add specific details to each entry to help.')}
        </p>
      </StrategyPanel>
    );
  }

  return (
    <StrategyPanel>
      <h2 className="text-gb-md font-semibold text-fg">
        {strengths.length === 3 ? t('Three strengths') : t('Strengths')}
      </h2>
      <ul className="flex flex-col gap-gb-md">
        {strengths.map((strength, index) => {
          const open = expanded === index;
          return (
            <li key={strength.title} className="rounded-gb-xl border border-line bg-surface-muted">
              <button
                type="button"
                onClick={() => onToggle(index)}
                aria-expanded={open}
                className="flex w-full items-start justify-between gap-gb-lg rounded-gb-xl p-gb-xl text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <span className="flex min-w-0 flex-col gap-gb-xxs">
                  <span className="text-gb-sm font-semibold text-fg">{strength.title}</span>
                  <span className="text-gb-xs text-fg-muted">{strength.targetProfileArea}</span>
                </span>
                <span className="flex shrink-0 items-center gap-gb-md">
                  {strength.strength === 'strong' ? <Badge variant="safe-chip">Strong</Badge> : null}
                  <span aria-hidden className="text-fg-muted">
                    <KitIcon
                      art={ICONS.chevronDown}
                      frame={16}
                      className={open ? 'rotate-180 transition-transform' : 'transition-transform'}
                    />
                  </span>
                </span>
              </button>

              {open ? (
                <div className="flex flex-col gap-gb-md border-t border-line px-gb-xl pt-gb-lg pb-gb-xl">
                  {/* The quote is the whole point: a strength the student cannot
                      find in their own CV is unfalsifiable praise. */}
                  <blockquote className="border-l-2 border-brand pl-gb-lg text-gb-sm text-fg-secondary italic">
                    “{strength.evidence}”
                  </blockquote>
                  <p className="text-gb-sm text-fg-tertiary">{strength.programmeRelevance}</p>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </StrategyPanel>
  );
}

function MissingSignalsPanel({
  signals,
  applicationId,
}: {
  signals: readonly CvMissingSignal[];
  applicationId: string;
}) {
  const t = useT();
  if (signals.length === 0) {
    return (
      <StrategyPanel>
        <h2 className="text-gb-md font-semibold text-fg">{t('Missing')}</h2>
        <p className="text-gb-sm text-fg-tertiary">
          {t('No gaps were found against the target profile.')}
        </p>
      </StrategyPanel>
    );
  }

  return (
    <StrategyPanel>
      <h2 className="text-gb-md font-semibold text-fg">{t('Missing')}</h2>
      <ul className="flex flex-col gap-gb-lg">
        {signals.map((signal) => (
          <li
            key={signal.signal}
            className="flex flex-col gap-gb-md rounded-gb-xl border border-line bg-surface-muted p-gb-xl"
          >
            <div className="flex flex-wrap items-start justify-between gap-gb-md">
              <p className="text-gb-sm font-semibold text-fg">{signal.signal}</p>
              {signal.critical ? <Badge variant="brand-chip">{t('Needs action')}</Badge> : null}
            </div>
            <p className="text-gb-sm text-fg-tertiary">{signal.reason}</p>
            <p className="text-gb-sm text-fg-secondary">
              <span className="font-medium">{t('Do this')}: </span>
              {signal.action}
            </p>
            {/*
              Deep link into the editor with the section pre-opened. `targetSection`
              is coerced to a real section kind server-side, so this always lands
              somewhere that exists.
            */}
            <a
              href={`/ai-strategy/${applicationId}/cv/content#section-${signal.targetSection}`}
              className="inline-flex w-fit items-center gap-gb-xs rounded-gb-md text-gb-xs font-semibold text-fg-brand underline decoration-line-strong underline-offset-4 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              {t('Open')} {t(SECTION_LABEL[signal.targetSection])}
              <KitIcon art={ICONS.arrowRight} frame={12} />
            </a>
          </li>
        ))}
      </ul>
    </StrategyPanel>
  );
}

/**
 * A compact read-only rendering of the CV, so feedback and content are on screen
 * together.
 *
 * Ordered by the selected layout when there is one, so what the student sees here
 * matches what the PDF will produce. Not editable: this is the reference copy, and
 * two editable surfaces for the same data is how they get out of step.
 */
function CvPreviewPanel({ cv }: { cv: StructuredCv | null }) {
  const t = useT();
  if (!cv || cv.sections.length === 0) return null;

  const ordered = cv.selectedLayout ? applyLayoutOrder(cv.sections, cv.selectedLayout) : cv.sections;

  return (
    <StrategyPanel padding="sm" className="lg:sticky lg:top-gb-2xl lg:max-h-[80vh] lg:overflow-y-auto">
      <h2 className="text-gb-md font-semibold text-fg">{t('Your CV')}</h2>
      <div className="flex flex-col gap-gb-xl">
        {ordered.map((section) => (
          <div key={section.id} className="flex flex-col gap-gb-md">
            <h3
              id={`preview-${section.kind}`}
              className="text-gb-xs font-semibold tracking-wide text-fg-muted uppercase"
            >
              {sectionTitle(section)}
            </h3>
            {section.entries.length === 0 ? (
              <p className="text-gb-xs text-fg-muted italic">{t('No content yet')}</p>
            ) : (
              <ul className="flex flex-col gap-gb-md">
                {section.entries.map((entry) => (
                  <li key={entry.id} className="flex flex-col gap-gb-xxs">
                    <span className="text-gb-sm font-medium text-fg">
                      {[entry.role, entry.organization].filter(Boolean).join(' — ') || '—'}
                    </span>
                    {[entry.startDate, entry.current ? 'present' : entry.endDate].filter(Boolean)
                      .length > 0 ? (
                      <span className="text-gb-xs text-fg-muted">
                        {[entry.startDate, entry.current ? 'present' : entry.endDate]
                          .filter(Boolean)
                          .join(' – ')}
                      </span>
                    ) : null}
                    {entry.bullets.filter((b) => b.trim().length > 0).length > 0 ? (
                      <ul className="flex list-disc flex-col gap-gb-xxs pl-gb-xl text-gb-xs text-fg-tertiary">
                        {entry.bullets
                          .filter((b) => b.trim().length > 0)
                          .map((bullet, index) => (
                            <li key={`${entry.id}-${index}`}>{bullet}</li>
                          ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </StrategyPanel>
  );
}
