import { Avatar, Button } from '@/shared/ui';
import {
  cvActionLabel,
  statementActionLabel,
  type StrategyOverview as OverviewData,
} from '../domain';
import { Panel, PanelHeader, PanelRow } from './panel';
import { StatusPill, StatusText } from './status-pill';

/**
 * The Application Strategy entry point.
 *
 * WHAT THIS IS NOT. It is not a dashboard. It answers three questions — which
 * application am I working on, what needs attention, what do I do next — and it
 * shows nothing else. No charts, no aggregate score, no admissions probability.
 * The temptation with two documents and nine sub-statuses is a metrics grid, and
 * the design rules for this feature rule that out explicitly.
 *
 * ONE PRIMARY ACTION. `nextAction` on the server returns a single href/label
 * pair, and only the card it points at renders a primary button; the other gets a
 * secondary. That is why the decision is made in the domain layer rather than by
 * each card looking at its own status — two cards each deciding they are the
 * important one is how you end up with two primary buttons.
 */

export type StrategyOverviewProps = {
  data: OverviewData;
};

export function StrategyOverviewView({ data }: StrategyOverviewProps) {
  const { cvHref, statementHref, next } = data.actions;
  const nextActionHref = next.href;
  const bothEmpty = data.cv.status === 'not_started' && data.statement.status === 'not_started';

  return (
    <div className="flex flex-col gap-gb-4xl">
      <ApplicationContext data={data} />

      {bothEmpty ? (
        <EmptyWorkspace cvHref={cvHref} statementHref={statementHref} />
      ) : (
        <div className="grid gap-gb-2xl md:grid-cols-2">
          <CvWorkspaceCard data={data} href={cvHref} primary={nextActionHref === cvHref} />
          <StatementWorkspaceCard
            data={data}
            href={statementHref}
            primary={nextActionHref === statementHref}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Which application this is.
 *
 * Every value is conditional. The rule is that a missing value is omitted along
 * with its punctuation rather than rendered as a placeholder — the failure being
 * avoided is the "BSc Computer Science ·  · " that a naive join produces when the
 * degree level was never parsed.
 */
function ApplicationContext({ data }: { data: OverviewData }) {
  const { application } = data;
  const meta = [application.degreeLevel, formatDeadline(application.deadline)].filter(
    (v): v is string => Boolean(v),
  );

  return (
    <header className="flex flex-col gap-gb-lg">
      <div className="flex items-start gap-gb-xl">
        {application.universityName ? (
          <Avatar size="lg" name={application.universityName} src={application.universityLogoUrl} />
        ) : null}

        <div className="flex min-w-0 flex-col gap-gb-xxs">
          <h1 className="font-display text-gb-display-sm font-semibold tracking-gb-display-tight text-fg">
            {application.courseName ?? 'Application strategy'}
          </h1>
          {application.universityName ? (
            <p className="text-gb-md text-fg-secondary">{application.universityName}</p>
          ) : null}
          {meta.length > 0 ? (
            <p className="text-gb-sm text-fg-tertiary">{meta.join(' · ')}</p>
          ) : null}
        </div>

        <div className="ml-auto shrink-0">
          <StatusPill status={data.status} />
        </div>
      </div>
    </header>
  );
}

function CvWorkspaceCard({
  data,
  href,
  primary,
}: {
  data: OverviewData;
  href: string;
  primary: boolean;
}) {
  const { cv } = data;

  return (
    <Panel>
      <PanelHeader title="CV" aside={<StatusText status={cv.status} />} />

      <div className="flex flex-col divide-y divide-line">
        <PanelRow label="Target profile">
          <StatusText status={cv.targetProfileStatus} />
        </PanelRow>
        <PanelRow label="Nội dung">
          <StatusText status={cv.contentStatus} />
        </PanelRow>
        <PanelRow label="AI review">
          <StatusText status={cv.reviewStatus} />
        </PanelRow>
        <PanelRow label="Layout">
          {cv.selectedLayout ? layoutLabel(cv.selectedLayout) : 'Not selected'}
        </PanelRow>
        <PanelRow label="PDF">{exportLabel(cv.exportStatus)}</PanelRow>
      </div>

      {cv.updatedAt ? (
        <p className="text-gb-xs text-fg-muted">Last updated {formatDate(cv.updatedAt)}</p>
      ) : null}

      <div>
        <Button href={href} variant={primary ? 'primary' : 'secondary'} size="md">
          {cvActionLabel(cv.status)}
        </Button>
      </div>
    </Panel>
  );
}

function StatementWorkspaceCard({
  data,
  href,
  primary,
}: {
  data: OverviewData;
  href: string;
  primary: boolean;
}) {
  const { statement } = data;

  return (
    <Panel>
      <PanelHeader title="Personal statement" aside={<StatusText status={statement.status} />} />

      <div className="flex flex-col divide-y divide-line">
        <PanelRow label="Words">
          {statement.wordLimit
            ? `${statement.wordCount} of ${statement.wordLimit}`
            : String(statement.wordCount)}
        </PanelRow>
        <PanelRow label="Ý tưởng và Cấu trúc">
          <StatusText status={statement.ideasStatus} />
        </PanelRow>
        <PanelRow label="Mở bài và sức hút">
          <StatusText status={statement.openingStatus} />
        </PanelRow>
        <PanelRow label="Đánh giá AACC">
          <StatusText status={statement.aaccStatus} />
        </PanelRow>
        <PanelRow label="Readiness">
          <StatusText status={statement.readinessStatus} />
        </PanelRow>
      </div>

      <div className="flex flex-col gap-gb-xxs text-gb-xs text-fg-muted">
        {statement.lastSavedAt ? <p>Last saved {formatDate(statement.lastSavedAt)}</p> : null}
        {statement.lastAnalyzedAt ? (
          <p>Last analyzed {formatDate(statement.lastAnalyzedAt)}</p>
        ) : null}
      </div>

      <div>
        <Button href={href} variant={primary ? 'primary' : 'secondary'} size="md">
          {statementActionLabel(statement.status)}
        </Button>
      </div>
    </Panel>
  );
}

/**
 * Nothing started yet.
 *
 * Two actions, one primary. Starting with the CV is the recommended path because
 * the statement brief is built partly from what the CV already covers, so doing
 * the CV first produces a better brief — the same reason `nextAction` breaks the
 * tie towards the CV.
 */
function EmptyWorkspace({ cvHref, statementHref }: { cvHref: string; statementHref: string }) {
  return (
    <Panel className="items-start">
      <PanelHeader
        title="Start with the document you already have"
        description="Start with the document you already have, or create one from your Glowbal profile."
      />
      <div className="flex flex-wrap gap-gb-lg">
        <Button href={cvHref} variant="primary" size="md">
          Start CV
        </Button>
        <Button href={statementHref} variant="secondary" size="md">
          Start statement
        </Button>
      </div>
    </Panel>
  );
}

// ── Formatting ────────────────────────────────────────────────────────────

const LAYOUT_LABEL: Record<string, string> = {
  academic: 'Academic',
  technical: 'Technical',
  leadership: 'Leadership',
};

function layoutLabel(key: string): string {
  return LAYOUT_LABEL[key] ?? key;
}

function exportLabel(status: OverviewData['cv']['exportStatus']): string {
  if (status === 'ready') return 'Ready';
  if (status === 'outdated') return 'Out of date';
  return 'Not generated';
}

/**
 * Dates are formatted with an explicit locale and UTC.
 *
 * `toLocaleDateString()` with no arguments uses the runtime's locale, which
 * differs between the server render and the browser and produces a hydration
 * mismatch. Pinning both is the fix, not suppressing the warning.
 */
function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function formatDeadline(iso: string | null): string | null {
  if (!iso) return null;
  const formatted = formatDate(iso);
  return formatted ? `Deadline ${formatted}` : null;
}
