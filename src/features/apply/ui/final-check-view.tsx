'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '@/lib/i18n';
import {
  ACTION_TIER_LABELS,
  ACTION_TIER_MEANINGS,
  COMPONENT_LABELS,
  CONSISTENCY_CHECK_LABELS,
  READINESS_DISCLAIMER,
  READINESS_STATE_LABELS,
  canRunFinalCheck,
  orderedReviews,
  unsupportedPillars,
  type ActionTier,
  type ComponentState,
  type ComponentStatus,
  type DocumentReview,
  type FinalCheckRecord,
  type NarrativeAudit,
  type Readiness,
} from '../domain';
import { Badge, Button, Panel, ProgressBar, type BadgeVariant } from '@/shared/ui';
import { useLoadingIndicator } from '@/shared/ui/loading-overlay';

/**
 * Final Application Check.
 *
 * Three sections from docs/strategy-reports-spec.md: overall readiness, a
 * document-by-document review, and a narrative consistency audit.
 *
 * ─── WHAT THIS PAGE REFUSES TO DO ────────────────────────────────────────────
 *
 * It does not say whether to submit. A student reading a readiness figure at
 * the moment they are deciding whether to press send is the most consequential
 * screen in the product, and the honest thing it can offer is "here is what is
 * incomplete and inconsistent", not a verdict. There is no "you're ready" state
 * and no predicted outcome — see READINESS_DISCLAIMER and core principle 7.
 *
 * ─── THE INVENTORY RENDERS BEFORE ANY AI RUNS ────────────────────────────────
 *
 * Component states come from real rows, so the readiness figure and the list of
 * what is missing are useful on first visit, before a check has been generated
 * and even when the migration is not deployed. Only the written review needs
 * the model.
 */

const TIER_BADGE: Record<ActionTier, BadgeVariant> = {
  critical: 'reach',
  strategic: 'recommend',
  polish: 'neutral-chip',
};

const STATUS_LABEL: Record<ComponentStatus, string> = {
  reviewed: 'Written and reviewed',
  draft: 'Written, not reviewed yet',
  missing: 'Nothing attached',
  not_required: 'Not required',
};

const STATUS_BADGE: Record<ComponentStatus, BadgeVariant> = {
  reviewed: 'safe-chip',
  draft: 'info-chip',
  missing: 'reach',
  not_required: 'neutral-chip',
};

const STRENGTH_LABEL = {
  strong: 'Strong',
  moderate: 'Moderate',
  weak: 'Weak',
} as const;

const VERDICT_LABEL = {
  consistent: 'Consistent',
  minor_conflict: 'Minor conflict',
  conflict: 'Conflict',
  not_assessed: 'Not assessed',
} as const;

const VERDICT_BADGE: Record<keyof typeof VERDICT_LABEL, BadgeVariant> = {
  consistent: 'safe-chip',
  minor_conflict: 'info-chip',
  conflict: 'reach',
  not_assessed: 'neutral-chip',
};

