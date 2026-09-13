'use client';

import { useState } from 'react';
import type {
  AdminAiReportInputSection,
  AdminAiReportReview,
  AdminAiReportReviewListItem,
  AdminAiReportReviewNode,
} from '@/features/ai-strategy-dashboard/api';
import { Panel, PanelHeader } from '@/shared/ui';

type DetailState =
  | { kind: 'ready'; review: AdminAiReportReview | null }
  | { kind: 'loading'; review: AdminAiReportReview | null }
  | { kind: 'error'; review: AdminAiReportReview | null; message: string };
type RecordValue = Record<string, unknown>;

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}
function firstAvailableNode(review: AdminAiReportReview | null): string | null { return review?.nodes.find((node) => node.available)?.id ?? null; }
function humanize(value: string) { return value.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' ').replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function scalar(value: unknown): string | null { if (value === null || value === undefined || value === '') return null; if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value); return null; }

function ValueList({ values, omitIdentity }: { values: unknown[]; omitIdentity?: boolean }) { return values.length ? <ul className="flex list-disc flex-col gap-gb-xs pl-gb-xl">{values.map((value, index) => <li key={index}><StructuredDataView value={value} omitIdentity={omitIdentity} /></li>)}</ul> : <span className="text-fg-muted">Not available</span>; }
function StructuredDataView({ value, omitIdentity = false, depth = 0 }: { value: unknown; omitIdentity?: boolean; depth?: number }) {
  const text = scalar(value);
  if (text !== null) return <span>{text}</span>;
  if (value === null || value === undefined) return <span className="text-fg-muted">Not available</span>;
  if (Array.isArray(value)) return <ValueList values={value} omitIdentity={omitIdentity} />;
  if (typeof value !== 'object') return <span>{String(value)}</span>;
  const entries = Object.entries(value as RecordValue).filter(([key]) => !omitIdentity || !/(^id$|_id$|ids$|refs$|hash|schemaVersion|createdAt|confirmedAt)/i.test(key));
  if (!entries.length) return <span className="text-fg-muted">No human-readable value persisted</span>;
  return <dl className="grid gap-gb-sm">{entries.map(([key, child]) => <div key={key} className={depth > 1 ? 'border-l border-line pl-gb-lg' : ''}><dt className="text-gb-xs font-semibold text-fg-muted">{humanize(key)}</dt><dd className="mt-gb-xxs text-gb-sm text-fg-secondary">{Array.isArray(child) && child.length > 4 ? <details><summary className="cursor-pointer text-fg">{child.length} items</summary><div className="mt-gb-sm"><ValueList values={child} omitIdentity={omitIdentity} /></div></details> : <StructuredDataView value={child} omitIdentity={omitIdentity} depth={depth + 1} />}</dd></div>)}</dl>;
}
function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section className="flex flex-col gap-gb-sm"><h3 className="text-gb-sm font-semibold text-fg">{title}</h3>{children}</section>; }

