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
        <div className="flex items-center gap-gb-xs flex-wrap min-w-0">
          <Badge variant={variant}>{pct}%</Badge>
          <span className="text-gb-xs text-fg-muted font-mono truncate">({val})</span>
        </div>
      );
    }
    return (
      <Badge variant={getBadgeVariant('confidence', val)} className="max-w-full truncate">
        {humanize(val)}
      </Badge>
    );
  }

  if (isStatusOrRating) {
    return (
      <Badge variant={getBadgeVariant(key, val)} className="max-w-full truncate">
        {humanize(val)}
      </Badge>
    );
  }

  if (/date|generatedAt|createdAt|timestamp/i.test(key) && !Number.isNaN(Date.parse(val))) {
    return <span className="font-mono text-gb-xs text-fg-secondary break-words">{formatDate(val)}</span>;
  }

  return <span className="break-words">{val}</span>;
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
    <div className="mt-gb-xs rounded-gb-lg border-l-4 border-indigo-500 bg-indigo-50/60 p-gb-md flex flex-col gap-gb-sm text-gb-xs min-w-0">
      <div className="flex items-center justify-between gap-gb-xs">
        <div className="flex items-center gap-gb-xs font-semibold uppercase tracking-wider text-indigo-700">
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
              <p className="text-fg leading-relaxed break-words italic pl-gb-xs border-l border-indigo-200">
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

function ObjectItemCard({ item, omitIdentity = true }: { item: RecordValue; omitIdentity?: boolean }) {
  const titleEntryKey =
    'name' in item && scalar(item.name)
      ? 'name'
      : 'title' in item && scalar(item.title)
      ? 'title'
      : 'headline' in item && scalar(item.headline)
      ? 'headline'
      : 'label' in item && scalar(item.label)
      ? 'label'
      : 'theme' in item && scalar(item.theme)
      ? 'theme'
      : null;
  const rawTitle = titleEntryKey ? scalar(item[titleEntryKey]) : null;

  const statusEntryKey =
    'status' in item && scalar(item.status)
      ? 'status'
      : 'alignment' in item && scalar(item.alignment)
      ? 'alignment'
      : 'classification' in item && scalar(item.classification)
      ? 'classification'
      : 'kind' in item && scalar(item.kind)
      ? 'kind'
      : 'category' in item && scalar(item.category)
      ? 'category'
      : null;
  const rawStatus = statusEntryKey ? scalar(item[statusEntryKey]) : null;
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
    if (rawTitle && /(^name$|^title$|^headline$|^theme$|^label$)/i.test(k)) return false;
    if (statusEntryKey && k === statusEntryKey) return false;
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
  const isAllObjects = values.every((it) => it && typeof it === 'object' && !Array.isArray(it));
  if (isAllObjects) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-gb-md">
        {values.map((item, index) => (
          <ObjectItemCard key={index} item={item as RecordValue} omitIdentity={omitIdentity} />
        ))}
      </div>
    );
  }
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
  omitIdentity = true,
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
                    className="rounded-gb-lg border border-line/70 bg-surface-subtle/60 p-gb-md flex flex-col gap-gb-xs min-w-0 overflow-hidden"
                  >
                    <dt
                      className="text-gb-xs font-semibold uppercase tracking-wider text-fg-muted truncate"
                      title={humanize(k)}
                    >
                      {humanize(k)}
                    </dt>
                    <dd className="text-gb-sm font-semibold text-fg min-w-0 max-w-full break-words overflow-hidden">
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
              className="rounded-gb-lg border border-line/70 bg-surface-subtle/60 p-gb-md flex flex-col gap-gb-xs min-w-0 overflow-hidden"
            >
              <dt
                className="text-gb-xs font-semibold uppercase tracking-wider text-fg-muted truncate"
                title={humanize(k)}
              >
                {humanize(k)}
              </dt>
              <dd className="text-gb-sm font-semibold text-fg min-w-0 max-w-full break-words overflow-hidden">
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

function asRecord(value: unknown): RecordValue {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as RecordValue) : {};
}

function recordItems(value: unknown): RecordValue[] {
  return Array.isArray(value)
    ? value.filter((item): item is RecordValue => Boolean(item && typeof item === 'object' && !Array.isArray(item)))
    : [];
}

function textItems(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(scalar).filter((item): item is string => Boolean(item))
    : [];
}

function ReadableList({ items }: { items: string[] }) {
  if (!items.length) return <p className="text-gb-sm text-fg-muted">Not available in this report version.</p>;
  return (
    <ul className="flex list-disc flex-col gap-gb-sm pl-gb-xl text-gb-sm leading-relaxed text-fg-secondary">
      {items.map((item) => <li key={item}>{item}</li>)}
    </ul>
  );
}

function PersonalChapter({
  index,
  title,
  description,
  eyebrow = 'Personal Canvas',
  children,
}: {
  index: number;
  title: string;
  description: string;
  eyebrow?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-gb-2xl border border-line bg-surface shadow-gb-xs">
      <header className="grid gap-gb-md border-b border-line bg-surface-subtle/50 p-gb-xl sm:grid-cols-[4rem_1fr] sm:p-gb-2xl">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-brand/30 bg-brand-subtle text-gb-md font-bold text-fg-brand">
          {String(index).padStart(2, '0')}
        </div>
        <div>
          <p className="text-gb-xs font-bold uppercase tracking-[0.14em] text-fg-brand">{eyebrow}</p>
          <h2 className="mt-gb-xxs font-display text-gb-display-xs font-semibold tracking-gb-display-tight text-fg">{title}</h2>
          <p className="mt-gb-xs max-w-3xl text-gb-sm leading-relaxed text-fg-tertiary">{description}</p>
        </div>
      </header>
      <div className="flex flex-col gap-gb-xl p-gb-xl sm:p-gb-2xl">{children}</div>
    </section>
  );
}

