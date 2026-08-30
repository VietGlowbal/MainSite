'use client';

import { useState } from 'react';
import { useT } from '@/lib/i18n';
import { V3ReferenceList, type V3EvidenceItem, type V3TargetSource } from './v3-report-details';

export type TakeawayItem = {
  title: string;
  body: string;
  evidenceIds?: string[];
  targetSourceRefs?: string[];
  metricIds?: string[];
};

export type EvidenceSnapshotItem = {
  id: string;
  label: string;
  score: number | null;
};

type KeyTakeawaysGridProps = {
  strongestFit: TakeawayItem;
  competitiveAdvantage: TakeawayItem;
  criticalGap: TakeawayItem;
  strategicDirection: TakeawayItem;
  evidenceSnapshot: EvidenceSnapshotItem[];
  evidenceIndex?: V3EvidenceItem[] | undefined;
  targetSourceIndex?: V3TargetSource[] | undefined;
  metricLabels?: Record<string, string> | undefined;
};

type TakeawayKey = 'strongestFit' | 'competitiveAdvantage' | 'criticalGap' | 'strategicDirection';

function cleanTitle(badgeName: string, title?: string): string | null {
  if (!title) return null;
  const trimmed = title.trim();
  if (!trimmed) return null;
  if (trimmed.toLowerCase() === badgeName.toLowerCase() || trimmed.toLowerCase() === `${badgeName.toLowerCase()}:`) {
    return null;
  }
  return trimmed;
}