function PersonalRenderer({ output }: { output: RecordValue }) {
  const sections = [['Core Identity', output.coreIdentity], ['Driving Force', output.drivingForce], ['Signature Pattern', output.signaturePattern], ['Emerging Themes', output.emergingThemes], ['Personal Positioning', output.personalPositioning], ['Proof of Me', output.proofOfMe]] as const;
  return <div className="flex flex-col gap-gb-2xl">{sections.map(([title, value]) => <Section key={title} title={title}><StructuredDataView value={value} /></Section>)}{scalar(output.overallSummary) ? <Section title="Overall summary"><p className="text-gb-sm leading-relaxed text-fg-secondary">{scalar(output.overallSummary)}</p></Section> : null}</div>;
}
function ReferenceList({ ids, evidence, targets }: { ids: unknown; evidence: RecordValue[]; targets: RecordValue[] }) {
  const values = Array.isArray(ids) ? ids : [];
  if (!values.length) return null;
  return <ul className="flex flex-wrap gap-gb-xs">{values.flatMap((id) => Array.isArray(id) ? id : [id]).filter((id): id is string | number => typeof id === 'string' || typeof id === 'number').map((id) => { const key = String(id); const match = evidence.find((item) => item.id === key) ?? targets.find((item) => item.ref === key); return <li key={key} className="rounded-full border border-line bg-surface-subtle px-gb-sm py-gb-xxs text-gb-xs text-fg-secondary">{scalar(match?.label ?? match?.title) ?? humanize(key)}</li>; })}</ul>;
}
function MatchingRenderer({ output }: { output: RecordValue }) {
  const evidence = Array.isArray(output.evidenceIndex) ? output.evidenceIndex as RecordValue[] : [];
  const targets = Array.isArray(output.targetSourceIndex) ? output.targetSourceIndex as RecordValue[] : [];
  const overall = output.overall as RecordValue | undefined;
  const groups = [['University fit', output.universityFit], ['Programme fit', output.programmeFit], ['Hard requirements', output.hardRequirements ?? output.academicRequirements], ['Strengths', output.strengths], ['Gaps', output.gaps], ['Positioning opportunities', output.positioningOpportunities], ['Scholarship alignment', output.scholarshipAlignment]] as const;
  return <div className="flex flex-col gap-gb-2xl"><Section title="Overall assessment"><StructuredDataView value={overall} /><ReferenceList ids={overall?.summaryEvidenceIds ?? overall?.summaryTargetSourceRefs} evidence={evidence} targets={targets} /></Section>{output.keyTakeaways ? <Section title="Key takeaways"><StructuredDataView value={output.keyTakeaways} /></Section> : null}{groups.map(([title, value]) => value ? <Section key={title} title={title}><StructuredDataView value={value} /><ReferenceList ids={Array.isArray(value) ? value.flatMap((item) => item && typeof item === 'object' ? [(item as RecordValue).evidenceIds, (item as RecordValue).targetSourceRefs] : []) : undefined} evidence={evidence} targets={targets} /></Section> : null)}<Section title="Evidence & sources"><details><summary className="cursor-pointer text-gb-sm text-fg">{evidence.length} evidence items · {targets.length} target sources</summary><div className="mt-gb-md flex flex-col gap-gb-lg"><StructuredDataView value={evidence} /><StructuredDataView value={targets} /></div></details></Section></div>;
}
function StrategyRenderer({ output }: { output: RecordValue }) {
  const overview = output.strategicOverview as RecordValue | undefined;
  const profile = output.profileDevelopmentStrategy as RecordValue | undefined;
  const roadmap = Array.isArray(output.strategicRoadmap) ? output.strategicRoadmap : [];
  return <div className="flex flex-col gap-gb-2xl"><Section title="Strategic overview"><StructuredDataView value={overview} /></Section><Section title="Priorities"><StructuredDataView value={overview?.topPriorities} /></Section><Section title="Profile development"><StructuredDataView value={profile?.areas} /></Section><Section title="Activities"><StructuredDataView value={profile?.activityAnalyses} /></Section><Section title="Narrative strategy"><StructuredDataView value={output.narrativeStrategy} /></Section><Section title="Four-phase roadmap"><div className="grid gap-gb-md md:grid-cols-2">{roadmap.map((phase, index) => <details key={index} className="rounded-gb-xl border border-line p-gb-lg"><summary className="cursor-pointer font-semibold text-fg">{humanize(String((phase as RecordValue).name ?? (phase as RecordValue).phaseKey ?? `Phase ${index + 1}`))}</summary><div className="mt-gb-sm"><StructuredDataView value={phase} /></div></details>)}</div></Section><Section title="Evidence & sources"><details><summary className="cursor-pointer text-gb-sm text-fg">Show evidence index</summary><div className="mt-gb-md"><StructuredDataView value={{ evidence: output.evidenceIndex, sources: output.targetSourceIndex }} /></div></details></Section></div>;
}
function OutputRenderer({ node }: { node: AdminAiReportReviewNode }) {
  if (!node.available || node.output === null) return <p className="text-gb-sm text-fg-muted">No report generated yet.</p>;
  if (node.outputFormat === 'personal_report_v2') return <PersonalRenderer output={node.output as RecordValue} />;
  if (node.outputFormat === 'matching_report_v3' || node.outputFormat === 'matching_report_v2') return <MatchingRenderer output={node.output as RecordValue} />;
  if (node.outputFormat === 'strategy_report_v3') return <StrategyRenderer output={node.output as RecordValue} />;
  return <div className="rounded-gb-xl border border-line-error bg-surface-error p-gb-xl text-gb-sm text-fg-error"><p className="font-semibold">Unsupported report format</p><p className="mt-gb-xs">The stored output did not pass a known canonical schema. Open Technical to inspect the preserved raw JSON.</p></div>;
}
function InputsView({ sections }: { sections: AdminAiReportInputSection[] }) { if (!sections.length) return <p className="text-gb-sm text-fg-muted">Exact historical input not persisted.</p>; return <div className="flex flex-col gap-gb-xl">{sections.map((section) => <Section key={section.label} title={section.label}><StructuredDataView value={section.value} omitIdentity /></Section>)}</div>; }
function TechnicalView({ node }: { node: AdminAiReportReviewNode }) {
  const [copied, setCopied] = useState(false);
  const metadata = Object.entries(node.metadata).filter(([, value]) => value !== null && value !== undefined && value !== '');
  const rawJson = JSON.stringify(node.rawOutput, null, 2);
  return <div className="flex flex-col gap-gb-xl"><dl className="grid gap-gb-md sm:grid-cols-2">{[['Generated At', node.generatedAt], ['Model', node.modelName], ['Prompt Version', node.promptVersion], ['Input Hash', node.inputHash], ['Output Format', node.outputFormat]].map(([label, value]) => <div key={label}><dt className="text-gb-xs text-fg-muted">{label}</dt><dd className="mt-gb-xxs break-all text-gb-sm text-fg">{String(value ?? '—')}</dd></div>)}{metadata.map(([key, value]) => <div key={key}><dt className="text-gb-xs text-fg-muted">{humanize(key)}</dt><dd className="mt-gb-xxs break-all text-gb-sm text-fg">{scalar(value) ?? JSON.stringify(value)}</dd></div>)}</dl><details><summary className="cursor-pointer text-gb-sm font-semibold text-fg">Raw JSON (secondary)</summary><div className="mt-gb-sm flex justify-end"><button type="button" className="rounded-gb-lg border border-line px-gb-md py-gb-xs text-gb-xs font-semibold text-fg" onClick={() => { void navigator.clipboard?.writeText(rawJson); setCopied(true); }}>{copied ? 'Copied' : 'Copy JSON'}</button></div><pre className="mt-gb-sm max-h-[32rem] overflow-auto rounded-gb-xl bg-surface-subtle p-gb-xl text-wrap break-words font-mono text-gb-xs leading-relaxed text-fg">{rawJson}</pre></details><p className="text-gb-xs text-fg-muted">Exact provider prompts are not persisted; Inputs shows reconstructed historical source context.</p></div>;
}
function FlowNode({ node, selected, onSelect }: { node: AdminAiReportReviewNode; selected: boolean; onSelect: (id: string) => void }) { return <button type="button" disabled={!node.available} aria-pressed={selected} aria-label={`View ${node.title}`} onClick={() => onSelect(node.id)} className={`min-w-44 rounded-gb-xl border p-gb-xl text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${node.available ? selected ? 'border-brand bg-surface-hover text-fg' : 'border-line bg-surface text-fg hover:border-line-strong hover:bg-surface-hover' : 'cursor-not-allowed border-line bg-surface-subtle text-fg-muted'}`}><span className="block text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">{node.available ? 'Stored report' : 'Waiting on report'}</span><span className="mt-gb-xs block text-gb-md font-semibold">{node.title}</span><span className="mt-gb-xs block text-gb-xs text-fg-tertiary">{formatDate(node.generatedAt)}</span></button>; }
function ReportFlow({ review, selectedNodeId, onSelect }: { review: AdminAiReportReview; selectedNodeId: string | null; onSelect: (id: string) => void }) { return <div aria-label="AI report flow" className="flex flex-col items-stretch gap-gb-md md:flex-row md:items-center">{review.nodes.map((node, index) => <div key={node.kind} className="flex min-w-0 flex-1 flex-col gap-gb-md md:flex-row md:items-center"><FlowNode node={node} selected={node.id === selectedNodeId} onSelect={onSelect} />{index < review.nodes.length - 1 ? <span aria-hidden="true" className="self-center text-gb-lg font-semibold text-brand md:shrink-0">→</span> : null}</div>)}</div>; }
function DetailPanel({ node }: { node: AdminAiReportReviewNode }) { const [tab, setTab] = useState<'output' | 'inputs' | 'technical'>('output'); return <Panel className="flex flex-col gap-gb-xl"><PanelHeader title={node.title} description="Read-only canonical output, reconstructed inputs and technical lineage." /><div role="tablist" aria-label="Report detail"><div className="flex flex-wrap gap-gb-xs border-b border-line">{([['output', 'Output'], ['inputs', 'Inputs'], ['technical', 'Technical']] as const).map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => setTab(value)} className={`rounded-t-gb-lg px-gb-lg py-gb-sm text-gb-sm font-semibold ${tab === value ? 'bg-surface-hover text-fg' : 'text-fg-muted hover:text-fg'}`}>{label}</button>)}</div></div>{tab === 'output' ? <OutputRenderer node={node} /> : tab === 'inputs' ? <InputsView sections={node.inputs.sections} /> : <TechnicalView node={node} />}</Panel>; }