function PersonalRenderer({ output }: { output: RecordValue }) {
  const core = asRecord(output.coreIdentity);
  const driving = asRecord(output.drivingForce);
  const signature = asRecord(output.signaturePattern);
  const themes = asRecord(output.emergingThemes);
  const positioning = asRecord(output.personalPositioning);
  const proof = asRecord(output.proofOfMe);
  const narrative = asRecord(output.narrativeDetails);
  const coreNarrative = asRecord(narrative.coreIdentity);
  const drivingNarrative = asRecord(narrative.drivingForce);
  const capabilityNarrative = asRecord(narrative.provenCapabilities);
  const positioningNarrative = asRecord(narrative.profilePositioning);
  const socialNarrative = asRecord(narrative.socialProof);
  const canvas = asRecord(output.canvasDetails);
  const proofCards = recordItems(proof.cards);
  const themeCards = recordItems(themes.themes);
  const patternSteps = recordItems(signature.steps);
  const positioningOptions = recordItems(positioningNarrative.positioningOptions);
  const canvasCapabilities = recordItems(canvas.capabilities);
  const narrativeCapabilities = recordItems(capabilityNarrative.capabilities);
  const capabilities = canvasCapabilities.length
    ? canvasCapabilities
    : narrativeCapabilities.length
      ? narrativeCapabilities
      : [...new Set(proofCards.flatMap((card) => textItems(card.competenciesDemonstrated)))].map((name): RecordValue => ({ name }));
  const growthPriorities = recordItems(canvas.growthPriorities);
  const fallbackGrowth = [...new Set([
    ...textItems(positioning.whatPreventsStrongerPositioning),
    ...textItems(core.stillDeveloping),
    ...themeCards.map((theme) => scalar(theme.limitation)).filter((item): item is string => Boolean(item)),
  ])].slice(0, 6);
  const futurePathways = recordItems(canvas.futurePathways);
  const overallParagraphs = textItems(asRecord(output.overallSummary).paragraphs);
  const overviewText = scalar(asRecord(output.overview).summary)
    ?? scalar(asRecord(output.snapshot).summary)
    ?? scalar(narrative.snapshot);
  const confidence = scalar(output.overallEvidenceConfidence);
  const coreTraits = recordItems(coreNarrative.definingTraits);
  const motivations = textItems(driving.repeatedMotivations);
  const primaryMotivation = scalar(drivingNarrative.primaryMotivation) ?? motivations[0] ?? null;
  const takeaways = asRecord(narrative.keyTakeaways ?? output.keyTakeaways);

  return (
    <div className="flex flex-col gap-gb-2xl" data-testid="personal-report-readable-output">
      <section className="rounded-gb-2xl border border-brand/25 bg-brand-subtle/20 p-gb-xl sm:p-gb-2xl">
        <div className="flex flex-wrap items-start justify-between gap-gb-lg">
          <div className="max-w-3xl">
            <p className="text-gb-xs font-bold uppercase tracking-[0.14em] text-fg-brand">Personal Report overview</p>
            <h2 className="mt-gb-xs font-display text-gb-display-xs font-semibold tracking-gb-display-tight text-fg">The student-facing report, shown read-only</h2>
            <p className="mt-gb-sm text-gb-sm leading-relaxed text-fg-secondary">
              {overviewText ?? 'This version contains the six Personal Canvas chapters below.'}
            </p>
          </div>
          {confidence ? <Badge variant={getBadgeVariant('confidence', confidence)}>{humanize(confidence)} evidence confidence</Badge> : null}
        </div>
      </section>

      <PersonalChapter
        index={1}
        title="Core Identity"
        description="The recurring roles, behaviours and patterns that describe who the student consistently shows themselves to be."
      >
        <div>
          <p className="text-gb-xs font-bold uppercase tracking-wider text-fg-brand">Core Identity</p>
          <h3 className="mt-gb-xs font-display text-gb-display-xs font-semibold text-fg">Who they consistently are</h3>
          {scalar(core.headline) ? <p className="mt-gb-md text-gb-lg font-semibold text-fg">{scalar(core.headline)}</p> : null}
          <p className="mt-gb-sm max-w-4xl text-gb-sm leading-relaxed text-fg-secondary">
            {scalar(coreNarrative.identityStatement) ?? scalar(core.interpretation) ?? 'No identity interpretation was persisted for this version.'}
          </p>
        </div>
        {(scalar(core.recurringRole) || scalar(core.valueOrientation)) ? (
          <div className="grid gap-gb-md sm:grid-cols-2">
            {[['Recurring role', core.recurringRole], ['Value orientation', core.valueOrientation]].map(([label, value]) => scalar(value) ? (
              <div key={label as string} className="rounded-gb-xl border border-line bg-surface-subtle/50 p-gb-lg">
                <p className="text-gb-xs font-bold uppercase tracking-wider text-fg-brand">{label as string}</p>
                <p className="mt-gb-xs text-gb-base font-semibold text-fg">{scalar(value)}</p>
              </div>
            ) : null)}
          </div>
        ) : null}
        {textItems(core.observations).length ? (
          <div className="rounded-gb-xl border border-line bg-surface p-gb-lg">
            <p className="mb-gb-sm text-gb-xs font-bold uppercase tracking-wider text-fg-brand">What GlowBal observed</p>
            <ReadableList items={textItems(core.observations)} />
          </div>
        ) : null}
        {(coreTraits.length || textItems(core.recurringBehaviours).length) ? (
          <div>
            <h3 className="text-gb-base font-semibold text-fg">Defining traits and key characteristics</h3>
            <div className="mt-gb-md grid gap-gb-md md:grid-cols-2">
              {(coreTraits.length ? coreTraits : textItems(core.recurringBehaviours).map((characteristic): RecordValue => ({ characteristic }))).map((trait, index) => (
                <article key={scalar(trait.characteristic) ?? index} className="rounded-gb-xl border border-line bg-surface p-gb-lg">
                  <h4 className="font-semibold text-fg">{scalar(trait.characteristic) ?? 'Characteristic'}</h4>
                  {scalar(trait.insight) ? <p className="mt-gb-sm text-gb-sm leading-relaxed text-fg-secondary">{scalar(trait.insight)}</p> : null}
                  {scalar(trait.whyItMatters) ? <p className="mt-gb-sm rounded-gb-lg bg-surface-subtle p-gb-md text-gb-sm text-fg-secondary"><span className="font-semibold text-fg">Why it matters:</span> {scalar(trait.whyItMatters)}</p> : null}
                </article>
              ))}
            </div>
          </div>
        ) : null}
        <div className="rounded-gb-xl border border-line bg-surface-subtle/35 p-gb-lg">
          <div className="flex flex-wrap items-center justify-between gap-gb-sm">
            <div>
              <p className="text-gb-xs font-bold uppercase tracking-wider text-fg-brand">Signature Pattern</p>
              <h3 className="mt-gb-xxs text-gb-base font-semibold text-fg">The behavioural sequence that repeats</h3>
            </div>
            <div className="flex flex-wrap gap-gb-xs">
              {scalar(signature.patternStrength) ? <Badge variant={getBadgeVariant('status', String(signature.patternStrength))}>{humanize(String(signature.patternStrength))}</Badge> : null}
              {scalar(signature.supportingExperienceCount) ? <Badge variant="neutral-chip">{scalar(signature.supportingExperienceCount)} supporting experiences</Badge> : null}
            </div>
          </div>
          {patternSteps.length ? (
            <div className="mt-gb-lg grid gap-gb-md md:grid-cols-2">
              {patternSteps.map((step, index) => (
                <article key={scalar(step.key) ?? index} className="rounded-gb-xl border border-line bg-surface p-gb-lg">
                  <p className="text-gb-xs font-bold uppercase tracking-wider text-fg-brand">{index + 1}. {scalar(step.label) ?? humanize(String(step.key ?? 'Step'))}</p>
                  <p className="mt-gb-xs text-gb-sm leading-relaxed text-fg">{scalar(step.description) ?? 'Not available'}</p>
                  {textItems(step.examples).length ? <p className="mt-gb-sm text-gb-xs text-fg-muted">Examples: {textItems(step.examples).join(', ')}</p> : null}
                </article>
              ))}
            </div>
          ) : <p className="mt-gb-md text-gb-sm text-fg-muted">No repeatable sequence was persisted.</p>}
          {scalar(signature.distinctiveness) ? <p className="mt-gb-md text-gb-sm leading-relaxed text-fg-secondary">{scalar(signature.distinctiveness)}</p> : null}
        </div>
      </PersonalChapter>

      <PersonalChapter
        index={2}
        title="Driving Forces"
        description="What repeatedly motivates the student's choices, where those motivations appear, and how confidently the evidence supports them."
      >
        <div>
          <p className="text-gb-xs font-bold uppercase tracking-wider text-fg-brand">Driving Force</p>
          <h3 className="mt-gb-xs font-display text-gb-display-xs font-semibold text-fg">What consistently motivates them</h3>
          {scalar(driving.headline) ? <p className="mt-gb-md text-gb-lg font-semibold text-fg">{scalar(driving.headline)}</p> : null}
          <p className="mt-gb-sm max-w-4xl text-gb-sm leading-relaxed text-fg-secondary">{scalar(drivingNarrative.strategicInterpretation) ?? scalar(driving.explanation) ?? 'No motivation interpretation was persisted.'}</p>
        </div>
        <div className="grid gap-gb-md md:grid-cols-3">
          <div className="rounded-gb-xl border border-line bg-surface p-gb-lg">
            <p className="text-gb-xs font-bold uppercase tracking-wider text-fg-brand">Primary motivation</p>
            <p className="mt-gb-xs text-gb-sm font-semibold text-fg">{primaryMotivation ?? 'Not available'}</p>
          </div>
          <div className="rounded-gb-xl border border-line bg-surface p-gb-lg">
            <p className="mb-gb-sm text-gb-xs font-bold uppercase tracking-wider text-fg-brand">Repeated choices</p>
            <ReadableList items={textItems(drivingNarrative.repeatedChoices).length ? textItems(drivingNarrative.repeatedChoices) : motivations.slice(1)} />
          </div>
          <div className="rounded-gb-xl border border-line bg-surface p-gb-lg">
            <p className="mb-gb-sm text-gb-xs font-bold uppercase tracking-wider text-fg-brand">Underlying values</p>
            <ReadableList items={textItems(drivingNarrative.underlyingValues)} />
          </div>
        </div>
        {textItems(drivingNarrative.recurringProblems).length ? <div><h3 className="mb-gb-sm text-gb-base font-semibold text-fg">Recurring problems</h3><ReadableList items={textItems(drivingNarrative.recurringProblems)} /></div> : null}
        {scalar(driving.missingPersonalGrounding) || scalar(driving.reflectionPrompt) ? (
          <div className="rounded-gb-xl border border-line bg-surface-subtle p-gb-lg text-gb-sm leading-relaxed text-fg-secondary">
            {scalar(driving.missingPersonalGrounding) ? <p>{scalar(driving.missingPersonalGrounding)}</p> : null}
            {scalar(driving.reflectionPrompt) ? <p className="mt-gb-xs"><span className="font-semibold text-fg">Reflection prompt:</span> {scalar(driving.reflectionPrompt)}</p> : null}
          </div>
        ) : null}
      </PersonalChapter>

      <PersonalChapter
        index={3}
        title="Proven Capabilities"
        description="What the evidence demonstrates the student can do, how those strengths combine, and the positioning they create."
      >
        {scalar(capabilityNarrative.overview) ? <p className="max-w-4xl text-gb-sm leading-relaxed text-fg-secondary">{scalar(capabilityNarrative.overview)}</p> : null}
        <div className="grid gap-gb-md md:grid-cols-2">
          {capabilities.length ? capabilities.map((capability, index) => {
            const name = scalar(capability.name ?? capability.capability) ?? `Capability ${index + 1}`;
            const score = scalar(capability.score);
            return (
              <article key={name} className="rounded-gb-xl border border-line bg-surface p-gb-lg">
                <div className="flex flex-wrap items-start justify-between gap-gb-sm">
                  <h3 className="text-gb-base font-semibold text-fg">{name}</h3>
                  <div className="flex flex-wrap gap-gb-xs">
                    {scalar(capability.band) ? <Badge variant={getBadgeVariant('status', String(capability.band))}>{humanize(String(capability.band))}</Badge> : null}
                    {score ? <Badge variant="neutral-chip">{score}/100</Badge> : null}
                    {scalar(capability.stars) ? <Badge variant="neutral-chip">{scalar(capability.stars)}/5 evidence stars</Badge> : null}
                  </div>
                </div>
                {scalar(capability.howDemonstrated ?? capability.why) ? <p className="mt-gb-sm text-gb-sm leading-relaxed text-fg-secondary">{scalar(capability.howDemonstrated ?? capability.why)}</p> : null}
                {scalar(capability.whyItMatters) ? <p className="mt-gb-sm rounded-gb-lg bg-surface-subtle p-gb-md text-gb-sm text-fg-secondary"><span className="font-semibold text-fg">Why it matters:</span> {scalar(capability.whyItMatters)}</p> : null}
                {textItems(capability.supportingActivities).length ? <p className="mt-gb-sm text-gb-xs text-fg-muted">Supporting activities: {textItems(capability.supportingActivities).join(', ')}</p> : null}
              </article>
            );
          }) : <p className="text-gb-sm text-fg-muted">No named capabilities were persisted.</p>}
        </div>
        {scalar(capabilityNarrative.combinationInsight) ? <div className="rounded-gb-xl border border-line bg-surface-subtle p-gb-lg"><p className="text-gb-xs font-bold uppercase tracking-wider text-fg-brand">How these capabilities combine</p><p className="mt-gb-xs text-gb-sm leading-relaxed text-fg-secondary">{scalar(capabilityNarrative.combinationInsight)}</p></div> : null}
        <div className="rounded-gb-xl border border-line bg-surface-subtle/35 p-gb-lg">
          <p className="text-gb-xs font-bold uppercase tracking-wider text-fg-brand">Personal Positioning</p>
          <h3 className="mt-gb-xxs text-gb-base font-semibold text-fg">An evidence-grounded positioning statement</h3>
          <p className="mt-gb-md text-gb-sm leading-relaxed text-fg-secondary">{scalar(positioningNarrative.profileNarrative) ?? scalar(positioning.statement) ?? 'No positioning statement was persisted.'}</p>
          {positioningOptions.length ? <div className="mt-gb-md grid gap-gb-sm md:grid-cols-2">{positioningOptions.map((option, index) => <div key={scalar(option.title) ?? index} className="rounded-gb-lg border border-line bg-surface p-gb-md"><p className="font-semibold text-fg">{scalar(option.title) ?? `Option ${index + 1}`}</p><p className="mt-gb-xs text-gb-sm text-fg-secondary">{scalar(option.statement) ?? 'Not available'}</p></div>)}</div> : null}
          <div className="mt-gb-md grid gap-gb-sm sm:grid-cols-2 lg:grid-cols-5">
            {[['Authentic', positioning.authentic], ['Differentiated', positioning.differentiated], ['Coherent', positioning.coherent], ['Direction aligned', positioning.directionAligned], ['Credible', positioning.credible]].map(([label, value]) => (
              <div key={label as string} className="flex items-center justify-between gap-gb-sm rounded-gb-lg border border-line bg-surface p-gb-md text-gb-sm"><span className="text-fg-secondary">{label as string}</span><Badge variant={value === true ? 'safe-chip' : 'neutral-chip'}>{value === true ? 'Yes' : 'Not yet'}</Badge></div>
            ))}
          </div>
          {textItems(positioning.whyThisFits).length ? <div className="mt-gb-md"><p className="mb-gb-sm text-gb-xs font-bold uppercase tracking-wider text-fg-brand">Why this fits</p><ReadableList items={textItems(positioning.whyThisFits)} /></div> : null}
        </div>
      </PersonalChapter>

      <PersonalChapter
        index={4}
        title="Social Proof"
        description="The tangible activities, outcomes and verification that make the claims in the profile credible."
      >
        {recordItems(canvas.socialProof).length ? <div className="grid gap-gb-md sm:grid-cols-2 lg:grid-cols-3">{recordItems(canvas.socialProof).map((metric, index) => <div key={scalar(metric.key) ?? index} className="rounded-gb-xl border border-line bg-surface p-gb-lg"><p className="font-display text-gb-display-xs font-semibold text-fg-brand">{scalar(metric.value) ?? '—'}</p><p className="mt-gb-xs font-semibold text-fg">{scalar(metric.label) ?? humanize(String(metric.key ?? 'Metric'))}</p>{scalar(metric.caption) ? <p className="mt-gb-xs text-gb-xs leading-relaxed text-fg-muted">{scalar(metric.caption)}</p> : null}</div>)}</div> : null}
        {scalar(proof.narrative) ? <p className="text-gb-sm leading-relaxed text-fg-secondary">{scalar(proof.narrative)}</p> : null}
        <div className="grid gap-gb-md md:grid-cols-2">
          {proofCards.length ? proofCards.map((card, index) => (
            <article key={scalar(card.title) ?? index} className="flex flex-col gap-gb-md rounded-gb-xl border border-line bg-surface p-gb-lg">
              <div className="flex flex-wrap items-start justify-between gap-gb-sm">
                <div><h3 className="text-gb-base font-semibold text-fg">{scalar(card.title) ?? `Evidence item ${index + 1}`}</h3>{scalar(card.role) ? <p className="mt-gb-xxs text-gb-xs text-fg-muted">{scalar(card.role)}</p> : null}</div>
                <div className="flex flex-wrap gap-gb-xs">{scalar(card.evidenceStrength) ? <Badge variant={getBadgeVariant('status', String(card.evidenceStrength))}>{humanize(String(card.evidenceStrength))} evidence</Badge> : null}{scalar(card.verificationStatus) ? <Badge variant={getBadgeVariant('status', String(card.verificationStatus))}>{humanize(String(card.verificationStatus))}</Badge> : null}</div>
              </div>
              {scalar(card.personalContribution) ? <p className="text-gb-sm leading-relaxed text-fg-secondary">{scalar(card.personalContribution)}</p> : null}
              {scalar(card.outcome) ? <p className="rounded-gb-lg bg-surface-subtle p-gb-md text-gb-sm font-semibold text-fg">{scalar(card.outcome)}</p> : null}
              {textItems(card.competenciesDemonstrated).length ? <div className="flex flex-wrap gap-gb-xs">{textItems(card.competenciesDemonstrated).map((item) => <Badge key={item} variant="brand-chip">{item}</Badge>)}</div> : null}
              {textItems(card.supports).length ? <p className="text-gb-xs text-fg-muted"><span className="font-semibold text-fg">Supports:</span> {textItems(card.supports).join(', ')}</p> : null}
            </article>
          )) : <p className="text-gb-sm text-fg-muted">No proof cards were persisted.</p>}
        </div>
        {scalar(socialNarrative.conclusion) ? <div className="rounded-gb-xl border border-line bg-surface-subtle p-gb-lg"><p className="text-gb-xs font-bold uppercase tracking-wider text-fg-brand">What the evidence suggests</p><p className="mt-gb-xs text-gb-sm leading-relaxed text-fg-secondary">{scalar(socialNarrative.conclusion)}</p></div> : null}
      </PersonalChapter>

      <PersonalChapter
        index={5}
        title="Areas for Growth"
        description="Where current evidence is limited, what still needs development, and where stronger proof could make the profile more complete."
      >
        <div className="grid gap-gb-md md:grid-cols-3">
          {growthPriorities.length ? growthPriorities.map((priority, index) => (
            <article key={scalar(priority.title) ?? index} className="rounded-gb-xl border border-line bg-surface p-gb-lg">
              <div className="flex flex-wrap gap-gb-xs"><Badge variant="neutral-chip">Priority {index + 1}</Badge>{scalar(priority.impact) ? <Badge variant="brand-chip">{humanize(String(priority.impact))} impact</Badge> : null}{scalar(priority.effort) ? <Badge variant="neutral-chip">{humanize(String(priority.effort))} effort</Badge> : null}</div>
              <h3 className="mt-gb-md font-semibold text-fg">{scalar(priority.title) ?? 'Growth opportunity'}</h3>
              <p className="mt-gb-xs text-gb-sm leading-relaxed text-fg-secondary">{scalar(priority.gap) ?? 'Not available'}</p>
              {scalar(priority.suggestedDirection) ? <p className="mt-gb-md border-t border-line pt-gb-md text-gb-sm text-fg-secondary"><span className="font-semibold text-fg">Suggested direction:</span> {scalar(priority.suggestedDirection)}</p> : null}
            </article>
          )) : fallbackGrowth.length ? fallbackGrowth.map((gap, index) => (
            <article key={gap} className="rounded-gb-xl border border-line bg-surface p-gb-lg"><Badge variant="neutral-chip">Priority {index + 1}</Badge><h3 className="mt-gb-md font-semibold text-fg">Growth opportunity</h3><p className="mt-gb-xs text-gb-sm leading-relaxed text-fg-secondary">{gap}</p></article>
          )) : <div className="rounded-gb-xl border border-line bg-surface-subtle p-gb-lg md:col-span-3"><p className="font-semibold text-fg">No high-confidence growth gaps identified yet.</p><p className="mt-gb-xs text-gb-sm text-fg-secondary">More reflected experiences may reveal clearer development opportunities.</p></div>}
        </div>
      </PersonalChapter>

      <PersonalChapter
        index={6}
        title="Long-Term Vision"
        description="The themes and directions emerging from repeated choices — presented as possibilities, not predictions."
      >
        {scalar(themes.narrative) ? <p className="max-w-4xl text-gb-sm leading-relaxed text-fg-secondary">{scalar(themes.narrative)}</p> : null}
        {futurePathways.length ? <div><h3 className="text-gb-base font-semibold text-fg">Future pathways</h3><div className="mt-gb-md grid gap-gb-md md:grid-cols-2">{futurePathways.map((pathway, index) => <article key={scalar(pathway.label) ?? index} className="rounded-gb-xl border border-line bg-surface p-gb-lg"><div className="flex flex-wrap items-start justify-between gap-gb-sm"><h4 className="font-semibold text-fg">{scalar(pathway.label) ?? `Pathway ${index + 1}`}</h4>{scalar(pathway.statusLabel) ? <Badge variant={getBadgeVariant('status', String(pathway.statusLabel))}>{scalar(pathway.statusLabel)}</Badge> : null}</div>{scalar(pathway.rationale) ? <p className="mt-gb-sm text-gb-sm leading-relaxed text-fg-secondary">{scalar(pathway.rationale)}</p> : null}{textItems(pathway.supportingExperiences).length ? <p className="mt-gb-sm text-gb-xs text-fg-muted">Supporting experiences: {textItems(pathway.supportingExperiences).join(', ')}</p> : null}</article>)}</div></div> : null}
        <div>
          <h3 className="text-gb-base font-semibold text-fg">Emerging themes</h3>
          <div className="mt-gb-md grid gap-gb-md md:grid-cols-2">
            {themeCards.length ? themeCards.map((theme, index) => <article key={scalar(theme.theme) ?? index} className="rounded-gb-xl border border-line bg-surface p-gb-lg"><div className="flex flex-wrap items-start justify-between gap-gb-sm"><h4 className="font-semibold text-fg">{scalar(theme.theme) ?? `Theme ${index + 1}`}</h4>{scalar(theme.statusLabel) ? <Badge variant={getBadgeVariant('status', String(theme.statusLabel))}>{scalar(theme.statusLabel)}</Badge> : null}</div>{scalar(theme.explanation) ? <p className="mt-gb-sm text-gb-sm leading-relaxed text-fg-secondary">{scalar(theme.explanation)}</p> : null}{textItems(theme.supportingExperiences).length ? <p className="mt-gb-sm text-gb-xs text-fg-muted">Supporting experiences: {textItems(theme.supportingExperiences).join(', ')}</p> : null}{scalar(theme.limitation) ? <p className="mt-gb-sm rounded-gb-lg bg-surface-subtle p-gb-md text-gb-xs text-fg-secondary"><span className="font-semibold text-fg">Current limitation:</span> {scalar(theme.limitation)}</p> : null}</article>) : <p className="text-gb-sm text-fg-muted">No emerging themes were persisted.</p>}
          </div>
        </div>
      </PersonalChapter>

      {Object.keys(takeaways).length ? (
        <section className="rounded-gb-2xl border border-line bg-surface p-gb-xl shadow-gb-xs sm:p-gb-2xl">
          <p className="text-gb-xs font-bold uppercase tracking-[0.14em] text-fg-brand">Closing synthesis</p>
          <h2 className="mt-gb-xs font-display text-gb-display-xs font-semibold text-fg">Key takeaways</h2>
          <div className="mt-gb-lg grid gap-gb-md md:grid-cols-3">
            {Object.entries(takeaways).map(([key, value]) => {
              const item = asRecord(value);
              return <article key={key} className="rounded-gb-xl border border-line bg-surface-subtle/40 p-gb-lg"><h3 className="font-semibold text-fg">{scalar(item.title) ?? humanize(key)}</h3><p className="mt-gb-sm text-gb-sm leading-relaxed text-fg-secondary">{scalar(item.insight ?? item.advantageStatement ?? item.growthArea ?? item.statement) ?? 'Not available'}</p>{scalar(item.whyItMatters ?? item.applicationRelevance ?? item.recommendedDirection) ? <p className="mt-gb-sm text-gb-xs leading-relaxed text-fg-muted">{scalar(item.whyItMatters ?? item.applicationRelevance ?? item.recommendedDirection)}</p> : null}</article>;
            })}
          </div>
        </section>
      ) : null}

      {overallParagraphs.length ? (
        <section className="rounded-gb-2xl border border-brand/25 bg-brand-subtle/20 p-gb-xl sm:p-gb-2xl">
          <p className="text-gb-xs font-bold uppercase tracking-[0.14em] text-fg-brand">What this report suggests overall</p>
          <div className="mt-gb-md flex flex-col gap-gb-sm">{overallParagraphs.map((paragraph) => <p key={paragraph} className="text-gb-sm leading-relaxed text-fg-secondary">{paragraph}</p>)}</div>
        </section>
      ) : null}
    </div>
  );
}

