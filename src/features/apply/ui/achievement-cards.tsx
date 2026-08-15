'use client';

import { ICONS, KitIcon } from '@/shared/ui';
import { questionIcon } from './question-chrome';

/**
 * The compact achievement/activity card — the replacement for the giant
 * inline form each entry used to render as.
 *
 * ─── ONE CARD SHAPE FOR BOTH KINDS ────────────────────────────────────────────
 *
 * An academic achievement and an extracurricular activity carry almost the
 * same seven facts (what, where, when, level, description, source, actions);
 * the two differ only in field names (`competition`/`year` vs `period`) and
 * category vocabulary. `EvidenceCard` renders the shape once; `AchievementCard`
 * and `ActivityCard` below are the two thin adapters, so the two categories can
 * never drift into visually different cards by accident.
 *
 * ─── WHAT A CARD DELIBERATELY DOES NOT SHOW ───────────────────────────────────
 *
 * No badge stack, no colour-coded card background, no more than one metadata
 * line. Six chips of metadata on a 3-column grid is unreadable at a glance,
 * which is the one thing a card exists to be.
 */

export type CardAction = { label: string; onClick: () => void };

export type ReflectAction = {
  label: string;
  onClick: () => void;
  /** Whether an AI Reflection Card already exists — swaps the label/tone. */
  hasCard: boolean;
};

function EvidenceCard({
  icon,
  title,
  organisation,
  metadata,
  description,
  sourceLabel,
  needsReview,
  possibleDuplicate,
  possibleDuplicateLabel,
  onOpen,
  onEdit,
  editLabel,
  onRemove,
  removeLabel,
  onViewSource,
  reflect,
}: {
  icon: string;
  title: string;
  organisation?: string | undefined;
  /** e.g. "2026 · City level" — already composed, so this stays one line. */
  metadata?: string | undefined;
  description?: string | undefined;
  /** "Extracted from {file}" / "Reviewed" / "Added manually" / undefined. */
  sourceLabel?: string | undefined;
  needsReview?: boolean | undefined;
  possibleDuplicate?: boolean | undefined;
  possibleDuplicateLabel?: string | undefined;
  /** Clicking the card body (not an action button) opens the details/edit view. */
  onOpen?: (() => void) | undefined;
  onEdit: () => void;
  editLabel: string;
  onRemove: () => void;
  removeLabel: string;
  onViewSource?: (() => void) | undefined;
  reflect?: ReflectAction | undefined;
}) {
  return (
    <article className="flex flex-col gap-gb-lg rounded-gb-xl border border-line bg-surface p-gb-xl shadow-gb-xs transition-colors hover:border-line-strong">
      <div className="flex items-start gap-gb-lg">
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-gb-full bg-brand-subtle text-fg-brand"
        >
          <KitIcon art={questionIcon(icon)} frame={18} />
        </span>

        <button
          type="button"
          onClick={onOpen ?? onEdit}
          className="min-w-0 flex-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <p className="line-clamp-2 text-gb-sm font-semibold text-fg">{title}</p>
          {organisation ? (
            <p className="mt-gb-xxs truncate text-gb-xs text-fg-tertiary">{organisation}</p>
          ) : null}
        </button>

        <EvidenceCardMenu onEdit={onEdit} editLabel={editLabel} onRemove={onRemove} removeLabel={removeLabel} />
      </div>

      {metadata ? <p className="text-gb-xs text-fg-muted">{metadata}</p> : null}

      {description ? (
        <p className="line-clamp-3 text-gb-sm text-fg-secondary">{description}</p>
      ) : null}

      {possibleDuplicate ? (
        <p className="flex items-center gap-gb-xs text-gb-xs font-medium text-fg-error">
          <KitIcon art={ICONS.messageSmileCircle} frame={13} />
          {possibleDuplicateLabel}
        </p>
      ) : null}

      {reflect ? (
        <button
          type="button"
          onClick={reflect.onClick}
          className={`flex items-center gap-gb-xs self-start text-gb-xs font-semibold hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
            reflect.hasCard ? 'text-fg-secondary' : 'text-fg-brand'
          }`}
        >
          <KitIcon art={reflect.hasCard ? ICONS.checkCircle : ICONS.zap} frame={13} />
          {reflect.label}
        </button>
      ) : null}

      <div className="flex items-center justify-between gap-gb-md pt-gb-xs">
        {sourceLabel ? (
          onViewSource ? (
            <button
              type="button"
              onClick={onViewSource}
              className="flex items-center gap-gb-xs text-gb-xs font-medium text-fg-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <KitIcon art={needsReview ? ICONS.zap : ICONS.checkCircle} frame={13} />
              {sourceLabel}
            </button>
          ) : (
            <span className="flex items-center gap-gb-xs text-gb-xs font-medium text-fg-tertiary">
              <KitIcon art={needsReview ? ICONS.zap : ICONS.checkCircle} frame={13} />
              {sourceLabel}
            </span>
          )
        ) : (
          <span />
        )}
      </div>
    </article>
  );
}