export function AdminAiReportReviewClient({ items, initialReview }: { items: AdminAiReportReviewListItem[]; initialReview: AdminAiReportReview | null }) {
  const [state, setState] = useState<DetailState>({ kind: 'ready', review: initialReview });
  const [applicationId, setApplicationId] = useState(initialReview?.application.applicationId ?? items[0]?.applicationId ?? '');
  const [selectedNodeId, setSelectedNodeId] = useState(firstAvailableNode(initialReview));
  async function selectApplication(nextApplicationId: string) { setApplicationId(nextApplicationId); setState({ kind: 'loading', review: null }); setSelectedNodeId(null); try { const response = await fetch(`/api/admin/ai-report-review?applicationId=${encodeURIComponent(nextApplicationId)}`, { cache: 'no-store' }); const body = await response.json().catch(() => ({})) as { review?: AdminAiReportReview; error?: string }; if (!response.ok || !body.review) throw new Error(body.error ?? 'Could not load report details.'); setState({ kind: 'ready', review: body.review }); setSelectedNodeId(firstAvailableNode(body.review)); } catch (error) { setState({ kind: 'error', review: null, message: error instanceof Error ? error.message : 'Could not load report details.' }); } }
  if (items.length === 0) return <Panel className="text-gb-sm text-fg-muted">No reviewable reports yet.</Panel>;
  const review = state.review;
  const selectedNode = review?.nodes.find((node) => node.id === selectedNodeId) ?? review?.nodes.find((node) => node.available) ?? null;
  return <div className="flex flex-col gap-gb-3xl"><Panel className="flex flex-col gap-gb-md"><label htmlFor="ai-report-application" className="text-gb-sm font-semibold text-fg">Select an application</label><select id="ai-report-application" value={applicationId} onChange={(event) => void selectApplication(event.target.value)} className="w-full rounded-gb-xl border border-line bg-surface px-gb-xl py-gb-lg text-gb-sm text-fg focus:outline-none focus:ring-2 focus:ring-brand">{items.map((item) => <option key={item.applicationId} value={item.applicationId}>{[item.courseName, item.universityName, item.subject].filter(Boolean).join(' · ') || item.applicationId}</option>)}</select><p className="text-gb-xs text-fg-muted">Most recent 100 applications with AI report activity.</p></Panel>{state.kind === 'loading' ? <Panel className="text-gb-sm text-fg-muted">Loading report details…</Panel> : null}{state.kind === 'error' ? <Panel className="text-gb-sm text-fg-error">{state.message}</Panel> : null}{review ? <><Panel className="flex flex-col gap-gb-xl"><PanelHeader title={review.application.courseName ?? 'Application'} description={[review.application.universityName, review.application.subject].filter(Boolean).join(' · ') || undefined} /><ReportFlow review={review} selectedNodeId={selectedNodeId} onSelect={setSelectedNodeId} /></Panel>{selectedNode ? <DetailPanel node={selectedNode} /> : null}</> : null}</div>;
}