export function FinalCheckView({
  applicationId,
  universityName,
  courseName,
  components,
  liveReadiness,
  check,
  migrationMissing,
}: {
  applicationId: string;
  universityName: string;
  courseName: string;
  components: ComponentState[];
  liveReadiness: Readiness;
  check: FinalCheckRecord | null;
  migrationMissing: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    migrationMissing ? t('Final Check is not enabled in the database yet.') : null,
  );
  useLoadingIndicator(busy, t('Reviewing your application'));

  const runnable = canRunFinalCheck(components);
  // Readiness from the stored check when there is one, because its critical
  // findings are part of the figure. Otherwise the live inventory.
  const readiness = check?.readiness ?? liveReadiness;

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/applications/${applicationId}/final-check`, {
        method: 'POST',
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(body?.error ?? t('We could not run the check. Please try again.'));
        return;
      }
      router.refresh();
    } catch {
      setError(t('We could not reach the server. Please check your connection and try again.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-gb-4xl" data-no-auto-translate>
      <header className="flex flex-col gap-gb-md">
        <p className="text-gb-sm text-fg-tertiary">{universityName}</p>
        <h1 className="font-display text-gb-display-sm font-semibold tracking-gb-display-tight text-fg">
          {t('Final check')}
        </h1>
        <p className="max-w-2xl text-gb-sm text-fg-tertiary">
          {t(
            'A last read of {course} as one package: what is complete, what each document is doing, and whether they tell the same story.',
            { course: courseName },
          )}
        </p>
      </header>

      {error ? <p className="text-gb-sm text-fg-error">{error}</p> : null}

      <ReadinessSection readiness={readiness} t={t} />

      <InventorySection components={components} t={t} />

      {check ? (
        <>
          <DocumentReviewSection reviews={check.documentReviews} t={t} />
          {check.narrativeAudit ? (
            <NarrativeSection audit={check.narrativeAudit} t={t} />
          ) : null}
          {check.limitations.length > 0 ? (
            <Panel className="flex flex-col gap-gb-md">
              <h2 className="text-gb-md font-semibold text-fg">{t('What this check could not cover')}</h2>
              <ul className="list-disc space-y-gb-xs pl-gb-xl text-gb-sm text-fg-tertiary">
                {check.limitations.map((limitation) => (
                  <li key={limitation}>{limitation}</li>
                ))}
              </ul>
            </Panel>
          ) : null}
          <p className="text-gb-xs text-fg-muted">
            {t('Last checked')}: {new Date(check.createdAt).toLocaleString('vi-VN')}
          </p>
        </>
      ) : (
        <Panel className="flex flex-col items-start gap-gb-lg">
          <h2 className="text-gb-md font-semibold text-fg">
            {runnable ? t('Ready to review your documents') : t('Not enough to review yet')}
          </h2>
          <p className="max-w-2xl text-gb-sm text-fg-tertiary">
            {runnable
              ? t(
                  'Upload the versions you actually intend to submit. Reviewing an old draft and calling it a final check would be worse than not running one.',
                )
              : t(
                  'Attach at least two of your application documents, then run the check. With less than that there is nothing to cross-reference.',
                )}
          </p>
          <Button onClick={generate} disabled={busy || !runnable || migrationMissing}>
            {busy ? t('Reviewing…') : t('Run final check')}
          </Button>
        </Panel>
      )}
    </div>
  );
}

type Translate = ReturnType<typeof useT>;

function ReadinessSection({ readiness, t }: { readiness: Readiness; t: Translate }) {
  return (
    <section className="flex flex-col gap-gb-lg">
      <div className="flex flex-wrap items-end justify-between gap-gb-lg">
        <div className="flex flex-col gap-gb-xxs">
          <h2 className="text-gb-md font-semibold text-fg">{t('Overall readiness')}</h2>
          <p className="font-display text-gb-display-md font-semibold text-fg">
            {readiness.percent}%
          </p>
        </div>
        <Badge variant="neutral">{t(READINESS_STATE_LABELS[readiness.state])}</Badge>
      </div>

      <ProgressBar value={readiness.percent} label={t('Application readiness')} />

      <p className="max-w-2xl text-gb-xs text-fg-muted">{t(READINESS_DISCLAIMER)}</p>

      {readiness.criticalActions > 0 ? (
        <p className="text-gb-sm text-fg-secondary">
          {t('{count} critical finding(s) are still open. Clearing those raises this figure fastest.', {
            count: readiness.criticalActions,
          })}
        </p>
      ) : null}
    </section>
  );
}

function InventorySection({ components, t }: { components: ComponentState[]; t: Translate }) {
  return (
    <section className="flex flex-col gap-gb-lg">
      <h2 className="text-gb-md font-semibold text-fg">{t('What is attached')}</h2>
      <Panel className="flex flex-col">
        {components.map((component) => (
          <div
            key={component.key}
            className="flex flex-wrap items-center justify-between gap-gb-md border-b border-line py-gb-lg last:border-b-0"
          >
            <span className="text-gb-sm font-medium text-fg">
              {t(COMPONENT_LABELS[component.key])}
            </span>
            <Badge variant={STATUS_BADGE[component.status]}>
              {t(STATUS_LABEL[component.status])}
            </Badge>
          </div>
        ))}
      </Panel>
    </section>
  );
}

function DocumentReviewSection({
  reviews,
  t,
}: {
  reviews: DocumentReview[];
  t: Translate;
}) {
  const ordered = orderedReviews(reviews);

  return (
    <section className="flex flex-col gap-gb-lg">
      <h2 className="text-gb-md font-semibold text-fg">{t('Document by document')}</h2>
      <p className="max-w-2xl text-gb-sm text-fg-tertiary">
        {t('Each document is judged on what it is meant to do, not on whether it is well written.')}
      </p>

      <div className="flex flex-col gap-gb-lg">
        {ordered.map((review) => (
          <Panel key={review.key} className="flex flex-col gap-gb-md">
            <div className="flex flex-wrap items-center justify-between gap-gb-md">
              <h3 className="text-gb-md font-semibold text-fg">
                {t(COMPONENT_LABELS[review.key])}
              </h3>
              <Badge variant={TIER_BADGE[review.tier]}>
                {t(ACTION_TIER_LABELS[review.tier])}
              </Badge>
            </div>
            <p className="text-gb-xs text-fg-muted">{t(ACTION_TIER_MEANINGS[review.tier])}</p>

            <dl className="flex flex-col gap-gb-md">
              {(
                [
                  ['What it needs to do', review.purpose],
                  ['What it currently shows', review.evidence],
                  ['Strongest part', review.strength],
                  ['What is missing', review.gap],
                  ['How it contributes', review.strategicContribution],
                ] as Array<[string, string]>
              ).map(([label, value]) => (
                <div key={label} className="flex flex-col gap-gb-xxs">
                  <dt className="text-gb-xs font-semibold text-fg-secondary">{t(label)}</dt>
                  <dd className="text-gb-sm leading-relaxed text-fg-tertiary">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="rounded-gb-xl bg-surface-muted p-gb-lg">
              <p className="text-gb-xs font-semibold text-fg-secondary">
                {t('Do this next')}
              </p>
              <p className="text-gb-sm leading-relaxed text-fg">{review.recommendedAction}</p>
            </div>
          </Panel>
        ))}
      </div>
    </section>
  );
}

function NarrativeSection({ audit, t }: { audit: NarrativeAudit; t: Translate }) {
  const unsupported = unsupportedPillars(audit);

  return (
    <section className="flex flex-col gap-gb-lg">
      <h2 className="text-gb-md font-semibold text-fg">{t('Does it tell one story?')}</h2>

      <Panel className="flex flex-col gap-gb-md">
        <h3 className="text-gb-sm font-semibold text-fg-secondary">{t('Your core narrative')}</h3>
        <p className="max-w-2xl text-gb-sm leading-relaxed text-fg-secondary">
          {audit.coreNarrative}
        </p>
        <blockquote className="border-l-2 border-brand pl-gb-lg text-gb-md italic text-fg">
          {audit.whatTheReaderRemembers}
        </blockquote>
      </Panel>

      {audit.pillars.length > 0 ? (
        <div className="flex flex-col gap-gb-md">
          <h3 className="text-gb-sm font-semibold text-fg-secondary">{t('Themes and where they show up')}</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] border-collapse text-gb-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="py-gb-md pr-gb-lg font-semibold text-fg">{t('Theme')}</th>
                  <th className="py-gb-md pr-gb-lg font-semibold text-fg">{t('Evidence')}</th>
                  <th className="py-gb-md pr-gb-lg font-semibold text-fg">{t('Consistency')}</th>
                  <th className="py-gb-md font-semibold text-fg">{t('Appears in')}</th>
                </tr>
              </thead>
              <tbody>
                {audit.pillars.map((pillar) => (
                  <tr key={pillar.theme} className="border-b border-line last:border-b-0">
                    <td className="py-gb-md pr-gb-lg text-fg">{pillar.theme}</td>
                    <td className="py-gb-md pr-gb-lg text-fg-tertiary">
                      {t(STRENGTH_LABEL[pillar.evidenceStrength])}
                    </td>
                    <td className="py-gb-md pr-gb-lg text-fg-tertiary">
                      {t(STRENGTH_LABEL[pillar.consistency])}
                    </td>
                    <td className="py-gb-md text-fg-tertiary">
                      {pillar.coverage.length === 0
                        ? t('Nowhere yet')
                        : pillar.coverage.map((key) => t(COMPONENT_LABELS[key])).join(', ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {audit.checks.length > 0 ? (
        <Panel className="flex flex-col gap-gb-md">
          <h3 className="text-gb-sm font-semibold text-fg-secondary">{t('Consistency checks')}</h3>
          <ul className="flex flex-col">
            {audit.checks.map((entry) => (
              <li
                key={entry.key}
                className="flex flex-col gap-gb-xxs border-b border-line py-gb-md last:border-b-0"
              >
                <div className="flex flex-wrap items-center gap-gb-md">
                  <span className="text-gb-sm font-medium text-fg">
                    {t(CONSISTENCY_CHECK_LABELS[entry.key])}
                  </span>
                  <Badge variant={VERDICT_BADGE[entry.verdict]}>
                    {t(VERDICT_LABEL[entry.verdict])}
                  </Badge>
                </div>
                <p className="text-gb-sm text-fg-tertiary">{entry.detail}</p>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {unsupported.length > 0 ? (
        <Panel className="flex flex-col gap-gb-md border-line-error">
          <h3 className="text-gb-sm font-semibold text-fg-error">
            {t('Claims your documents do not yet back up')}
          </h3>
          <p className="text-gb-xs text-fg-tertiary">
            {t('These are the parts a reader is most likely to question.')}
          </p>
          <ul className="flex flex-col gap-gb-xs">
            {unsupported.map((pillar) => (
              <li key={pillar.theme} className="text-gb-sm text-fg-secondary">
                {pillar.theme}
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {audit.unevidencedClaims.length > 0 ? (
        <Panel className="flex flex-col gap-gb-md">
          <h3 className="text-gb-sm font-semibold text-fg-secondary">{t('Unsupported statements')}</h3>
          <ul className="list-disc space-y-gb-xs pl-gb-xl text-gb-sm text-fg-tertiary">
            {audit.unevidencedClaims.map((claim) => (
              <li key={claim}>{claim}</li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {audit.overweightedThemes.length > 0 ? (
        <Panel className="flex flex-col gap-gb-md">
          <h3 className="text-gb-sm font-semibold text-fg-secondary">{t('Themes taking up too much space')}</h3>
          <ul className="list-disc space-y-gb-xs pl-gb-xl text-gb-sm text-fg-tertiary">
            {audit.overweightedThemes.map((theme) => (
              <li key={theme}>{theme}</li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </section>
  );
}