export function KeyTakeawaysGrid({
  strongestFit,
  competitiveAdvantage,
  criticalGap,
  strategicDirection,
  evidenceSnapshot,
  evidenceIndex,
  targetSourceIndex,
  metricLabels,
}: KeyTakeawaysGridProps) {
  const t = useT();
  const [activeKey, setActiveKey] = useState<TakeawayKey>('strongestFit');

  const title1 = cleanTitle(t('Strongest Fit'), strongestFit.title);
  const title2 = cleanTitle(t('Competitive Advantage'), competitiveAdvantage.title);
  const title3 = cleanTitle(t('Critical Gap'), criticalGap.title);
  const title4 = cleanTitle(t('Strategic Direction'), strategicDirection.title);

  const nodes: Array<{
    key: TakeawayKey;
    label: string;
    tag: string;
    customTitle: string | null;
    data: TakeawayItem;
    icon: React.ReactNode;
    positionClass: string;
  }> = [
    {
      key: 'strongestFit',
      label: t('Strongest Fit'),
      tag: t('Core Strengths'),
      customTitle: title1,
      data: strongestFit,
      positionClass: 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2',
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ),
    },
    {
      key: 'competitiveAdvantage',
      label: t('Competitive Advantage'),
      tag: t('Unique Differentiator'),
      customTitle: title2,
      data: competitiveAdvantage,
      positionClass: 'top-1/2 right-0 translate-x-1/2 -translate-y-1/2',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z" />
        </svg>
      ),
    },
    {
      key: 'criticalGap',
      label: t('Critical Gap'),
      tag: t('Priority Action'),
      customTitle: title3,
      data: criticalGap,
      positionClass: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
    },
    {
      key: 'strategicDirection',
      label: t('Strategic Direction'),
      tag: t('Roadmap'),
      customTitle: title4,
      data: strategicDirection,
      positionClass: 'top-1/2 left-0 -translate-x-1/2 -translate-y-1/2',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
    },
  ];

  const activeNode = nodes.find((n) => n.key === activeKey) ?? nodes[0];

  return (
    <div className="grid grid-cols-1 items-stretch gap-gb-md lg:grid-cols-12">
      {/* Left (8 Cols): Interactive Strategic Orbit Wheel */}
      <div className="flex flex-col justify-between rounded-gb-2xl border border-line bg-surface p-gb-lg shadow-gb-xs lg:col-span-8 min-w-0">
        {/* Mobile / Tablet Tab Selector (< md) */}
        <div className="flex flex-col gap-gb-sm md:hidden">
          <div className="grid grid-cols-2 gap-2">
            {nodes.map((node) => {
              const isActive = activeKey === node.key;
              return (
                <button
                  key={node.key}
                  type="button"
                  onClick={() => setActiveKey(node.key)}
                  className={`flex items-center gap-2 rounded-xl p-2.5 text-left text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-rose-600 text-white shadow-md shadow-rose-200'
                      : 'border border-line/80 bg-surface-subtle/50 text-fg-secondary hover:bg-surface-subtle'
                  }`}
                >
                  <span className={`shrink-0 ${isActive ? 'text-white' : 'text-brand'}`}>
                    {node.icon}
                  </span>
                  <span className="truncate">{node.label}</span>
                </button>
              );
            })}
          </div>

          {/* Active Card for Mobile */}
          <div className="mt-2 rounded-2xl border border-rose-200 bg-rose-50/30 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-700">
                {activeNode.tag}
              </span>
              <span className="text-xs font-semibold text-fg-muted">{activeNode.label}</span>
            </div>
            {activeNode.customTitle ? (
              <h4 className="mt-2 text-sm font-bold text-fg">{activeNode.customTitle}</h4>
            ) : null}
            <p className="mt-2 text-xs leading-relaxed text-fg-secondary">{activeNode.data.body}</p>
            <div className="mt-3">
              <V3ReferenceList
                evidenceIds={activeNode.data.evidenceIds}
                targetSourceRefs={activeNode.data.targetSourceRefs}
                metricIds={activeNode.data.metricIds}
                metricLabels={metricLabels}
                evidenceIndex={evidenceIndex}
                targetSourceIndex={targetSourceIndex}
              />
            </div>
          </div>
        </div>

        {/* Desktop Interactive Orbital Hub (md+) */}
        <div className="relative hidden w-full items-center justify-center py-6 md:flex">
          {/* Orbital Circular Track */}
          <div className="relative flex h-[460px] w-[460px] items-center justify-center lg:h-[500px] lg:w-[500px]">
            {/* Ambient Background Blur */}
            <div className="pointer-events-none absolute h-64 w-64 rounded-full bg-rose-100/40 blur-3xl" />

            {/* Circular Dashed Ring */}
            <div className="absolute inset-4 rounded-full border-2 border-dashed border-rose-200/80" />
            <div className="absolute inset-16 rounded-full border border-rose-100/60" />

            {/* 4 Orbital Nodes */}
            {nodes.map((node) => {
              const isActive = activeKey === node.key;
              return (
                <div key={node.key} className={`absolute z-20 ${node.positionClass}`}>
                  <button
                    type="button"
                    onClick={() => setActiveKey(node.key)}
                    className={`group flex items-center gap-2 rounded-full p-1.5 transition-all duration-300 ${
                      isActive
                        ? 'scale-110 shadow-lg shadow-rose-200 ring-4 ring-rose-100'
                        : 'hover:scale-105'
                    }`}
                  >
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-full transition-colors duration-300 ${
                        isActive
                          ? 'bg-[linear-gradient(135deg,#e11d48,#fb7185)] text-white shadow-md'
                          : 'border border-line bg-white text-fg-secondary shadow-sm group-hover:border-rose-300 group-hover:text-brand'
                      }`}
                    >
                      {node.icon}
                    </div>
                  </button>
                  {/* Label badge under/beside the node */}
                  <span
                    className={`absolute left-1/2 top-full mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-bold transition-colors ${
                      isActive ? 'bg-rose-600 text-white shadow-sm' : 'bg-surface border border-line/80 text-fg-secondary'
                    }`}
                  >
                    {node.label}
                  </span>
                </div>
              );
            })}

            {/* Center Hub Card */}
            <div className="relative z-10 flex h-[310px] w-[310px] flex-col justify-between rounded-full border border-rose-200/90 bg-gradient-to-b from-white via-rose-50/30 to-white p-6 text-center shadow-[0_12px_40px_rgba(225,29,72,0.12)] transition-all duration-500 lg:h-[340px] lg:w-[340px] lg:p-8">
              <div className="flex flex-col items-center">
                <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-700">
                  {activeNode.tag}
                </span>
                <h4 className="mt-1 text-sm font-bold text-fg lg:text-base">
                  {activeNode.customTitle || activeNode.label}
                </h4>
              </div>

              {/* Scrollable / Readable Takeaway Body */}
              <div className="my-auto max-h-36 overflow-y-auto px-1 text-xs leading-relaxed text-fg-secondary lg:max-h-40">
                {activeNode.data.body}
              </div>

              {/* Footer references & step switcher */}
              <div className="flex flex-col items-center gap-1.5 pt-1">
                <div className="w-full">
                  <V3ReferenceList
                    evidenceIds={activeNode.data.evidenceIds}
                    targetSourceRefs={activeNode.data.targetSourceRefs}
                    metricIds={activeNode.data.metricIds}
                    metricLabels={metricLabels}
                    evidenceIndex={evidenceIndex}
                    targetSourceIndex={targetSourceIndex}
                  />
                </div>

                {/* 4 Navigation Dots */}
                <div className="mt-1 flex items-center justify-center gap-1.5">
                  {nodes.map((n) => (
                    <button
                      key={n.key}
                      type="button"
                      onClick={() => setActiveKey(n.key)}
                      aria-label={n.label}
                      className={`h-2 rounded-full transition-all duration-300 ${
                        activeKey === n.key ? 'w-5 bg-rose-600' : 'w-2 bg-rose-200 hover:bg-rose-300'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right (4 Cols): Evidence Snapshot Card */}
      <div className="flex h-full flex-col justify-between rounded-gb-2xl border border-line bg-surface p-gb-lg shadow-gb-xs lg:col-span-4 min-w-0">
        <div className="flex flex-col gap-gb-xs">
          <div className="flex items-center justify-between">
            <h4 className="text-gb-sm font-bold text-fg">{t('Evidence Snapshot')}</h4>
            <span className="rounded-full bg-surface-subtle px-2 py-0.5 text-[10px] font-semibold uppercase text-fg-muted">
              {t('Summary')}
            </span>
          </div>
          <p className="text-gb-xs text-fg-muted">{t('Key Dimension Highlights')}</p>

          <div className="mt-gb-md flex flex-col gap-gb-md">
            {evidenceSnapshot.map((item) => {
              const val = item.score !== null ? Math.max(0, Math.min(100, Math.round(item.score))) : null;
              return (
                <div key={item.id} className="flex flex-col gap-gb-2xs">
                  <div className="flex items-center justify-between text-gb-xs">
                    <span className="truncate pr-2 font-medium text-fg-secondary">{t(item.label)}</span>
                    <span className="shrink-0 font-bold text-fg">
                      {val !== null ? `${val}%` : t('N/A')}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
                    {val !== null && val > 0 ? (
                      <div
                        className="h-full rounded-full bg-brand transition-all duration-500"
                        style={{ width: `${val}%` }}
                      />
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-gb-lg border-t border-line/60 pt-gb-sm text-[11px] text-fg-tertiary">
          <p>{t('Dimensional scores reflect evidence verified in your profile.')}</p>
        </div>
      </div>
    </div>
  );
}