function percent(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? `${Math.round(number <= 1 ? number * 100 : number)}%` : scalar(value);
}

function FitSummary({ fit }: { fit: RecordValue }) {
  const metrics = Object.entries(asRecord(fit.metrics));
  return (
    <>
      <div className="grid gap-gb-md sm:grid-cols-4">
        {[
          ['Fit score', scalar(fit.score) ? `${scalar(fit.score)}/100` : null],
          ['Status', scalar(fit.status) ? humanize(String(fit.status)) : null],
          ['Confidence', percent(fit.confidence)],
          ['Evidence coverage', percent(fit.coverage)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-gb-xl border border-line bg-surface p-gb-lg">
            <p className="text-gb-xs font-bold uppercase tracking-wider text-fg-muted">{label}</p>
            <p className="mt-gb-xs text-gb-lg font-semibold text-fg">{value ?? 'Not available'}</p>
          </div>
        ))}
      </div>
      {scalar(fit.summary) ? <p className="max-w-4xl text-gb-sm leading-relaxed text-fg-secondary">{scalar(fit.summary)}</p> : null}
      {metrics.length ? (
        <div className="grid gap-gb-md md:grid-cols-2">
          {metrics.map(([key, value]) => {
            const metric = asRecord(value);
            const submetrics = recordItems(metric.submetrics);
            return (
              <article key={key} className="rounded-gb-xl border border-line bg-surface p-gb-lg">
                <div className="flex flex-wrap items-start justify-between gap-gb-sm">
                  <h3 className="font-semibold text-fg">{humanize(key)}</h3>
                  <div className="flex flex-wrap gap-gb-xs">
                    {scalar(metric.score) ? <Badge variant="neutral-chip">{scalar(metric.score)}/100</Badge> : null}
                    {scalar(metric.status) ? <Badge variant={getBadgeVariant('status', String(metric.status))}>{humanize(String(metric.status))}</Badge> : null}
                  </div>
                </div>
                {scalar(metric.summary) ? <p className="mt-gb-sm text-gb-sm leading-relaxed text-fg-secondary">{scalar(metric.summary)}</p> : null}
                {submetrics.length ? (
                  <div className="mt-gb-md flex flex-col gap-gb-sm border-t border-line pt-gb-md">
                    {submetrics.map((submetric, index) => <div key={index}><div className="flex flex-wrap items-center justify-between gap-gb-xs"><span className="text-gb-sm font-medium text-fg">{humanize(String(submetric.label ?? submetric.name ?? submetric.submetricId ?? `Detail ${index + 1}`))}</span>{scalar(submetric.status) ? <Badge variant={getBadgeVariant('status', String(submetric.status))}>{humanize(String(submetric.status))}</Badge> : null}</div>{scalar(submetric.reasoning ?? submetric.summary ?? submetric.explanation) ? <p className="mt-gb-xxs text-gb-xs leading-relaxed text-fg-tertiary">{scalar(submetric.reasoning ?? submetric.summary ?? submetric.explanation)}</p> : null}</div>)}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}
    </>
  );
}

function NarrativeCards({ value }: { value: unknown }) {
  const record = asRecord(value);
  const entries = Object.entries(record);
  const items = Array.isArray(value)
    ? recordItems(value).map((item, index) => [String(index), item] as const)
    : entries.some(([, item]) => item && typeof item === 'object')
      ? entries.map(([key, item]) => [key, asRecord(item)] as const)
      : entries.length
        ? [['0', record] as const]
        : [];
  if (!items.length) return <p className="text-gb-sm text-fg-muted">Not available in this report version.</p>;
  return (
    <div className="grid gap-gb-md md:grid-cols-2">
      {items.map(([key, item]) => (
        <article key={key} className="rounded-gb-xl border border-line bg-surface p-gb-lg">
          <div className="flex flex-wrap items-start justify-between gap-gb-sm">
            <h3 className="font-semibold text-fg">{scalar(item.title ?? item.label ?? item.name) ?? humanize(key)}</h3>
            {scalar(item.status ?? item.classification ?? item.strategicFit) ? <Badge variant={getBadgeVariant('status', String(item.status ?? item.classification ?? item.strategicFit))}>{humanize(String(item.status ?? item.classification ?? item.strategicFit))}</Badge> : null}
          </div>
          {scalar(item.body ?? item.description ?? item.summary ?? item.statement ?? item.diagnosis ?? item.explanation ?? item.significance ?? item.observedGap) ? <p className="mt-gb-sm text-gb-sm leading-relaxed text-fg-secondary">{scalar(item.body ?? item.description ?? item.summary ?? item.statement ?? item.diagnosis ?? item.explanation ?? item.significance ?? item.observedGap)}</p> : null}
          {scalar(item.whyItMatters ?? item.suggestedDirection ?? item.strategicInterpretation ?? item.possibleDirection) ? <p className="mt-gb-sm rounded-gb-lg bg-surface-subtle p-gb-md text-gb-xs leading-relaxed text-fg-tertiary">{scalar(item.whyItMatters ?? item.suggestedDirection ?? item.strategicInterpretation ?? item.possibleDirection)}</p> : null}
        </article>
      ))}
    </div>
  );
}

function EvidenceIndex({ output }: { output: RecordValue }) {
  const evidence = recordItems(output.evidenceIndex);
  const sources = recordItems(output.targetSourceIndex);
  if (!evidence.length && !sources.length) return null;
  return (
    <details className="group rounded-gb-xl border border-line bg-surface p-gb-lg">
      <summary className="flex cursor-pointer items-center justify-between gap-gb-sm font-semibold text-fg">
        <span>Evidence & source index</span>
        <span className="text-gb-xs font-normal text-fg-muted">{evidence.length} evidence · {sources.length} sources</span>
      </summary>
      <div className="mt-gb-md grid gap-gb-sm border-t border-line pt-gb-md md:grid-cols-2">
        {[...evidence, ...sources].map((item, index) => <article key={index} className="rounded-gb-lg bg-surface-subtle p-gb-md"><p className="text-gb-sm font-medium text-fg">{scalar(item.label ?? item.title ?? item.name) ?? `Reference ${index + 1}`}</p>{scalar(item.statement ?? item.description ?? item.quote ?? item.url) ? <p className="mt-gb-xxs break-words text-gb-xs leading-relaxed text-fg-tertiary">{scalar(item.statement ?? item.description ?? item.quote ?? item.url)}</p> : null}</article>)}
      </div>
    </details>
  );
}

function MatchingRenderer({ output }: { output: RecordValue }) {
  const overall = asRecord(output.overall);
  const universityFit = asRecord(output.universityFit);
  const programmeFit = asRecord(output.programmeFit ?? output.programmeAlignment);
  const requirementValue = output.hardRequirements ?? output.academicRequirements;
  const requirements = Array.isArray(requirementValue)
    ? recordItems(requirementValue)
    : Object.entries(asRecord(requirementValue)).map(([key, value]) => ({
        label: humanize(key),
        ...(value && typeof value === 'object' ? asRecord(value) : { requiredValue: value }),
      }));
  return (
    <div className="flex flex-col gap-gb-2xl" data-testid="matching-report-readable-output">
      <section className="rounded-gb-2xl border border-brand/25 bg-brand-subtle/20 p-gb-xl sm:p-gb-2xl">
        <p className="text-gb-xs font-bold uppercase tracking-[0.14em] text-fg-brand">Matching Report overview</p>
        <div className="mt-gb-sm flex flex-wrap items-start justify-between gap-gb-lg">
          <p className="max-w-3xl text-gb-sm leading-relaxed text-fg-secondary">{scalar(overall.summary) ?? 'University and programme alignment, shown in the same decision order as the student report.'}</p>
          <div className="flex flex-wrap gap-gb-xs">{scalar(overall.overallAlignmentScore) ? <Badge variant="neutral-chip">{scalar(overall.overallAlignmentScore)}/100 overall fit</Badge> : null}{percent(overall.confidence) ? <Badge variant="info-chip">{percent(overall.confidence)} confidence</Badge> : null}{percent(overall.evidenceCoverage) ? <Badge variant="brand-chip">{percent(overall.evidenceCoverage)} evidence coverage</Badge> : null}</div>
        </div>
      </section>

      <PersonalChapter index={1} eyebrow="Matching Report" title="University Fit" description="How the student's profile aligns with the university's academic environment, values and wider community."><FitSummary fit={universityFit} /></PersonalChapter>
      <PersonalChapter index={2} eyebrow="Matching Report" title="Programme Fit" description="How the student's preparation, capabilities and direction align with the selected programme.">
        <FitSummary fit={programmeFit} />
        {scalar(programmeFit.potentialGap) ? <p className="rounded-gb-xl border border-line bg-surface-subtle p-gb-lg text-gb-sm text-fg-secondary"><span className="font-semibold text-fg">Potential gap:</span> {scalar(programmeFit.potentialGap)}</p> : null}
        {scalar(programmeFit.strategicInterpretation) ? <p className="rounded-gb-xl border border-brand/20 bg-brand-subtle/20 p-gb-lg text-gb-sm text-fg-secondary"><span className="font-semibold text-fg">Strategic interpretation:</span> {scalar(programmeFit.strategicInterpretation)}</p> : null}
      </PersonalChapter>
      <PersonalChapter index={3} eyebrow="Matching Report" title="Key Takeaways & Strategic Direction" description="The strongest match, competitive edge, critical gap and recommended application direction."><NarrativeCards value={output.keyTakeaways} /></PersonalChapter>
      <PersonalChapter index={4} eyebrow="Matching Report" title="Strengths, Gaps & Opportunities" description="The profile signals admissions readers are most likely to notice and how they can be positioned.">
        {[['Strengths', output.strengths], ['Gaps', output.gaps], ['Positioning opportunities', output.positioningOpportunities]].map(([title, value]) => <div key={title as string}><h3 className="mb-gb-md text-gb-base font-semibold text-fg">{title as string}</h3><NarrativeCards value={value} /></div>)}
        {output.scholarshipAlignment ? <div><h3 className="mb-gb-md text-gb-base font-semibold text-fg">Scholarship alignment</h3><NarrativeCards value={output.scholarshipAlignment} /></div> : null}
      </PersonalChapter>
      <PersonalChapter index={5} eyebrow="Matching Report" title="Hard Requirements & Eligibility" description="Confirmed, missing or unknown eligibility requirements that need action before submission.">
        {requirements.length ? <div className="grid gap-gb-md md:grid-cols-2">{requirements.map((requirement, index) => <article key={scalar(requirement.label) ?? index} className="rounded-gb-xl border border-line bg-surface p-gb-lg"><div className="flex flex-wrap items-start justify-between gap-gb-sm"><h3 className="font-semibold text-fg">{scalar(requirement.label) ?? `Requirement ${index + 1}`}</h3>{scalar(requirement.status) ? <Badge variant={getBadgeVariant('status', String(requirement.status))}>{humanize(String(requirement.status))}</Badge> : null}</div><dl className="mt-gb-md grid gap-gb-sm text-gb-sm sm:grid-cols-2"><div><dt className="text-gb-xs font-bold uppercase tracking-wider text-fg-muted">Applicant</dt><dd className="mt-gb-xxs text-fg">{scalar(requirement.applicantValue) ?? 'Not found'}</dd></div><div><dt className="text-gb-xs font-bold uppercase tracking-wider text-fg-muted">Required</dt><dd className="mt-gb-xxs text-fg">{scalar(requirement.requiredValue) ?? 'Not available'}</dd></div></dl>{scalar(requirement.explanation) ? <p className="mt-gb-md text-gb-sm leading-relaxed text-fg-secondary">{scalar(requirement.explanation)}</p> : null}</article>)}</div> : <p className="text-gb-sm text-fg-muted">No hard requirements were persisted in this report version.</p>}
      </PersonalChapter>
      <EvidenceIndex output={output} />
    </div>
  );
}

function StrategyRenderer({ output }: { output: RecordValue }) {
  const overview = asRecord(output.strategicOverview);
  const current = asRecord(overview.currentPosition);
  const goal = asRecord(overview.strategicGoal);
  const priorities = recordItems(overview.topPriorities);
  const profile = asRecord(output.profileDevelopmentStrategy);
  const activities = recordItems(profile.activityAnalyses);
  const narrative = asRecord(output.narrativeStrategy);
  const coreNarrative = asRecord(narrative.coreNarrativeDirection);
  const roadmap = recordItems(output.strategicRoadmap);
  return (
    <div className="flex flex-col gap-gb-2xl" data-testid="strategy-report-readable-output">
      <PersonalChapter index={1} eyebrow="Strategy Report" title="Strategic Overview" description="The student's current position, highest-leverage opportunity, strategic goal and top priorities.">
        {scalar(current.summary) ? <p className="max-w-4xl text-gb-sm leading-relaxed text-fg-secondary">{scalar(current.summary)}</p> : null}
        <NarrativeCards value={[asRecord(current.profileStrength), asRecord(current.keyChallenge), asRecord(overview.strategicOpportunity)].filter((item) => Object.keys(item).length)} />
        <div className="grid gap-gb-md md:grid-cols-2"><article className="rounded-gb-xl border border-line bg-surface p-gb-lg"><h3 className="font-semibold text-fg">Strategic goal</h3><ReadableList items={[scalar(goal.directionOfImprovement), scalar(goal.communicationGoal)].filter((item): item is string => Boolean(item))} /></article><article className="rounded-gb-xl border border-brand/20 bg-brand-subtle/20 p-gb-lg"><h3 className="font-semibold text-fg">Expected outcome</h3><p className="mt-gb-sm text-gb-sm leading-relaxed text-fg-secondary">{scalar(overview.expectedOutcome) ?? 'Not available'}</p></article></div>
        <div><h3 className="text-gb-base font-semibold text-fg">Top strategic priorities</h3><div className="mt-gb-md flex flex-col gap-gb-md">{priorities.length ? priorities.map((priority, index) => { const factors = asRecord(priority.factors); return <article key={scalar(priority.title) ?? index} className="rounded-gb-xl border border-line bg-surface p-gb-lg"><div className="flex flex-wrap items-start gap-gb-sm"><Badge variant="brand-chip">Priority {scalar(priority.rank) ?? index + 1}</Badge><h4 className="font-semibold text-fg">{scalar(priority.title) ?? `Priority ${index + 1}`}</h4></div>{scalar(priority.why) ? <p className="mt-gb-sm text-gb-sm leading-relaxed text-fg-secondary">{scalar(priority.why)}</p> : null}{scalar(priority.suggestedDirection) ? <p className="mt-gb-sm rounded-gb-lg bg-surface-subtle p-gb-md text-gb-sm text-fg-secondary"><span className="font-semibold text-fg">Recommended move:</span> {scalar(priority.suggestedDirection)}</p> : null}<div className="mt-gb-sm flex flex-wrap gap-gb-xs">{Object.entries(factors).filter(([key]) => key !== 'rawPriority').map(([key, value]) => scalar(value) ? <Badge key={key} variant="neutral-chip">{humanize(key)} {scalar(value)}/4</Badge> : null)}</div></article>; }) : <p className="text-gb-sm text-fg-muted">No priorities were persisted.</p>}</div></div>
      </PersonalChapter>

      <PersonalChapter index={2} eyebrow="Strategy Report" title="Profile Development Strategy" description="What to maintain, strengthen or reposition across the profile and each major activity.">
        <NarrativeCards value={profile.areas} />
        <div><h3 className="text-gb-base font-semibold text-fg">Activity-level evaluation</h3><div className="mt-gb-md flex flex-col gap-gb-md">{activities.length ? activities.map((activity, index) => <article key={scalar(activity.title) ?? index} className="rounded-gb-xl border border-line bg-surface p-gb-lg"><div className="flex flex-wrap items-start justify-between gap-gb-sm"><h4 className="font-semibold text-fg">{scalar(activity.title) ?? `Activity ${index + 1}`}</h4>{scalar(activity.classification) ? <Badge variant={getBadgeVariant('status', String(activity.classification))}>{humanize(String(activity.classification))}</Badge> : null}</div>{scalar(activity.diagnosis) ? <p className="mt-gb-sm text-gb-sm leading-relaxed text-fg-secondary">{scalar(activity.diagnosis)}</p> : null}{scalar(activity.recommendedMove) ? <p className="mt-gb-sm rounded-gb-lg bg-surface-subtle p-gb-md text-gb-sm text-fg-secondary"><span className="font-semibold text-fg">Recommended move:</span> {scalar(activity.recommendedMove)}</p> : null}<div className="mt-gb-md grid gap-gb-sm sm:grid-cols-2">{Object.entries(asRecord(activity.dimensions)).map(([key, value]) => { const dimension = asRecord(value); return <div key={key} className="rounded-gb-lg border border-line p-gb-md"><div className="flex flex-wrap items-center justify-between gap-gb-xs"><span className="text-gb-sm font-medium text-fg">{humanize(key)}</span>{scalar(dimension.status) ? <Badge variant={getBadgeVariant('status', String(dimension.status))}>{humanize(String(dimension.status))}</Badge> : null}</div>{scalar(dimension.statement) ? <p className="mt-gb-xs text-gb-xs leading-relaxed text-fg-tertiary">{scalar(dimension.statement)}</p> : null}</div>; })}</div></article>) : <p className="text-gb-sm text-fg-muted">No activity analysis was persisted.</p>}</div></div>
      </PersonalChapter>

      <PersonalChapter index={3} eyebrow="Strategy Report" title="Narrative Strategy" description="The story arc that connects the student's origin, motivation, actions, capabilities and emerging direction.">
        <div className="grid gap-gb-md md:grid-cols-5">{[['Origin', coreNarrative.originTrigger], ['Motivation', coreNarrative.recurringMotivation], ['Actions', coreNarrative.actions], ['Capabilities', coreNarrative.capabilitiesDeveloped], ['Direction', coreNarrative.emergingDirection]].map(([label, value], index) => <article key={label as string} className="rounded-gb-xl border border-line bg-surface p-gb-lg"><p className="text-gb-xs font-bold uppercase tracking-wider text-fg-brand">{index + 1}. {label as string}</p>{Array.isArray(value) ? <div className="mt-gb-sm"><ReadableList items={textItems(value)} /></div> : <p className="mt-gb-sm text-gb-sm leading-relaxed text-fg-secondary">{scalar(value) ?? 'Not available'}</p>}</article>)}</div>
        {scalar(coreNarrative.insight) ? <p className="rounded-gb-xl border border-brand/20 bg-brand-subtle/20 p-gb-lg text-gb-sm leading-relaxed text-fg-secondary">{scalar(coreNarrative.insight)}</p> : null}
        <div><h3 className="mb-gb-md text-gb-base font-semibold text-fg">Supporting themes</h3><NarrativeCards value={narrative.supportingThemes} /></div>
        {Object.keys(asRecord(narrative.narrativeTension)).length ? <div><h3 className="mb-gb-md text-gb-base font-semibold text-fg">Narrative tension</h3><NarrativeCards value={[asRecord(narrative.narrativeTension)]} /></div> : null}
        <div><h3 className="mb-gb-md text-gb-base font-semibold text-fg">Narrative options</h3><div className="grid gap-gb-md md:grid-cols-2">{recordItems(narrative.narrativeOptions).map((option, index) => <article key={scalar(option.title) ?? index} className="rounded-gb-xl border border-line bg-surface p-gb-lg"><div className="flex flex-wrap items-start justify-between gap-gb-sm"><h4 className="font-semibold text-fg">{scalar(option.title) ?? `Option ${index + 1}`}</h4>{scalar(option.strategicFit) ? <Badge variant={getBadgeVariant('status', String(option.strategicFit))}>{humanize(String(option.strategicFit))} fit</Badge> : null}</div>{scalar(option.centralIdea) ? <p className="mt-gb-sm text-gb-sm leading-relaxed text-fg-secondary">{scalar(option.centralIdea)}</p> : null}{scalar(option.whyItEmerges) ? <p className="mt-gb-sm text-gb-xs leading-relaxed text-fg-tertiary"><span className="font-semibold text-fg">Why it emerges:</span> {scalar(option.whyItEmerges)}</p> : null}{scalar(option.whatCouldStrengthenIt) ? <p className="mt-gb-sm text-gb-xs leading-relaxed text-fg-tertiary"><span className="font-semibold text-fg">What strengthens it:</span> {scalar(option.whatCouldStrengthenIt)}</p> : null}</article>)}</div></div>
      </PersonalChapter>

      <PersonalChapter index={4} eyebrow="Strategy Report" title="Strategic Roadmap" description="The sequenced actions, deliverables and success criteria that turn the strategy into an execution plan.">
        <div className="flex flex-col gap-gb-lg">{roadmap.length ? roadmap.map((phase, index) => <article key={scalar(phase.phaseKey ?? phase.name) ?? index} className="rounded-gb-xl border border-line bg-surface p-gb-lg"><div className="flex flex-wrap items-start justify-between gap-gb-sm"><div><p className="text-gb-xs font-bold uppercase tracking-wider text-fg-brand">Phase {index + 1}</p><h3 className="mt-gb-xxs font-semibold text-fg">{scalar(phase.name) ?? humanize(String(phase.phaseKey ?? `Phase ${index + 1}`))}</h3></div>{scalar(phase.estimatedTimeline) ? <Badge variant="neutral-chip">{scalar(phase.estimatedTimeline)}</Badge> : null}</div>{scalar(phase.goal) ? <p className="mt-gb-md text-gb-sm leading-relaxed text-fg-secondary">{scalar(phase.goal)}</p> : null}<div className="mt-gb-md grid gap-gb-md md:grid-cols-3"><div><h4 className="mb-gb-sm text-gb-xs font-bold uppercase tracking-wider text-fg-muted">Key actions</h4><ReadableList items={textItems(phase.keyActions)} /></div><div><h4 className="mb-gb-sm text-gb-xs font-bold uppercase tracking-wider text-fg-muted">Deliverables</h4><ReadableList items={recordItems(phase.deliverables).map((item) => scalar(item.label ?? item.title ?? item.name)).filter((item): item is string => Boolean(item))} /></div><div><h4 className="mb-gb-sm text-gb-xs font-bold uppercase tracking-wider text-fg-muted">Success criteria</h4><ReadableList items={textItems(phase.successCriteria)} /></div></div></article>) : <p className="text-gb-sm text-fg-muted">No roadmap was persisted.</p>}</div>
      </PersonalChapter>
      <EvidenceIndex output={output} />
    </div>
  );
}

function LegacyRenderer({ output }: { output: unknown }) {
  return (
    <div className="flex flex-col gap-gb-xl">
      <div className="rounded-gb-xl border border-amber-200 border-l-4 border-l-amber-500 bg-amber-50/70 p-gb-lg shadow-gb-xxs flex items-start gap-gb-md">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-gb-lg bg-amber-100 text-amber-700 border border-amber-200/80">
          <KitIcon art={ICONS.zap} frame={16} className="text-amber-600" />
        </div>
        <div className="flex flex-col gap-gb-xxs min-w-0">
          <div className="flex items-center gap-gb-xs flex-wrap">
            <span className="font-semibold text-gb-sm text-amber-950">
              Legacy or partially validated output
            </span>
            <span className="rounded-full bg-amber-100 border border-amber-300 px-gb-xs py-gb-xxs text-gb-xxs font-bold uppercase tracking-wider text-amber-900">
              Notice
            </span>
          </div>
          <p className="text-gb-xs text-amber-900 leading-relaxed font-normal">
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
                <span className="flex items-center gap-1 text-emerald-600 font-medium">
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
