'use client';

import { useState } from 'react';
import type {
  AdminAiReportInputSection,
  AdminAiReportReview,
  AdminAiReportReviewListItem,
  AdminAiReportReviewNode,
} from '@/features/ai-strategy-dashboard/api';
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
  return /summary|description|statement|narrative|rationale|headline|overview|notes|takeaway/i.test(key);
}

function getBadgeVariant(key: string, val: string): BadgeVariant {
  const lower = val.toLowerCase().trim();
  if (
    lower.includes('established') ||
    lower === 'high' ||
    lower === 'comprehensive' ||
    lower === 'complete' ||
    lower === 'safe' ||
    lower === 'persisted'
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
  const isStatusOrRating = /status|rating|alignment|classification|kind|tier|coverage/i.test(key);
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
  }

  if (isStatusOrRating) {
    return <Badge variant={getBadgeVariant(key, val)}>{humanize(val)}</Badge>;
  }

  return <span>{val}</span>;
}

function ObjectItemCard({ item, omitIdentity }: { item: RecordValue; omitIdentity?: boolean }) {
  const rawTitle = scalar(item.name ?? item.title ?? item.headline ?? item.label ?? item.theme);
  const rawStatus = scalar(item.status ?? item.alignment ?? item.classification);
  const rawConfidence = item.confidence ?? item.confidenceScore;
  const count = scalar(item.evidenceCount ?? item.count);

  const title = rawTitle ? humanize(rawTitle) : null;
  const status = rawStatus ? humanize(rawStatus) : null;

  const entries = Object.entries(item).filter(([k]) => {
    if (omitIdentity && /(^id$|_id$|ids$|refs$|hash|schemaVersion|createdAt|confirmedAt)/i.test(k)) {
      return false;
    }
    if (rawTitle && /(^name$|^title$|^headline$|^theme$)/i.test(k)) return false;
    if (rawStatus && /(^status$|^alignment$|^classification$)/i.test(k)) return false;
    if (rawConfidence !== undefined && /confidence/i.test(k)) return false;
    if (count && /(^evidenceCount$|^count$)/i.test(k)) return false;
    return true;
  });

  return (
    <div className="rounded-gb-xl border border-line bg-surface-subtle/40 p-gb-lg hover:border-line-strong transition-colors flex flex-col gap-gb-sm">
      <div className="flex flex-wrap items-start justify-between gap-gb-xs">
        <h4 className="font-semibold text-gb-sm text-fg">
          {title ?? 'Item'}
        </h4>
        <div className="flex flex-wrap items-center gap-gb-xs">
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
        <div className="mt-gb-xs border-t border-line/40 pt-gb-sm">
          <StructuredDataView value={Object.fromEntries(entries)} omitIdentity={omitIdentity} depth={2} />
        </div>
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
  // If top-level object only contains a single 'report' object wrapper, unwrap it for cleaner hierarchy
  if (
    depth === 0 &&
    'report' in targetValue &&
    Object.keys(targetValue).length === 1 &&
    targetValue.report !== null &&
    typeof targetValue.report === 'object' &&
    !Array.isArray(targetValue.report)
  ) {
    targetValue = targetValue.report as RecordValue;
  }

  const entries = Object.entries(targetValue).filter(
    ([key]) => !omitIdentity || !/(^id$|_id$|ids$|refs$|hash|schemaVersion|createdAt|confirmedAt)/i.test(key)
  );

  if (!entries.length) return <span className="text-fg-muted">No human-readable value persisted</span>;

  // At depth 0, render each entry as a prominent section card
  if (depth === 0) {
    return (
      <div className="flex flex-col gap-gb-xl">
        {entries.map(([key, child]) => (
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
    <div className="flex flex-col gap-gb-lg">
      {/* 1. Narrative Callouts */}
      {narratives.map(([k, v]) => (
        <div
          key={k}
          className="rounded-gb-lg border-l-4 border-brand bg-brand-subtle/30 p-gb-lg text-gb-sm leading-relaxed text-fg"
        >
          <span className="block text-gb-xs font-semibold uppercase tracking-wider text-fg-brand mb-gb-xs">
            {humanize(k)}
          </span>
          <p className="text-gb-sm leading-relaxed text-fg">{v}</p>
        </div>
      ))}

      {/* 2. KPI / Scalar Metric Tiles */}
      {scalars.length > 0 ? (
        <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-gb-md">
          {scalars.map(([k, v]) => (
            <div
              key={k}
              className="rounded-gb-lg border border-line/70 bg-surface-subtle/60 p-gb-md flex flex-col gap-gb-xs"
            >
              <dt className="text-gb-xs font-semibold uppercase tracking-wider text-fg-muted">
                {humanize(k)}
              </dt>
              <dd className="text-gb-sm font-semibold text-fg">
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

        const isAllObjects = items.every((it) => it && typeof it === 'object' && !Array.isArray(it));
        if (isAllObjects) {
          return (
            <div key={k} className="flex flex-col gap-gb-sm">
              <div className="flex items-center justify-between">
                <h4 className="text-gb-sm font-semibold text-fg">{humanize(k)}</h4>
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
      <div className="rounded-gb-xl border border-amber-500/30 bg-amber-500/10 p-gb-lg text-gb-sm text-amber-950 dark:text-amber-200 flex flex-col gap-gb-xs">
        <div className="flex items-center gap-gb-sm font-semibold text-amber-900 dark:text-amber-100">
          <KitIcon art={ICONS.zap} frame={16} className="text-amber-600 dark:text-amber-400" />
          <span>Legacy or partially validated output</span>
        </div>
        <p className="text-gb-xs text-amber-800 dark:text-amber-300">
          The report contract is older or contains historical references that no longer validate. The stored content is shown below in a readable form; raw JSON remains available in Technical.
        </p>
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

function InputsView({ sections }: { sections: AdminAiReportInputSection[] }) {
  if (!sections.length) {
    return <p className="text-gb-sm text-fg-muted">Exact historical input not persisted.</p>;
  }
  return (
    <div className="flex flex-col gap-gb-xl">
      {sections.map((section) => (
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
          <StructuredDataView value={section.value} omitIdentity depth={1} />
        </section>
      ))}
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
  onSelect,
}: {
  node: AdminAiReportReviewNode;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      disabled={!node.available}
      aria-pressed={selected}
      aria-label={`View ${node.title}`}
      onClick={() => onSelect(node.id)}
      className={`min-w-44 rounded-gb-xl border p-gb-xl text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
        node.available
          ? selected
            ? 'border-brand bg-surface-hover text-fg'
            : 'border-line bg-surface text-fg hover:border-line-strong hover:bg-surface-hover'
          : 'cursor-not-allowed border-line bg-surface-subtle text-fg-muted'
      }`}
    >
      <span className="block text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">
        {node.available ? 'Stored report' : 'Waiting on report'}
      </span>
      <span className="mt-gb-xs block text-gb-md font-semibold">{node.title}</span>
      <span className="mt-gb-xs block text-gb-xs text-fg-tertiary">{formatDate(node.generatedAt)}</span>
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
    <div aria-label="AI report flow" className="flex flex-col items-stretch gap-gb-md md:flex-row md:items-center">
      {review.nodes.map((node, index) => (
        <div key={node.kind} className="flex min-w-0 flex-1 flex-col gap-gb-md md:flex-row md:items-center">
          <FlowNode node={node} selected={node.id === selectedNodeId} onSelect={onSelect} />
          {index < review.nodes.length - 1 ? (
            <span aria-hidden="true" className="self-center text-gb-lg font-semibold text-brand md:shrink-0">
              →
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function DetailPanel({ node }: { node: AdminAiReportReviewNode }) {
  const [tab, setTab] = useState<'output' | 'inputs' | 'technical'>('output');

  return (
    <Panel className="flex flex-col gap-gb-xl">
      <PanelHeader
        title={node.title}
        description="Read-only canonical output, reconstructed inputs and technical lineage."
      />
      <div role="tablist" aria-label="Report detail">
        <div className="flex flex-wrap gap-gb-xs border-b border-line">
          {([
            ['output', 'Output'],
            ['inputs', 'Inputs'],
            ['technical', 'Technical'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={`rounded-t-gb-lg px-gb-xl py-gb-md text-gb-sm font-semibold transition-colors border-b-2 -mb-px ${
                tab === value
                  ? 'border-brand bg-brand-subtle/30 text-fg-brand'
                  : 'border-transparent text-fg-muted hover:text-fg hover:bg-surface-hover'
              }`}
            >
              {label}
            </button>
          ))}
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
        <label htmlFor="ai-report-application" className="text-gb-sm font-semibold text-fg">
          Select an application
        </label>
        <select
          id="ai-report-application"
          value={applicationId}
          onChange={(event) => void selectApplication(event.target.value)}
          className="w-full rounded-gb-xl border border-line bg-surface px-gb-xl py-gb-lg text-gb-sm text-fg focus:outline-none focus:ring-2 focus:ring-brand"
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