/** The edit/remove overflow — the two actions every card offers. */
function EvidenceCardMenu({
  onEdit,
  editLabel,
  onRemove,
  removeLabel,
}: {
  onEdit: () => void;
  editLabel: string;
  onRemove: () => void;
  removeLabel: string;
}) {
  return (
    <div className="flex shrink-0 items-center gap-gb-xxs">
      <button
        type="button"
        onClick={onEdit}
        aria-label={editLabel}
        title={editLabel}
        className="rounded-gb-sm p-gb-xs text-fg-muted hover:bg-surface-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <KitIcon art={ICONS.edit02} frame={16} />
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label={removeLabel}
        title={removeLabel}
        className="rounded-gb-sm p-gb-xs text-fg-muted hover:bg-surface-muted hover:text-fg-error focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <KitIcon art={ICONS.trash} frame={16} />
      </button>
    </div>
  );
}

type SourceLabels = {
  extractedFrom: (fileName: string) => string;
  addedManually: string;
  needsReview: string;
  reviewed: string;
  possibleDuplicate: string;
};

/**
 * The one bottom-left label the spec asks for — "Extracted from {file}" while
 * unreviewed, "Reviewed" once confirmed, "Added manually" for a typed entry.
 * One function so the two card adapters below cannot state this rule two
 * different ways.
 */
function sourceLabelFor(
  item: { sourceType?: 'document' | 'manual' | undefined; reviewStatus?: 'needs_review' | 'reviewed' | undefined; sources?: ReadonlyArray<{ fileName: string }> | undefined },
  labels: SourceLabels,
): string | undefined {
  if (item.sourceType === 'manual') return labels.addedManually;
  if (item.sourceType !== 'document') return undefined;
  if (item.reviewStatus !== 'needs_review') return labels.reviewed;
  const fileName = item.sources?.[0]?.fileName;
  return fileName ? labels.extractedFrom(fileName) : labels.needsReview;
}

export type AchievementCardValue = {
  id?: string | undefined;
  category: string;
  title: string;
  competition?: string | undefined;
  organisation?: string | undefined;
  level?: string | undefined;
  year?: number | undefined;
  detail?: string | undefined;
  reviewStatus?: 'needs_review' | 'reviewed' | undefined;
  sourceType?: 'document' | 'manual' | undefined;
  sources?: ReadonlyArray<{ fileName: string }> | undefined;
};

export function AchievementCard({
  item,
  icon,
  possibleDuplicate,
  labels,
  onEdit,
  onRemove,
  onViewSource,
  reflect,
}: {
  item: AchievementCardValue;
  icon: string;
  possibleDuplicate?: boolean | undefined;
  labels: SourceLabels & {
    edit: (title: string) => string;
    remove: (title: string) => string;
  };
  onEdit: () => void;
  onRemove: () => void;
  onViewSource?: (() => void) | undefined;
  reflect?: ReflectAction | undefined;
}) {
  const metadata = [item.year ? String(item.year) : null, item.level ?? null]
    .filter(Boolean)
    .join(' · ');
  const needsReview = item.reviewStatus === 'needs_review';

  return (
    <EvidenceCard
      icon={icon}
      title={item.title}
      organisation={item.competition ?? item.organisation}
      metadata={metadata || undefined}
      description={item.detail}
      sourceLabel={sourceLabelFor(item, labels)}
      needsReview={needsReview}
      possibleDuplicate={possibleDuplicate}
      possibleDuplicateLabel={labels.possibleDuplicate}
      onEdit={onEdit}
      editLabel={labels.edit(item.title)}
      onRemove={onRemove}
      removeLabel={labels.remove(item.title)}
      {...(onViewSource ? { onViewSource } : {})}
      {...(reflect ? { reflect } : {})}
    />
  );
}

export type ActivityCardValue = {
  id?: string | undefined;
  category: string;
  title: string;
  organisation?: string | undefined;
  level?: string | undefined;
  period?: string | undefined;
  description?: string | undefined;
  reviewStatus?: 'needs_review' | 'reviewed' | undefined;
  sourceType?: 'document' | 'manual' | undefined;
  sources?: ReadonlyArray<{ fileName: string }> | undefined;
};

export function ActivityCard({
  item,
  icon,
  possibleDuplicate,
  labels,
  onEdit,
  onRemove,
  onViewSource,
  reflect,
}: {
  item: ActivityCardValue;
  icon: string;
  possibleDuplicate?: boolean | undefined;
  labels: SourceLabels & {
    edit: (title: string) => string;
    remove: (title: string) => string;
  };
  onEdit: () => void;
  onRemove: () => void;
  onViewSource?: (() => void) | undefined;
  reflect?: ReflectAction | undefined;
}) {
  const metadata = [item.period ?? null, item.level ?? null].filter(Boolean).join(' · ');
  const needsReview = item.reviewStatus === 'needs_review';

  return (
    <EvidenceCard
      icon={icon}
      title={item.title}
      organisation={item.organisation}
      metadata={metadata || undefined}
      description={item.description}
      sourceLabel={sourceLabelFor(item, labels)}
      needsReview={needsReview}
      possibleDuplicate={possibleDuplicate}
      possibleDuplicateLabel={labels.possibleDuplicate}
      onEdit={onEdit}
      editLabel={labels.edit(item.title)}
      onRemove={onRemove}
      removeLabel={labels.remove(item.title)}
      {...(onViewSource ? { onViewSource } : {})}
      {...(reflect ? { reflect } : {})}
    />
  );
}
