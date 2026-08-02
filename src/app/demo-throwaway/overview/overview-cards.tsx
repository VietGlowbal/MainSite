'use client';

import Link from 'next/link';
import {
  cvActionLabel,
  statementActionLabel,
  statusLabel,
  type CvLayoutKey,
  type WorkspaceStatus,
} from '@/features/application-strategy/domain';
import { Panel, PanelHeader, StatusPill, formatDate } from '../demo-ui';
import type { Scenario } from '../fixtures';

/**
 * THROWAWAY DEMO — the two workspace cards. Delete with the folder.
 *
 * No charts, no aggregate score, no admissions probability. Sub-statuses are
 * plain rows because the spec's mobile rule rules out a dense status grid, and a
 * grid that has to become rows anyway may as well be rows everywhere.
 */

type CvDetail = {
  targetProfile: WorkspaceStatus;
  content: WorkspaceStatus;
  review: WorkspaceStatus;
  selectedLayout: CvLayoutKey | null;
  exportState: 'none' | 'ready' | 'outdated';
  updatedAt: string | null;
  reviewOutdated: boolean;
};

type StatementDetail = {
  wordCount: number;
  wordLimit: number | null;
  lastSavedAt: string | null;
  lastAnalyzedAt: string | null;
  analysisOutdated: boolean;
  readiness: 'needs_attention' | 'ready' | null;
};

export function OverviewCards({
  scenario,
  cvStatusValue,
  statementStatusValue,
  cvDetail,
  statementDetail,
  cvHref,
  statementHref,
}: {
  scenario: Scenario;
  cvStatusValue: WorkspaceStatus;
  statementStatusValue: WorkspaceStatus;
  cvDetail: CvDetail;
  statementDetail: StatementDetail;
  cvHref: string;
  statementHref: string;
}) {
  if (scenario === 'empty') {
    return (
      <Panel>
        <div className="flex flex-col items-start gap-gb-xl">
          <div className="flex flex-col gap-gb-md">
            <h2 className="text-gb-lg font-semibold text-fg">Nothing here yet</h2>
            {/* Copy pinned by the spec. */}
            <p className="max-w-xl text-gb-md text-fg-tertiary">
              Start with the document you already have, or create one from your Glowbal
              profile.
            </p>
          </div>
          <Link
            href={cvHref}
            className="rounded-gb-md bg-brand px-gb-3xl py-gb-lg text-gb-sm font-semibold text-on-brand hover:bg-brand-hover"
          >
            Start CV strategy
          </Link>
        </div>
      </Panel>
    );
  }

  return (
    <div className="grid gap-gb-2xl md:grid-cols-2">
      <Panel>
        <PanelHeader
          title="CV"
          description={
            cvDetail.updatedAt
              ? `Last updated ${formatDate(cvDetail.updatedAt)}`
              : 'Not started'
          }
          aside={<StatusPill status={cvStatusValue} />}
        />

        <dl className="flex flex-col gap-gb-md">
          <Row label="Target Profile" value={statusLabel(cvDetail.targetProfile)} />
          <Row label="Content" value={statusLabel(cvDetail.content)} />
          <Row
            label="AI review"
            value={
              cvDetail.reviewOutdated
                ? 'Outdated — CV changed since'
                : statusLabel(cvDetail.review)
            }
            flag={cvDetail.reviewOutdated}
          />
          <Row label="Layout" value={cvDetail.selectedLayout ?? 'Not selected'} />
          <Row
            label="PDF export"
            value={
              cvDetail.exportState === 'none'
                ? 'Not exported'
                : cvDetail.exportState === 'outdated'
                  ? 'Outdated'
                  : 'Current'
            }
            flag={cvDetail.exportState === 'outdated'}
          />
        </dl>

        <Link
          href={cvHref}
          className="mt-gb-2xl inline-flex rounded-gb-md border border-line-strong bg-surface px-gb-xl py-gb-md text-gb-sm font-semibold text-fg-secondary hover:bg-surface-hover"
        >
          {cvActionLabel(cvStatusValue)}
        </Link>
      </Panel>

      <Panel>
        <PanelHeader
          title="Personal statement"
          description={
            statementDetail.lastSavedAt
              ? `Last saved ${formatDate(statementDetail.lastSavedAt)}`
              : 'Not started'
          }
          aside={<StatusPill status={statementStatusValue} />}
        />

        <dl className="flex flex-col gap-gb-md">
          <Row
            label="Length"
            value={
              statementDetail.wordLimit
                ? `${statementDetail.wordCount} of ${statementDetail.wordLimit} words`
                : `${statementDetail.wordCount} words`
            }
          />
          <Row
            label="Last analyzed"
            value={
              statementDetail.lastAnalyzedAt
                ? (formatDate(statementDetail.lastAnalyzedAt) ?? 'Unknown')
                : 'Never'
            }
          />
          <Row
            label="Analysis"
            value={
              statementDetail.analysisOutdated
                ? 'Outdated — draft changed since'
                : statementDetail.lastAnalyzedAt
                  ? 'Current'
                  : 'Not run'
            }
            flag={statementDetail.analysisOutdated}
          />
          <Row
            label="Readiness"
            value={
              statementDetail.readiness === 'ready'
                ? 'Ready for Submit Audit'
                : statementDetail.readiness === 'needs_attention'
                  ? 'Needs attention'
                  : 'Not checked'
            }
            flag={statementDetail.readiness === 'needs_attention'}
          />
        </dl>

        <Link
          href={statementHref}
          className="mt-gb-2xl inline-flex rounded-gb-md border border-line-strong bg-surface px-gb-xl py-gb-md text-gb-sm font-semibold text-fg-secondary hover:bg-surface-hover"
        >
          {statementActionLabel(statementStatusValue)}
        </Link>
      </Panel>
    </div>
  );
}

function Row({ label, value, flag }: { label: string; value: string; flag?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-gb-lg border-b border-line pb-gb-md last:border-0 last:pb-0">
      <dt className="text-gb-sm text-fg-muted">{label}</dt>
      <dd
        className={`text-right text-gb-sm font-medium ${flag ? 'text-fg-brand' : 'text-fg-secondary'}`}
      >
        {value}
      </dd>
    </div>
  );
}
