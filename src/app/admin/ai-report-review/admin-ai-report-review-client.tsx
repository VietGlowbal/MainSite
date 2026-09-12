'use client';

import { useState } from 'react';
import type {
  AdminAiReportReview,
  AdminAiReportReviewListItem,
  AdminAiReportReviewNode,
} from '@/features/ai-strategy-dashboard/api';
import { Panel, PanelHeader } from '@/shared/ui';

type DetailState =
  | { kind: 'ready'; review: AdminAiReportReview | null }
  | { kind: 'loading'; review: AdminAiReportReview | null }
  | { kind: 'error'; review: AdminAiReportReview | null; message: string };

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function firstAvailableNode(review: AdminAiReportReview | null): string | null {
  return review?.nodes.find((node) => node.available)?.id ?? null;
}

function outputText(value: unknown) {
  return value === null ? 'No report generated yet.' : JSON.stringify(value, null, 2);
}

function FlowNode({ node, selected, onSelect }: {
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
      <span className="block text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">{node.available ? 'Stored report' : 'Waiting on report'}</span>
      <span className="mt-gb-xs block text-gb-md font-semibold">{node.title}</span>
      <span className="mt-gb-xs block text-gb-xs text-fg-tertiary">{formatDate(node.generatedAt)}</span>
    </button>
  );
}

function ReportFlow({ review, selectedNodeId, onSelect }: {
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
            <span aria-hidden="true" className="self-center text-gb-lg font-semibold text-brand md:shrink-0">→</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function AdminAiReportReviewClient({ items, initialReview }: {
  items: AdminAiReportReviewListItem[];
  initialReview: AdminAiReportReview | null;
}) {
  const [state, setState] = useState<DetailState>({ kind: 'ready', review: initialReview });
  const [applicationId, setApplicationId] = useState(initialReview?.application.applicationId ?? items[0]?.applicationId ?? '');
  const [selectedNodeId, setSelectedNodeId] = useState(firstAvailableNode(initialReview));

  async function selectApplication(nextApplicationId: string) {
    setApplicationId(nextApplicationId);
    setState({ kind: 'loading', review: null });
    setSelectedNodeId(null);
    try {
      const response = await fetch(`/api/admin/ai-report-review?applicationId=${encodeURIComponent(nextApplicationId)}`, { cache: 'no-store' });
      const body = await response.json().catch(() => ({})) as { review?: AdminAiReportReview; error?: string };
      if (!response.ok || !body.review) throw new Error(body.error ?? 'Could not load report details.');
      setState({ kind: 'ready', review: body.review });
      setSelectedNodeId(firstAvailableNode(body.review));
    } catch (error) {
      setState({ kind: 'error', review: null, message: error instanceof Error ? error.message : 'Could not load report details.' });
    }
  }

  if (items.length === 0) {
    return <Panel className="text-gb-sm text-fg-muted">No reviewable reports yet.</Panel>;
  }

  const review = state.review;
  const selectedNode = review?.nodes.find((node) => node.id === selectedNodeId) ?? review?.nodes.find((node) => node.available) ?? null;

  return (
    <div className="flex flex-col gap-gb-3xl">
      <Panel className="flex flex-col gap-gb-md">
        <label htmlFor="ai-report-application" className="text-gb-sm font-semibold text-fg">Select an application</label>
        <select
          id="ai-report-application"
          value={applicationId}
          onChange={(event) => void selectApplication(event.target.value)}
          className="w-full rounded-gb-xl border border-line bg-surface px-gb-xl py-gb-lg text-gb-sm text-fg focus:outline-none focus:ring-2 focus:ring-brand"
        >
          {items.map((item) => (
            <option key={item.applicationId} value={item.applicationId}>
              {[item.courseName, item.universityName, item.subject].filter(Boolean).join(' · ') || item.applicationId}
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
              description={[review.application.universityName, review.application.subject].filter(Boolean).join(' · ') || undefined}
            />
            <ReportFlow review={review} selectedNodeId={selectedNodeId} onSelect={setSelectedNodeId} />
          </Panel>

          {selectedNode ? (
            <Panel className="grid gap-gb-3xl lg:grid-cols-[minmax(16rem,0.7fr)_minmax(0,1.3fr)]">
              <div className="flex flex-col gap-gb-xl">
                <PanelHeader title={selectedNode.title} description="Input lineage and generation metadata." />
                <dl className="flex flex-col gap-gb-lg text-gb-sm">
                  <div><dt className="text-fg-muted">Generated</dt><dd className="font-medium text-fg">{formatDate(selectedNode.generatedAt)}</dd></div>
                  <div><dt className="text-fg-muted">Model</dt><dd className="font-medium text-fg">{selectedNode.modelName ?? '—'}</dd></div>
                  <div><dt className="text-fg-muted">Prompt</dt><dd className="break-all font-medium text-fg">{selectedNode.promptVersion ?? '—'}</dd></div>
                  <div><dt className="text-fg-muted">Input hash</dt><dd className="break-all font-mono text-gb-xs text-fg">{selectedNode.inputHash ?? '—'}</dd></div>
                </dl>
                <div className="flex flex-col gap-gb-sm">
                  <h3 className="text-gb-sm font-semibold text-fg">Input lineage</h3>
                  <dl className="flex flex-col gap-gb-sm text-gb-xs">
                    {selectedNode.sources.map((source) => (
                      <div key={source.label} className="flex flex-col gap-gb-xxs">
                        <dt className="text-fg-muted">{source.label}</dt>
                        <dd className="break-all font-mono text-fg">{source.value ?? '—'}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
                <p className="text-gb-xs text-fg-muted">Raw prompts and model responses are not stored in this review.</p>
              </div>
              <div className="min-w-0">
                <h3 className="mb-gb-lg text-gb-sm font-semibold text-fg">Stored output</h3>
                <pre className="max-h-[42rem] overflow-auto rounded-gb-xl bg-surface-subtle p-gb-xl text-wrap break-words font-mono text-gb-xs leading-relaxed text-fg">
                  {outputText(selectedNode.output)}
                </pre>
              </div>
            </Panel>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
