'use client';

import { useState } from 'react';
import type {
  AdminAiReportInputSection,
  AdminAiReportReview,
  AdminAiReportReviewListItem,
  AdminAiReportReviewNode,
} from '@/features/ai-strategy-dashboard/api';
import { PERSONAL_REFLECTION_QUESTIONS } from '@/features/apply/domain';
import { Badge, type BadgeVariant, ICONS, KitIcon, Panel, PanelHeader } from '@/shared/ui';

type DetailState =
  | { kind: 'ready'; review: AdminAiReportReview | null }
  | { kind: 'loading'; review: AdminAiReportReview | null }
  | { kind: 'error'; review: AdminAiReportReview | null; message: string };

type RecordValue = Record<string, unknown>;

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function firstAvailableNode(review: AdminAiReportReview | null): string | null {
  return review?.nodes.find((node) => node.available)?.id ?? null;
}

function humanize(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function scalar(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return null;
}

function isNarrativeKey(key: string): boolean {
  if (
    /confidence|status|rating|alignment|score|count|level|tier|category|coverage|date|at$|index|version/i.test(
      key
    )
  ) {
    return false;
  }
  return /summary|description|statement|narrative|rationale|headline|overview|notes|takeaway|takeaways|quote|citation|prompt|answer|context|action|result|learning|story|detail/i.test(
    key
  );
}

function isIdentityKey(key: string): boolean {
  if (/^id$/i.test(key)) return true;
  if (/(^id$|[a-z0-9]Id$|_id$|_ids$|ids$|refs$|hash$|schemaVersion|createdAt|confirmedAt)/.test(key)) return true;
  if (/(documentId|snapshotId|applicationId|analysisId|evidenceId|profileId|activityId|userId|programmeId|universityId)/i.test(key)) return true;
  return false;
}

function getBadgeVariant(key: string, val: string): BadgeVariant {
  const lower = val.toLowerCase().trim();
  if (
    lower.includes('established') ||
    lower === 'high' ||
    lower === 'comprehensive' ||
    lower === 'complete' ||
    lower === 'safe' ||
    lower === 'persisted' ||
    lower === 'ready' ||
    lower === 'confirmed'
  ) {
    return 'safe-chip';
  }
  if (
    lower.includes('strong_emerging') ||
    lower.includes('emerging') ||
    lower === 'medium' ||
    lower === 'moderate' ||
    lower === 'recommend' ||
    lower === 'in_progress'
  ) {
    return 'info-chip';
  }
  if (
    lower.includes('possible') ||
    lower.includes('early_signal') ||
    lower === 'low' ||
    lower === 'reach' ||
    lower === 'pending'
  ) {
    return 'brand-chip';
  }
  return 'neutral-chip';
}

function renderScalarValue(key: string, val: string) {
  const isStatusOrRating = /status|rating|alignment|classification|kind|tier|coverage|category|level/i.test(key);
  const isConfidence = /confidence/i.test(key);

  if (isConfidence) {
    const num = Number(val);
    if (!Number.isNaN(num) && num >= 0 && num <= 1) {
      const pct = Math.round(num * 100);
      const variant: BadgeVariant = num >= 0.8 ? 'safe-chip' : num >= 0.5 ? 'info-chip' : 'brand-chip';
      return (
        <div className="flex items-center gap-gb-xs">
          <Badge variant={variant}>{pct}%</Badge>
          <span className="text-gb-xs text-fg-muted font-mono">({val})</span>
        </div>
      );
    }
    return <Badge variant={getBadgeVariant('confidence', val)}>{humanize(val)}</Badge>;
  }

  if (isStatusOrRating) {
    return <Badge variant={getBadgeVariant(key, val)}>{humanize(val)}</Badge>;
  }

  if (/date|generatedAt|createdAt|timestamp/i.test(key) && !Number.isNaN(Date.parse(val))) {
    return <span className="font-mono text-gb-xs text-fg-secondary">{formatDate(val)}</span>;
  }

  return <span>{val}</span>;
}

function SourcesCitationList({ sources }: { sources: unknown[] }) {
  const list = sources.filter((s): s is RecordValue => Boolean(s && typeof s === 'object'));
  if (!list.length) return null;

  return (
    <div className="flex flex-col gap-gb-xs min-w-0">
      <span className="text-gb-xs font-semibold uppercase tracking-wider text-fg-muted">
        Verified Sources ({list.length})
      </span>
      <div className="flex flex-col gap-gb-xs min-w-0">
        {list.map((src, idx) => {
          const fileName = scalar(src.fileName);
          const page = scalar(src.page);
          const quote = scalar(src.quote);
          return (
            <div
              key={idx}
              className="rounded-gb-lg border border-line bg-surface p-gb-sm flex flex-col gap-gb-xs min-w-0"
            >
              <div className="flex flex-wrap items-center justify-between gap-gb-xs min-w-0">
                <div className="flex items-center gap-gb-xs font-medium text-fg min-w-0 truncate text-gb-xs">
                  <span className="shrink-0 text-fg-muted" aria-hidden="true">📄</span>
                  <span className="truncate font-medium" title={fileName ?? 'Document'}>
                    {fileName ?? 'Document'}
                  </span>
                </div>
                {page ? (
                  <span className="rounded-full bg-surface-muted px-gb-sm py-gb-xxs font-mono text-gb-xxs text-fg-secondary shrink-0">
                    Page {page}
                  </span>
                ) : null}
              </div>
              {quote ? (
                <blockquote className="border-l-2 border-brand/50 pl-gb-sm italic text-fg-secondary text-gb-xs leading-relaxed break-words">
                  &ldquo;{quote}&rdquo;
                </blockquote>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReflectionCallout({
  reflection,
  reflectionCard,
}: {
  reflection?: unknown;
  reflectionCard?: unknown;
}) {
  const refObj = reflection && typeof reflection === 'object' ? (reflection as RecordValue) : null;
  const cardObj = reflectionCard && typeof reflectionCard === 'object' ? (reflectionCard as RecordValue) : null;

  if (!refObj && !cardObj) return null;

  const starFields: [string, string][] = [];
  if (refObj) {
    for (const k of ['context', 'action', 'result', 'learning']) {
      const val = scalar(refObj[k]);
      if (val) starFields.push([k, val]);
    }
  }

  const story = cardObj ? scalar(cardObj.story) : null;
  const takeaways = cardObj ? scalar(cardObj.takeaways) : null;
  const status = cardObj ? scalar(cardObj.status) : null;

  if (!starFields.length && !story && !takeaways && !status) return null;

  return (
    <div className="mt-gb-xs rounded-gb-lg border-l-4 border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/30 p-gb-md flex flex-col gap-gb-sm text-gb-xs min-w-0">
      <div className="flex items-center justify-between gap-gb-xs">
        <div className="flex items-center gap-gb-xs font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
          <span aria-hidden="true">💭</span>
          <span>Student Reflection (Góc suy ngẫm)</span>
        </div>
        {status ? (
          <Badge variant={status === 'confirmed' ? 'safe-chip' : 'neutral-chip'}>
            {humanize(status)}
          </Badge>
        ) : null}
      </div>

      {starFields.length > 0 ? (
        <div className="flex flex-col gap-gb-xs">
          {starFields.map(([field, content]) => (
            <div key={field} className="flex flex-col gap-gb-xxs">
              <span className="font-semibold uppercase tracking-wide text-fg-muted text-gb-xxs">
                {humanize(field)}:
              </span>
              <p className="text-fg leading-relaxed break-words italic pl-gb-xs border-l border-indigo-200 dark:border-indigo-800">
                {content}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {story ? (
        <div className="flex flex-col gap-gb-xxs">
          <span className="font-semibold uppercase tracking-wide text-fg-muted text-gb-xxs">
            Confirmed Story:
          </span>
          <p className="text-fg leading-relaxed break-words">{story}</p>
        </div>
      ) : null}

      {takeaways ? (
        <div className="flex flex-col gap-gb-xxs">
          <span className="font-semibold uppercase tracking-wide text-fg-muted text-gb-xxs">
            Key Takeaways:
          </span>
          <p className="text-fg leading-relaxed break-words">{takeaways}</p>
        </div>
      ) : null}
    </div>
  );
}

function ObjectItemCard({ item, omitIdentity }: { item: RecordValue; omitIdentity?: boolean }) {
  const rawTitle = scalar(item.name ?? item.title ?? item.headline ?? item.label ?? item.theme);
  const rawStatus = scalar(item.status ?? item.alignment ?? item.classification);
  const rawConfidence = item.confidence ?? item.confidenceScore;
  const count = scalar(item.evidenceCount ?? item.count);

  const title = rawTitle ? humanize(rawTitle) : null;
  const status = rawStatus ? humanize(rawStatus) : null;

  const sources = Array.isArray(item.sources) ? item.sources : null;
  const hasReflection = Boolean(item.reflection || item.reflectionCard);

  const entries = Object.entries(item).filter(([k]) => {
    if (omitIdentity && isIdentityKey(k)) {
      return false;
    }
    if (rawTitle && /(^name$|^title$|^headline$|^theme$)/i.test(k)) return false;
    if (rawStatus && /(^status$|^alignment$|^classification$)/i.test(k)) return false;
    if (rawConfidence !== undefined && /confidence/i.test(k)) return false;
    if (count && /(^evidenceCount$|^count$)/i.test(k)) return false;
    if (sources && k === 'sources') return false;
    if (hasReflection && (k === 'reflection' || k === 'reflectionCard')) return false;
    return true;
  });

  return (
    <div className="rounded-gb-xl border border-line bg-surface-subtle/40 p-gb-lg hover:border-line-strong transition-colors flex flex-col gap-gb-sm min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-gb-xs min-w-0">
        <h4 className="font-semibold text-gb-sm text-fg break-words min-w-0">
          {title ?? 'Item'}
        </h4>
        <div className="flex flex-wrap items-center gap-gb-xs shrink-0">
          {status ? (
            <Badge variant={getBadgeVariant('status', status)}>{status}</Badge>
          ) : null}
          {typeof rawConfidence === 'number' ? (
            <Badge variant={rawConfidence >= 0.8 ? 'safe-chip' : rawConfidence >= 0.5 ? 'info-chip' : 'brand-chip'}>
              {Math.round(rawConfidence * 100)}% conf
            </Badge>
          ) : scalar(rawConfidence) ? (
            <Badge variant="neutral-chip">{scalar(rawConfidence)}</Badge>
          ) : null}
          {count ? (
            <span className="rounded-full bg-surface border border-line px-gb-sm py-gb-xxs text-gb-xs text-fg-muted font-medium">
              {count} evidence
            </span>
          ) : null}
        </div>
      </div>

      {entries.length > 0 ? (
        <div className="mt-gb-xs border-t border-line/40 pt-gb-sm min-w-0">
          <StructuredDataView value={Object.fromEntries(entries)} omitIdentity={omitIdentity} depth={2} />
        </div>
      ) : null}

      {sources && sources.length > 0 ? (
        <div className="mt-gb-xs border-t border-line/40 pt-gb-sm min-w-0">
          <SourcesCitationList sources={sources} />
        </div>
      ) : null}

      {hasReflection ? (
        <ReflectionCallout reflection={item.reflection} reflectionCard={item.reflectionCard} />
      ) : null}
    </div>
  );
}

function ValueList({ values, omitIdentity }: { values: unknown[]; omitIdentity?: boolean }) {
  if (!values.length) return <span className="text-fg-muted">Not available</span>;
  return (
    <ul className="flex list-disc flex-col gap-gb-xs pl-gb-xl">
      {values.map((value, index) => (
        <li key={index}>
          <StructuredDataView value={value} omitIdentity={omitIdentity} depth={2} />
        </li>
      ))}
    </ul>
  );
}

function StructuredDataView({
  value,
  omitIdentity = false,
  depth = 0,
}: {
  value: unknown;
  omitIdentity?: boolean;
  depth?: number;
}) {
  const text = scalar(value);
  if (text !== null) return <span>{text}</span>;
  if (value === null || value === undefined) return <span className="text-fg-muted">Not available</span>;
  if (Array.isArray(value)) return <ValueList values={value} omitIdentity={omitIdentity} />;
  if (typeof value !== 'object') return <span>{String(value)}</span>;

  let targetValue = value as RecordValue;
  // If top-level object contains a 'report' object wrapper, unwrap it for cleaner hierarchy
  if (
    depth === 0 &&
    'report' in targetValue &&
    targetValue.report !== null &&
    typeof targetValue.report === 'object' &&
    !Array.isArray(targetValue.report)
  ) {
    const reportObj = targetValue.report as RecordValue;
    const companionKeys = Object.keys(targetValue).filter(
      (k) => k !== 'report' && !isIdentityKey(k)
    );
    if (companionKeys.length === 0) {
      targetValue = reportObj;
    } else {
      targetValue = {
        ...companionKeys.reduce<RecordValue>((acc, k) => {
          acc[k] = targetValue[k];
          return acc;
        }, {}),
        ...reportObj,
      };
    }
  }

  const entries = Object.entries(targetValue).filter(
    ([key]) => !omitIdentity || !isIdentityKey(key)
  );

  if (!entries.length) return <span className="text-fg-muted">No human-readable value persisted</span>;

  // At depth 0, separate top-level scalars/narratives into an Overview card and render complex children as section cards
  if (depth === 0) {
    const topNarratives: [string, string][] = [];
    const topScalars: [string, string][] = [];
    const topSections: [string, unknown][] = [];

    for (const [k, child] of entries) {
      const s = scalar(child);
      if (s !== null) {
        if (isNarrativeKey(k) || (typeof child === 'string' && child.length > 60 && child.includes(' '))) {
          topNarratives.push([k, s]);
        } else {
          topScalars.push([k, s]);
        }
      } else {
        topSections.push([k, child]);
      }
    }

    return (
      <div className="flex flex-col gap-gb-xl">
        {topNarratives.length > 0 || topScalars.length > 0 ? (
          <section className="rounded-gb-xl border border-line bg-surface p-gb-xl shadow-gb-xs flex flex-col gap-gb-lg">
            <div className="flex items-center justify-between border-b border-line pb-gb-md">
              <h3 className="font-display text-gb-md font-semibold text-fg tracking-tight">
                Report Overview
              </h3>
            </div>
            {topNarratives.map(([k, v]) => (
              <div
                key={k}
                className="rounded-gb-lg border-l-4 border-brand bg-brand-subtle/30 p-gb-lg text-gb-sm leading-relaxed text-fg min-w-0"
              >
                <span className="block text-gb-xs font-semibold uppercase tracking-wider text-fg-brand mb-gb-xs">
                  {humanize(k)}
                </span>
                <p className="text-gb-sm leading-relaxed text-fg break-words">{v}</p>
              </div>
            ))}
            {topScalars.length > 0 ? (
              <dl className="grid gap-gb-sm grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
                {topScalars.map(([k, v]) => (
                  <div
                    key={k}
                    className="rounded-gb-lg border border-line/70 bg-surface-subtle/60 p-gb-md flex flex-col gap-gb-xs min-w-0"
                  >
                    <dt
                      className="text-gb-xs font-semibold uppercase tracking-wider text-fg-muted truncate"
                      title={humanize(k)}
                    >
                      {humanize(k)}
                    </dt>
                    <dd className="text-gb-sm font-semibold text-fg min-w-0 break-words">
                      {renderScalarValue(k, v)}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </section>
        ) : null}

        {topSections.map(([key, child]) => (
          <section
            key={key}
            className="rounded-gb-xl border border-line bg-surface p-gb-xl shadow-gb-xs flex flex-col gap-gb-lg"
          >
            <div className="flex items-center justify-between border-b border-line pb-gb-md">
              <h3 className="font-display text-gb-md font-semibold text-fg tracking-tight">
                {humanize(key)}
              </h3>
            </div>
            <div>
              <StructuredDataView value={child} omitIdentity={omitIdentity} depth={1} />
            </div>
          </section>
        ))}
      </div>
    );
  }

  // Partition entries for structured layout at depth >= 1
  const narratives: [string, string][] = [];
  const scalars: [string, string][] = [];
  const arrays: [string, unknown[]][] = [];
  const objects: [string, RecordValue][] = [];

  for (const [key, child] of entries) {
    const s = scalar(child);
    if (s !== null) {
      if (isNarrativeKey(key) || (typeof child === 'string' && child.length > 60 && child.includes(' '))) {
        narratives.push([key, s]);
      } else {
        scalars.push([key, s]);
      }
    } else if (Array.isArray(child)) {
      arrays.push([key, child]);
    } else if (child && typeof child === 'object') {
      objects.push([key, child as RecordValue]);
    }
  }

  return (
    <div className="flex flex-col gap-gb-lg min-w-0">
      {/* 1. Narrative Callouts */}
      {narratives.map(([k, v]) => (
        <div
          key={k}
          className="rounded-gb-lg border-l-4 border-brand bg-brand-subtle/30 p-gb-lg text-gb-sm leading-relaxed text-fg min-w-0"
        >
          <span className="block text-gb-xs font-semibold uppercase tracking-wider text-fg-brand mb-gb-xs">
            {humanize(k)}
          </span>
          <p className="text-gb-sm leading-relaxed text-fg break-words">{v}</p>
        </div>
      ))}

      {/* 2. KPI / Scalar Metric Tiles */}
      {scalars.length > 0 ? (
        <dl
          className={`grid gap-gb-sm ${
            depth >= 2
              ? 'grid-cols-1 sm:grid-cols-2'
              : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
          }`}
        >
          {scalars.map(([k, v]) => (
            <div
              key={k}
              className="rounded-gb-lg border border-line/70 bg-surface-subtle/60 p-gb-md flex flex-col gap-gb-xs min-w-0"
            >
              <dt
                className="text-gb-xs font-semibold uppercase tracking-wider text-fg-muted truncate"
                title={humanize(k)}
              >
                {humanize(k)}
              </dt>
              <dd className="text-gb-sm font-semibold text-fg min-w-0 break-words">
                {renderScalarValue(k, v)}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      {/* 3. Arrays */}
      {arrays.map(([k, items]) => {
        if (!items.length) {
          return (
            <div key={k} className="text-gb-xs text-fg-muted">
              <span className="font-semibold">{humanize(k)}:</span> Not available
            </div>
          );
        }

        if (k === 'sources') {
          return <SourcesCitationList key={k} sources={items} />;
        }

        const isAllObjects = items.every((it) => it && typeof it === 'object' && !Array.isArray(it));
        if (isAllObjects) {
          const icon = k === 'achievements' ? '🏆 ' : k === 'activities' ? '🎯 ' : '';
          return (
            <div key={k} className="flex flex-col gap-gb-sm min-w-0">
              <div className="flex items-center justify-between">
                <h4 className="text-gb-sm font-semibold text-fg">
                  {icon}
                  {humanize(k)}
                </h4>
                <span className="rounded-full bg-surface-muted px-gb-md py-gb-xxs text-gb-xs font-medium text-fg-muted">
                  {items.length} {items.length === 1 ? 'item' : 'items'}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-gb-md">
                {items.map((item, idx) => (
                  <ObjectItemCard key={idx} item={item as RecordValue} omitIdentity={omitIdentity} />
                ))}
              </div>
            </div>
          );
        }

        const isAllScalars = items.every((it) => scalar(it) !== null);
        if (isAllScalars) {
          if (items.length > 4) {
            return (
              <details
                key={k}
                className="group rounded-gb-lg border border-line bg-surface-subtle/30 p-gb-md"
              >
                <summary className="flex cursor-pointer items-center justify-between font-semibold text-gb-sm text-fg select-none">
                  <span className="flex items-center gap-gb-xs">
                    <span className="text-fg-muted group-open:rotate-90 transition-transform text-gb-xs">
                      ▶
                    </span>
                    <span>{humanize(k)}</span>
                  </span>
                  <span className="rounded-full bg-surface-muted px-gb-md py-gb-xxs text-gb-xs font-medium text-fg-muted">
                    {items.length} items
                  </span>
                </summary>
                <div className="mt-gb-md flex flex-wrap gap-gb-xs pt-gb-sm border-t border-line/50">
                  {items.map((item, idx) => (
                    <span
                      key={idx}
                      className="rounded-full border border-line bg-surface px-gb-sm py-gb-xxs text-gb-xs font-mono text-fg-secondary"
                    >
                      {String(item)}
                    </span>
                  ))}
                </div>
              </details>
            );
          }

          return (
            <div key={k} className="flex flex-col gap-gb-xs">
              <span className="text-gb-xs font-semibold uppercase tracking-wider text-fg-muted">
                {humanize(k)}
              </span>
              <div className="flex flex-wrap gap-gb-xs">
                {items.map((item, idx) => (
                  <span
                    key={idx}
                    className="rounded-full border border-line bg-surface-subtle px-gb-sm py-gb-xxs text-gb-xs text-fg-secondary"
                  >
                    {String(item)}
                  </span>
                ))}
              </div>
            </div>
          );
        }

        return (
          <div key={k} className="flex flex-col gap-gb-xs">
            <span className="text-gb-xs font-semibold uppercase tracking-wider text-fg-muted">
              {humanize(k)}
            </span>
            <ValueList values={items} omitIdentity={omitIdentity} />
          </div>
        );
      })}

      {/* 4. Nested Objects */}
      {objects.map(([k, obj]) => (
        <div
          key={k}
          className="rounded-gb-lg border border-line bg-surface-subtle/20 p-gb-lg flex flex-col gap-gb-md"
        >
          <h4 className="text-gb-sm font-semibold text-fg">{humanize(k)}</h4>
          <StructuredDataView value={obj} omitIdentity={omitIdentity} depth={depth + 1} />
        </div>
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-gb-xl border border-line bg-surface p-gb-xl shadow-gb-xs flex flex-col gap-gb-lg">
      <div className="flex items-center justify-between border-b border-line pb-gb-md">
        <h3 className="font-display text-gb-md font-semibold text-fg tracking-tight">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function PersonalRenderer({ output }: { output: RecordValue }) {
  const sections = [
    ['Core Identity', output.coreIdentity],
    ['Driving Force', output.drivingForce],
    ['Signature Pattern', output.signaturePattern],
    ['Emerging Themes', output.emergingThemes],
    ['Personal Positioning', output.personalPositioning],
    ['Proof of Me', output.proofOfMe],
  ] as const;

  return (
    <div className="flex flex-col gap-gb-xl">
      {scalar(output.overallSummary) ? (
        <section className="rounded-gb-xl border border-line bg-surface p-gb-xl shadow-gb-xs flex flex-col gap-gb-md">
          <div className="flex items-center justify-between border-b border-line pb-gb-md">
            <h3 className="font-display text-gb-md font-semibold text-fg tracking-tight">Overall summary</h3>
          </div>
          <div className="rounded-gb-lg border-l-4 border-brand bg-brand-subtle/30 p-gb-lg text-gb-sm leading-relaxed text-fg">
            {scalar(output.overallSummary)}
          </div>
        </section>
      ) : null}
      {sections.map(([title, value]) =>
        value ? (
          <Section key={title} title={title}>
            <StructuredDataView value={value} depth={1} />
          </Section>
        ) : null
      )}
    </div>
  );
}

function ReferenceList({
  ids,
  evidence,
  targets,
}: {
  ids: unknown;
  evidence: RecordValue[];
  targets: RecordValue[];
}) {
  const values = Array.isArray(ids) ? ids : [];
  if (!values.length) return null;
  const flatIds = values
    .flatMap((id) => (Array.isArray(id) ? id : [id]))
    .filter((id): id is string | number => typeof id === 'string' || typeof id === 'number');

  if (!flatIds.length) return null;

  return (
    <div className="flex flex-wrap gap-gb-xs items-center mt-gb-xs">
      <span className="text-gb-xs font-semibold uppercase tracking-wider text-fg-muted mr-gb-xs">
        References:
      </span>
      {flatIds.map((id) => {
        const key = String(id);
        const match = evidence.find((item) => item.id === key) ?? targets.find((item) => item.ref === key);
        return (
          <span
            key={key}
            className="rounded-full border border-line bg-surface-subtle px-gb-sm py-gb-xxs text-gb-xs text-fg-secondary"
          >
            {scalar(match?.label ?? match?.title) ?? humanize(key)}
          </span>
        );
      })}
    </div>
  );
}

function MatchingRenderer({ output }: { output: RecordValue }) {
  const evidence = Array.isArray(output.evidenceIndex) ? (output.evidenceIndex as RecordValue[]) : [];
  const targets = Array.isArray(output.targetSourceIndex) ? (output.targetSourceIndex as RecordValue[]) : [];
  const overall = output.overall as RecordValue | undefined;
  const groups = [
    ['University fit', output.universityFit],
    ['Programme fit', output.programmeFit],
    ['Hard requirements', output.hardRequirements ?? output.academicRequirements],
    ['Strengths', output.strengths],
    ['Gaps', output.gaps],
    ['Positioning opportunities', output.positioningOpportunities],
    ['Scholarship alignment', output.scholarshipAlignment],
  ] as const;

  return (
    <div className="flex flex-col gap-gb-xl">
      <Section title="Overall assessment">
        <StructuredDataView value={overall} depth={1} />
        <ReferenceList
          ids={overall?.summaryEvidenceIds ?? overall?.summaryTargetSourceRefs}
          evidence={evidence}
          targets={targets}
        />
      </Section>
      {output.keyTakeaways ? (
        <Section title="Key takeaways">
          <StructuredDataView value={output.keyTakeaways} depth={1} />
        </Section>
      ) : null}
      {groups.map(([title, value]) =>
        value ? (
          <Section key={title} title={title}>
            <StructuredDataView value={value} depth={1} />
            <ReferenceList
              ids={
                Array.isArray(value)
                  ? value.flatMap((item) =>
                      item && typeof item === 'object'
                        ? [(item as RecordValue).evidenceIds, (item as RecordValue).targetSourceRefs]
                        : []
                    )
                  : undefined
              }
              evidence={evidence}
              targets={targets}
            />
          </Section>
        ) : null
      )}
      <Section title="Evidence & sources">
        <details className="group rounded-gb-lg border border-line bg-surface-subtle/30 p-gb-md">
          <summary className="flex cursor-pointer items-center justify-between font-semibold text-gb-sm text-fg select-none">
            <span className="flex items-center gap-gb-xs">
              <span className="text-fg-muted group-open:rotate-90 transition-transform text-gb-xs">▶</span>
              <span>Evidence & sources index</span>
            </span>
            <span className="rounded-full bg-surface-muted px-gb-md py-gb-xxs text-gb-xs font-medium text-fg-muted">
              {evidence.length} evidence · {targets.length} sources
            </span>
          </summary>
          <div className="mt-gb-md flex flex-col gap-gb-lg border-t border-line/50 pt-gb-md">
            <StructuredDataView value={evidence} depth={1} />
            <StructuredDataView value={targets} depth={1} />
          </div>
        </details>
      </Section>
    </div>
  );
}

function StrategyRenderer({ output }: { output: RecordValue }) {
  const overview = output.strategicOverview as RecordValue | undefined;
  const profile = output.profileDevelopmentStrategy as RecordValue | undefined;
  const roadmap = Array.isArray(output.strategicRoadmap) ? output.strategicRoadmap : [];
  const priorities = Array.isArray(overview?.topPriorities)
    ? overview.topPriorities.map((priority) => {
        const item = priority as RecordValue;
        const factors =
          item.factors && typeof item.factors === 'object' ? { ...(item.factors as RecordValue) } : null;
        if (factors) delete factors.rawPriority;
        return { ...item, ...(factors ? { factors } : {}) };
      })
    : null;
  const activities = Array.isArray(profile?.activityAnalyses) ? profile.activityAnalyses : [];

  return (
    <div className="flex flex-col gap-gb-xl">
      <Section title="Strategic overview">
        <StructuredDataView value={overview} depth={1} />
      </Section>
      <Section title="Priorities">
        <StructuredDataView value={priorities} depth={1} />
      </Section>
      <Section title="Profile development">
        <StructuredDataView value={profile?.areas} depth={1} />
      </Section>
      <Section title="Activities">
        <div className="flex flex-col gap-gb-sm">
          {activities.length ? (
            activities.map((activity, index) => (
              <details key={index} className="group rounded-gb-xl border border-line bg-surface-subtle/30 p-gb-lg">
                <summary className="cursor-pointer font-semibold text-fg flex items-center justify-between">
                  <span>{String((activity as RecordValue).title ?? `Activity ${index + 1}`)}</span>
                  <span className="text-fg-muted group-open:rotate-90 transition-transform text-gb-xs">▶</span>
                </summary>
                <div className="mt-gb-md border-t border-line/40 pt-gb-md">
                  <StructuredDataView value={activity} depth={2} />
                </div>
              </details>
            ))
          ) : (
            <span className="text-fg-muted">Not available</span>
          )}
        </div>
      </Section>
      <Section title="Narrative strategy">
        <StructuredDataView value={output.narrativeStrategy} depth={1} />
      </Section>
      <Section title="Four-phase roadmap">
        <div className="grid gap-gb-md md:grid-cols-2">
          {roadmap.map((phase, index) => (
            <details key={index} className="group rounded-gb-xl border border-line bg-surface-subtle/30 p-gb-lg">
              <summary className="cursor-pointer font-semibold text-fg flex items-center justify-between">
                <span>
                  {humanize(
                    String(
                      (phase as RecordValue).name ??
                        (phase as RecordValue).phaseKey ??
                        `Phase ${index + 1}`
                    )
                  )}
                </span>
                <span className="text-fg-muted group-open:rotate-90 transition-transform text-gb-xs">▶</span>
              </summary>
              <div className="mt-gb-md border-t border-line/40 pt-gb-md">
                <StructuredDataView value={phase} depth={2} />
              </div>
            </details>
          ))}
        </div>
      </Section>
      <Section title="Evidence & sources">
        <details className="group rounded-gb-xl border border-line bg-surface-subtle/30 p-gb-md">
          <summary className="cursor-pointer font-semibold text-gb-sm text-fg flex items-center justify-between">
            <span>Show evidence index</span>
            <span className="text-fg-muted group-open:rotate-90 transition-transform text-gb-xs">▶</span>
          </summary>
          <div className="mt-gb-md border-t border-line/40 pt-gb-md">
            <StructuredDataView
              value={{ evidence: output.evidenceIndex, sources: output.targetSourceIndex }}
              depth={1}
            />
          </div>
        </details>
      </Section>
    </div>
  );
}

function LegacyRenderer({ output }: { output: unknown }) {
  return (
    <div className="flex flex-col gap-gb-xl">
      <div className="rounded-gb-xl border border-amber-300/80 dark:border-amber-700/60 bg-gradient-to-r from-amber-50 to-amber-100/40 dark:from-amber-950/40 dark:to-amber-900/20 p-gb-lg shadow-gb-xxs flex items-start gap-gb-md">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-gb-lg bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
          <KitIcon art={ICONS.zap} frame={18} className="text-amber-600 dark:text-amber-400" />
        </div>
        <div className="flex flex-col gap-gb-xxs min-w-0">
          <div className="flex items-center gap-gb-xs flex-wrap">
            <span className="font-semibold text-gb-sm text-amber-950 dark:text-amber-100">
              Legacy or partially validated output
            </span>
            <span className="rounded-full bg-amber-200/80 dark:bg-amber-800/60 px-gb-xs py-gb-xxs text-gb-xxs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200">
              Notice
            </span>
          </div>
          <p className="text-gb-xs text-amber-900 dark:text-amber-200/90 leading-relaxed font-medium">
            The report contract is older or contains historical references that no longer validate. The stored content is shown below in a readable form; raw JSON remains available in Technical.
          </p>
        </div>
      </div>
      <StructuredDataView value={output} />
    </div>
  );
}

function OutputRenderer({ node }: { node: AdminAiReportReviewNode }) {
  if (!node.available || node.output === null) {
    return <p className="text-gb-sm text-fg-muted">No report generated yet.</p>;
  }
  if (node.outputFormat === 'personal_report_v2') {
    return <PersonalRenderer output={node.output as RecordValue} />;
  }
  if (node.outputFormat === 'matching_report_v3' || node.outputFormat === 'matching_report_v2') {
    return <MatchingRenderer output={node.output as RecordValue} />;
  }
  if (node.outputFormat === 'strategy_report_v3') {
    return <StrategyRenderer output={node.output as RecordValue} />;
  }
  return <LegacyRenderer output={node.output} />;
}

function PersonalReflectionSection({ answers }: { answers: RecordValue | null }) {
  if (!answers || Object.keys(answers).length === 0) {
    return <span className="text-gb-xs text-fg-muted">No personal reflection answers recorded</span>;
  }

  const items: Array<{ key: string; label: string; heading: string; answer: string }> = [];
  for (const q of PERSONAL_REFLECTION_QUESTIONS) {
    const val = scalar(answers[q.key]);
    if (val) {
      items.push({ key: q.key, label: q.shortLabel, heading: q.heading, answer: val });
    }
  }

  const knownKeys = new Set<string>(PERSONAL_REFLECTION_QUESTIONS.map((q) => q.key));
  for (const [k, v] of Object.entries(answers)) {
    if (!knownKeys.has(k)) {
      const val = scalar(v);
      if (val) {
        items.push({ key: k, label: humanize(k), heading: humanize(k), answer: val });
      }
    }
  }

  if (!items.length) {
    return <span className="text-gb-xs text-fg-muted">No reflection text available</span>;
  }

  return (
    <div className="flex flex-col gap-gb-md min-w-0">
      {items.map((item, idx) => (
        <div
          key={item.key}
          className="rounded-gb-xl border border-line bg-surface-subtle/30 p-gb-lg flex flex-col gap-gb-xs min-w-0"
        >
          <div className="flex items-center justify-between gap-gb-xs">
            <span className="text-gb-xs font-semibold uppercase tracking-wider text-fg-brand">
              Question {idx + 1}: {item.label}
            </span>
          </div>
          <h5 className="font-semibold text-gb-sm text-fg leading-snug">{item.heading}</h5>
          <blockquote className="mt-gb-xs rounded-gb-lg border-l-4 border-brand bg-surface p-gb-md text-gb-sm leading-relaxed text-fg italic break-words shadow-gb-xs">
            &ldquo;{item.answer}&rdquo;
          </blockquote>
        </div>
      ))}
    </div>
  );
}

function extractSnapshotParts(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const val = value as RecordValue;
  const payload = (val.payload && typeof val.payload === 'object' ? val.payload : val) as RecordValue;
  const reflection = (payload.reflection && typeof payload.reflection === 'object' ? payload.reflection : payload) as RecordValue;

  const achievements = Array.isArray(reflection.achievements) ? (reflection.achievements as RecordValue[]) : [];
  const activities = Array.isArray(reflection.activities) ? (reflection.activities as RecordValue[]) : [];
  const personalReflection =
    reflection.personalReflection && typeof reflection.personalReflection === 'object'
      ? (reflection.personalReflection as RecordValue)
      : null;
  const documents = Array.isArray(payload.documents) ? (payload.documents as RecordValue[]) : [];
  const followUpAnswers = Array.isArray(payload.followUpAnswers) ? (payload.followUpAnswers as RecordValue[]) : [];

  if (!achievements.length && !activities.length && !personalReflection) {
    return null;
  }

  const profileEntries = Object.entries(reflection).filter(
    ([k]) => !['achievements', 'activities', 'personalReflection'].includes(k) && !isIdentityKey(k)
  );

  return {
    profile: Object.fromEntries(profileEntries),
    achievements,
    activities,
    personalReflection,
    documents,
    followUpAnswers,
  };
}

function CandidateSnapshotView({
  parts,
}: {
  parts: NonNullable<ReturnType<typeof extractSnapshotParts>>;
}) {
  return (
    <div className="flex flex-col gap-gb-2xl min-w-0">
      {/* 1. Academic & General Profile */}
      {Object.keys(parts.profile).length > 0 ? (
        <div className="flex flex-col gap-gb-md">
          <div className="flex items-center gap-gb-xs pb-gb-xs border-b border-line/60">
            <span aria-hidden="true">🎓</span>
            <h4 className="font-semibold text-gb-sm text-fg">Academic & Profile Baseline</h4>
          </div>
          <StructuredDataView value={parts.profile} omitIdentity depth={2} />
        </div>
      ) : null}

      {/* 2. Achievements (Thành tích) */}
      <div className="flex flex-col gap-gb-md">
        <div className="flex items-center justify-between pb-gb-xs border-b border-line/60">
          <div className="flex items-center gap-gb-xs">
            <span aria-hidden="true">🏆</span>
            <h4 className="font-semibold text-gb-sm text-fg">Achievements (Thành tích)</h4>
          </div>
          <span className="rounded-full bg-surface-muted px-gb-md py-gb-xxs text-gb-xs font-medium text-fg-muted">
            {parts.achievements.length} verified {parts.achievements.length === 1 ? 'achievement' : 'achievements'}
          </span>
        </div>
        {parts.achievements.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-gb-md">
            {parts.achievements.map((item, idx) => (
              <ObjectItemCard key={idx} item={item} omitIdentity />
            ))}
          </div>
        ) : (
          <span className="text-gb-xs text-fg-muted">No achievements recorded in snapshot.</span>
        )}
      </div>

      {/* 3. Activities (Hoạt động ngoại khóa) */}
      <div className="flex flex-col gap-gb-md">
        <div className="flex items-center justify-between pb-gb-xs border-b border-line/60">
          <div className="flex items-center gap-gb-xs">
            <span aria-hidden="true">🎯</span>
            <h4 className="font-semibold text-gb-sm text-fg">Activities & Extracurriculars (Hoạt động)</h4>
          </div>
          <span className="rounded-full bg-surface-muted px-gb-md py-gb-xxs text-gb-xs font-medium text-fg-muted">
            {parts.activities.length} {parts.activities.length === 1 ? 'activity' : 'activities'}
          </span>
        </div>
        {parts.activities.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-gb-md">
            {parts.activities.map((item, idx) => (
              <ObjectItemCard key={idx} item={item} omitIdentity />
            ))}
          </div>
        ) : (
          <span className="text-gb-xs text-fg-muted">No activities recorded in snapshot.</span>
        )}
      </div>

      {/* 4. Personal Reflection (Suy ngẫm cá nhân) */}
      <div className="flex flex-col gap-gb-md">
        <div className="flex items-center justify-between pb-gb-xs border-b border-line/60">
          <div className="flex items-center gap-gb-xs">
            <span aria-hidden="true">💭</span>
            <div>
              <h4 className="font-semibold text-gb-sm text-fg">Personal Reflection (Suy ngẫm cá nhân)</h4>
              <p className="text-gb-xs text-fg-muted">
                Candidate answers to core reflective questions
              </p>
            </div>
          </div>
          <span className="rounded-full bg-brand-subtle px-gb-md py-gb-xxs text-gb-xs font-medium text-fg-brand">
            {Object.keys(parts.personalReflection ?? {}).length} answered
          </span>
        </div>
        <PersonalReflectionSection answers={parts.personalReflection} />
      </div>

      {/* 5. Uploaded Documents & Follow-Ups */}
      {parts.documents.length > 0 || parts.followUpAnswers.length > 0 ? (
        <details className="group rounded-gb-lg border border-line bg-surface-subtle/30 p-gb-md">
          <summary className="cursor-pointer font-semibold text-gb-sm text-fg flex items-center justify-between select-none">
            <span className="flex items-center gap-gb-xs">
              <span className="text-fg-muted group-open:rotate-90 transition-transform text-gb-xs">▶</span>
              <span>Uploaded documents & Follow-up answers</span>
            </span>
            <span className="rounded-full bg-surface-muted px-gb-md py-gb-xxs text-gb-xs font-medium text-fg-muted">
              {parts.documents.length} docs · {parts.followUpAnswers.length} follow-ups
            </span>
          </summary>
          <div className="mt-gb-md border-t border-line/50 pt-gb-md flex flex-col gap-gb-md">
            {parts.documents.length > 0 ? (
              <div className="flex flex-col gap-gb-xs">
                <span className="text-gb-xs font-semibold uppercase tracking-wider text-fg-muted">
                  Evidence Documents
                </span>
                <div className="flex flex-wrap gap-gb-xs">
                  {parts.documents.map((doc, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-gb-xs rounded-full border border-line bg-surface px-gb-md py-gb-xxs text-gb-xs text-fg-secondary"
                    >
                      <span aria-hidden="true" className="text-fg-muted">📄</span>
                      <span>{scalar(doc.fileName) ?? `Document ${idx + 1}`}</span>
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            {parts.followUpAnswers.length > 0 ? (
              <div className="flex flex-col gap-gb-xs">
                <span className="text-gb-xs font-semibold uppercase tracking-wider text-fg-muted">
                  Follow-up Answers
                </span>
                <StructuredDataView value={parts.followUpAnswers} omitIdentity depth={2} />
              </div>
            ) : null}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function InputsView({ sections }: { sections: AdminAiReportInputSection[] }) {
  if (!sections.length) {
    return <p className="text-gb-sm text-fg-muted">Exact historical input not persisted.</p>;
  }
  return (
    <div className="flex flex-col gap-gb-xl">
      {sections.map((section) => {
        const snapshotParts =
          section.label.toLowerCase().includes('candidate snapshot')
            ? extractSnapshotParts(section.value)
            : null;

        return (
          <section
            key={section.label}
            className="rounded-gb-xl border border-line bg-surface p-gb-xl shadow-gb-xs flex flex-col gap-gb-lg"
          >
            <div className="flex items-center justify-between border-b border-line pb-gb-md">
              <h3 className="font-display text-gb-md font-semibold text-fg tracking-tight">
                {section.label}
              </h3>
              {section.persisted ? (
                <Badge variant="safe-chip">Persisted</Badge>
              ) : (
                <Badge variant="neutral-chip">Not saved</Badge>
              )}
            </div>
            {snapshotParts ? (
              <CandidateSnapshotView parts={snapshotParts} />
            ) : (
              <StructuredDataView value={section.value} omitIdentity depth={1} />
            )}
          </section>
        );
      })}
    </div>
  );
}

function TechnicalView({ node }: { node: AdminAiReportReviewNode }) {
  const [copied, setCopied] = useState(false);
  const metadata = Object.entries(node.metadata).filter(
    ([, value]) => value !== null && value !== undefined && value !== ''
  );
  const rawJson = JSON.stringify(node.rawOutput, null, 2);

  return (
    <div className="flex flex-col gap-gb-xl">
      <dl className="grid gap-gb-md sm:grid-cols-2 lg:grid-cols-3">
        {[
          ['Generated At', formatDate(node.generatedAt)],
          ['Model', node.modelName],
          ['Prompt Version', node.promptVersion],
          ['Input Hash', node.inputHash],
          ['Output Format', node.outputFormat],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-gb-lg border border-line bg-surface-subtle/40 p-gb-md flex flex-col gap-gb-xxs"
          >
            <dt className="text-gb-xs font-semibold uppercase tracking-wider text-fg-muted">{label}</dt>
            <dd className="break-all font-mono text-gb-sm text-fg">{String(value ?? '—')}</dd>
          </div>
        ))}
        {metadata.map(([key, value]) => (
          <div
            key={key}
            className="rounded-gb-lg border border-line bg-surface-subtle/40 p-gb-md flex flex-col gap-gb-xxs"
          >
            <dt className="text-gb-xs font-semibold uppercase tracking-wider text-fg-muted">
              {humanize(key)}
            </dt>
            <dd className="break-all font-mono text-gb-sm text-fg">
              {scalar(value) ?? JSON.stringify(value)}
            </dd>
          </div>
        ))}
      </dl>

      <details className="group rounded-gb-xl border border-line bg-surface-subtle/20 p-gb-lg">
        <summary className="flex cursor-pointer items-center justify-between font-semibold text-gb-sm text-fg select-none">
          <span className="flex items-center gap-gb-xs">
            <span className="text-fg-muted group-open:rotate-90 transition-transform text-gb-xs">▶</span>
            <span>Raw JSON (secondary)</span>
          </span>
          <button
            type="button"
            className="rounded-gb-lg border border-line bg-surface px-gb-md py-gb-xs text-gb-xs font-semibold text-fg hover:bg-surface-hover transition-colors"
            onClick={(e) => {
              e.preventDefault();
              void navigator.clipboard?.writeText(rawJson);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? 'Copied' : 'Copy JSON'}
          </button>
        </summary>
        <pre className="mt-gb-md max-h-[32rem] overflow-auto rounded-gb-lg bg-surface-subtle p-gb-lg text-wrap break-words font-mono text-gb-xs leading-relaxed text-fg border border-line/60">
          {rawJson}
        </pre>
      </details>
      <p className="text-gb-xs text-fg-muted">
        Exact provider prompts are not persisted; Inputs shows reconstructed historical source context.
      </p>
    </div>
  );
}

function FlowNode({
  node,
  selected,
  stepIndex,
  onSelect,
}: {
  node: AdminAiReportReviewNode;
  selected: boolean;
  stepIndex: number;
  onSelect: (id: string) => void;
}) {
  const icon =
    node.kind === 'personal' ? '👤' : node.kind === 'matching' ? '🎯' : '🧭';

  return (
    <button
      type="button"
      disabled={!node.available}
      aria-pressed={selected}
      aria-label={`View ${node.title}`}
      onClick={() => onSelect(node.id)}
      className={`group relative flex flex-col justify-between overflow-hidden rounded-gb-2xl border p-gb-lg text-left transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand flex-1 min-w-[200px] ${
        node.available
          ? selected
            ? 'border-brand bg-surface shadow-gb-sm ring-2 ring-brand/20'
            : 'border-line bg-surface hover:border-line-strong hover:bg-surface-hover/80 hover:shadow-gb-xxs'
          : 'cursor-not-allowed border-line/60 bg-surface-subtle/50 opacity-60'
      }`}
    >
      {selected ? <div className="absolute top-0 left-0 right-0 h-1 bg-brand" /> : null}

      <div className="flex flex-col gap-gb-xs w-full">
        <div className="flex items-center justify-between gap-gb-xs">
          <span
            className={`rounded-full px-gb-sm py-gb-xxs text-gb-xxs font-bold uppercase tracking-wider ${
              selected
                ? 'bg-brand text-white'
                : node.available
                ? 'bg-surface-muted text-fg-secondary'
                : 'bg-surface-muted/60 text-fg-muted'
            }`}
          >
            Step {stepIndex}
          </span>
          <div className="flex items-center gap-1.5 text-gb-xxs font-medium">
            {node.available ? (
              selected ? (
                <span className="flex items-center gap-1 text-fg-brand font-semibold">
                  <span className="h-2 w-2 rounded-full bg-brand animate-pulse" />
                  Viewing
                </span>
              ) : (
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Stored report
                </span>
              )
            ) : (
              <span className="flex items-center gap-1 text-fg-muted font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-fg-muted/40" />
                Waiting on report
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-gb-sm mt-gb-xs">
          <span className="text-gb-lg shrink-0" aria-hidden="true">
            {icon}
          </span>
          <span
            className={`text-gb-md font-semibold tracking-tight ${
              selected ? 'text-fg font-bold' : 'text-fg'
            }`}
          >
            {node.title}
          </span>
        </div>
      </div>

      <div className="mt-gb-md flex items-center justify-between border-t border-line/50 pt-gb-xs text-gb-xxs text-fg-muted">
        <span className="flex items-center gap-1">
          <span aria-hidden="true">🕒</span>
          <span>{formatDate(node.generatedAt)}</span>
        </span>
        {node.promptVersion ? (
          <span className="font-mono text-fg-muted/80">{node.promptVersion}</span>
        ) : null}
      </div>
    </button>
  );
}

function ReportFlow({
  review,
  selectedNodeId,
  onSelect,
}: {
  review: AdminAiReportReview;
  selectedNodeId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div
      aria-label="AI report flow"
      className="flex flex-col items-stretch gap-gb-sm md:flex-row md:items-center"
    >
      {review.nodes.map((node, index) => (
        <div
          key={node.kind}
          className="flex min-w-0 flex-1 flex-col gap-gb-sm md:flex-row md:items-center"
        >
          <FlowNode
            node={node}
            selected={node.id === selectedNodeId}
            stepIndex={index + 1}
            onSelect={onSelect}
          />
          {index < review.nodes.length - 1 ? (
            <div
              aria-hidden="true"
              className="flex items-center justify-center shrink-0 text-fg-muted md:px-gb-xs py-gb-xxs md:py-0"
            >
              <div className="hidden md:flex items-center gap-0.5 text-fg-muted/60">
                <div className="h-0.5 w-3 bg-line-strong" />
                <svg
                  className="w-4 h-4 text-fg-muted/80 -ml-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </div>
              <div className="flex md:hidden items-center justify-center text-fg-muted/60">
                <svg
                  className="w-4 h-4 text-fg-muted/80"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function DetailPanel({ node }: { node: AdminAiReportReviewNode }) {
  const [tab, setTab] = useState<'output' | 'inputs' | 'technical'>('output');

  const tabMeta = [
    { value: 'output' as const, label: 'Output', icon: '✨', count: null },
    {
      value: 'inputs' as const,
      label: 'Inputs',
      icon: '📥',
      count: node.inputs.sections.length || null,
    },
    { value: 'technical' as const, label: 'Technical', icon: '⚙️', count: null },
  ];

  return (
    <Panel className="flex flex-col gap-gb-xl">
      <div className="flex flex-col gap-gb-md sm:flex-row sm:items-center sm:justify-between border-b border-line pb-gb-lg">
        <PanelHeader
          title={node.title}
          description="Read-only canonical output, reconstructed inputs and technical lineage."
        />
        <div role="tablist" aria-label="Report detail" className="shrink-0">
          <div className="inline-flex p-1 rounded-gb-xl bg-surface-subtle border border-line gap-1">
            {tabMeta.map(({ value, label, icon, count }) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-label={label}
                aria-selected={tab === value}
                onClick={() => setTab(value)}
                className={`flex items-center gap-gb-xs rounded-gb-lg px-gb-lg py-gb-xs text-gb-sm font-semibold transition-all ${
                  tab === value
                    ? 'bg-surface text-fg shadow-gb-xs border border-line/80'
                    : 'text-fg-secondary hover:text-fg hover:bg-surface-hover/50 border border-transparent'
                }`}
              >
                <span aria-hidden="true">{icon}</span>
                <span>{label}</span>
                {count !== null ? (
                  <span
                    className={`rounded-full px-gb-xs py-gb-xxs text-gb-xxs font-mono ${
                      tab === value
                        ? 'bg-brand-subtle text-fg-brand font-semibold'
                        : 'bg-surface-muted text-fg-muted'
                    }`}
                  >
                    {count}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      </div>
      {tab === 'output' ? (
        <OutputRenderer node={node} />
      ) : tab === 'inputs' ? (
        <InputsView sections={node.inputs.sections} />
      ) : (
        <TechnicalView node={node} />
      )}
    </Panel>
  );
}

export function AdminAiReportReviewClient({
  items,
  initialReview,
}: {
  items: AdminAiReportReviewListItem[];
  initialReview: AdminAiReportReview | null;
}) {
  const [state, setState] = useState<DetailState>({ kind: 'ready', review: initialReview });
  const [applicationId, setApplicationId] = useState(
    initialReview?.application.applicationId ?? items[0]?.applicationId ?? ''
  );
  const [selectedNodeId, setSelectedNodeId] = useState(firstAvailableNode(initialReview));

  async function selectApplication(nextApplicationId: string) {
    setApplicationId(nextApplicationId);
    setState({ kind: 'loading', review: null });
    setSelectedNodeId(null);
    try {
      const response = await fetch(
        `/api/admin/ai-report-review?applicationId=${encodeURIComponent(nextApplicationId)}`,
        { cache: 'no-store' }
      );
      const body = (await response.json().catch(() => ({}))) as {
        review?: AdminAiReportReview;
        error?: string;
      };
      if (!response.ok || !body.review) throw new Error(body.error ?? 'Could not load report details.');
      setState({ kind: 'ready', review: body.review });
      setSelectedNodeId(firstAvailableNode(body.review));
    } catch (error) {
      setState({
        kind: 'error',
        review: null,
        message: error instanceof Error ? error.message : 'Could not load report details.',
      });
    }
  }

  if (items.length === 0) return <Panel className="text-gb-sm text-fg-muted">No reviewable reports yet.</Panel>;
  const review = state.review;
  const selectedNode =
    review?.nodes.find((node) => node.id === selectedNodeId) ??
    review?.nodes.find((node) => node.available) ??
    null;

  return (
    <div className="flex flex-col gap-gb-3xl">
      <Panel className="flex flex-col gap-gb-md">
        <div className="flex items-center justify-between">
          <label htmlFor="ai-report-application" className="text-gb-sm font-semibold text-fg">
            Select an application
          </label>
          <span className="rounded-full bg-surface-muted px-gb-sm py-gb-xxs text-gb-xs text-fg-muted font-medium">
            {items.length} applications
          </span>
        </div>
        <select
          id="ai-report-application"
          value={applicationId}
          onChange={(event) => void selectApplication(event.target.value)}
          className="w-full rounded-gb-xl border border-line bg-surface px-gb-xl py-gb-lg text-gb-sm font-medium text-fg shadow-gb-xxs transition-colors hover:border-line-strong focus:outline-none focus:ring-2 focus:ring-brand"
        >
          {items.map((item) => (
            <option key={item.applicationId} value={item.applicationId}>
              {[item.courseName, item.universityName, item.subject].filter(Boolean).join(' · ') ||
                item.applicationId}
            </option>
          ))}
        </select>
        <p className="text-gb-xs text-fg-muted">Most recent 100 applications with AI report activity.</p>
      </Panel>
      {state.kind === 'loading' ? <Panel className="text-gb-sm text-fg-muted">Loading report details…</Panel> : null}
      {state.kind === 'error' ? <Panel className="text-gb-sm text-fg-error">{state.message}</Panel> : null}
      {review ? (
        <>
          <Panel className="flex flex-col gap-gb-xl">
            <PanelHeader
              title={review.application.courseName ?? 'Application'}
              description={
                [review.application.universityName, review.application.subject].filter(Boolean).join(' · ') ||
                undefined
              }
            />
            <ReportFlow review={review} selectedNodeId={selectedNodeId} onSelect={setSelectedNodeId} />
          </Panel>
          {selectedNode ? <DetailPanel node={selectedNode} /> : null}
        </>
      ) : null}
    </div>
  );
}
