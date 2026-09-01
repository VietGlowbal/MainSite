'use client';

import { useState } from 'react';
import { useT } from '@/lib/i18n';
import { V3ReferenceList, type V3EvidenceItem, type V3TargetSource } from './v3-report-details';

function cn(...classes: Array<string | undefined | null | false>): string {
  return classes.filter(Boolean).join(' ');
}

function StarIcon({ className = 'h-6 w-6' }: { className?: string; size?: number; strokeWidth?: number }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );
}

function AwardIcon({ className = 'h-6 w-6' }: { className?: string; size?: number; strokeWidth?: number }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z" />
    </svg>
  );
}

function ShieldAlertIcon({ className = 'h-6 w-6' }: { className?: string; size?: number; strokeWidth?: number }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

function TrendingUpIcon({ className = 'h-6 w-6' }: { className?: string; size?: number; strokeWidth?: number }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  );
}

function CheckCircle2Icon({ className = 'h-4 w-4' }: { className?: string; size?: number }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

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

interface FeatureItem {
  key: 'strongestFit' | 'competitiveAdvantage' | 'criticalGap' | 'strategicDirection';
  icon: React.ComponentType<{ className?: string; size?: number; strokeWidth?: number }>;
  title: string;
  badge: string;
  description: string;
  highlight: string;
  data: TakeawayItem;
  angle: number;
}

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
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  const title1 = cleanTitle(t('Strongest Fit'), strongestFit.title);
  const title2 = cleanTitle(t('Competitive Advantage'), competitiveAdvantage.title);
  const title3 = cleanTitle(t('Critical Gap'), criticalGap.title);
  const title4 = cleanTitle(t('Strategic Direction'), strategicDirection.title);

  const items: FeatureItem[] = [
    {
      key: 'strongestFit',
      icon: StarIcon,
      title: title1 || t('Strongest Fit'),
      badge: t('Strongest Fit'),
      description: strongestFit.body,
      highlight: t('Core Profile Strengths'),
      data: strongestFit,
      angle: -90, // Top
    },
    {
      key: 'competitiveAdvantage',
      icon: AwardIcon,
      title: title2 || t('Competitive Advantage'),
      badge: t('Competitive Advantage'),
      description: competitiveAdvantage.body,
      highlight: t('Unique Differentiator'),
      data: competitiveAdvantage,
      angle: 0, // Right
    },
    {
      key: 'criticalGap',
      icon: ShieldAlertIcon,
      title: title3 || t('Critical Gap'),
      badge: t('Critical Gap'),
      description: criticalGap.body,
      highlight: t('Priority Gap to Fix'),
      data: criticalGap,
      angle: 90, // Bottom
    },
    {
      key: 'strategicDirection',
      icon: TrendingUpIcon,
      title: title4 || t('Strategic Direction'),
      badge: t('Strategic Direction'),
      description: strategicDirection.body,
      highlight: t('Admission Roadmap'),
      data: strategicDirection,
      angle: 180, // Left
    },
  ];

  const activeItem = items[selectedIndex] ?? items[0];
  const ActiveIcon = activeItem.icon;

  const radius = 125; // Compact radius perfectly suited for 5-col container without clipping

  return (
    <div className="flex flex-col gap-gb-md">
      {/* Top Section: Side-by-Side (Left: Interactive Orbit Navigator, Right: Full Detail Panel) */}
      <div className="grid grid-cols-1 items-stretch gap-gb-md lg:grid-cols-12">
        {/* Left Column (5 Cols): Interactive Orbital Wheel */}
        <div className="flex flex-col items-center justify-center rounded-gb-2xl border border-line bg-surface p-gb-sm sm:p-gb-md shadow-gb-xs lg:col-span-5 min-w-0">
          {/* Mobile Tab Selector (< md) */}
          <div className="grid w-full grid-cols-2 gap-2 md:hidden">
            {items.map((item, index) => {
              const isSelected = selectedIndex === index;
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setSelectedIndex(index)}
                  className={cn(
                    'flex items-center gap-2 rounded-xl p-2.5 text-left text-xs font-semibold transition-all',
                    isSelected
                      ? 'bg-brand text-white shadow-md shadow-red-200'
                      : 'border border-line/80 bg-surface-subtle/50 text-fg-secondary hover:bg-surface-subtle'
                  )}
                >
                  <Icon className={cn('h-4 w-4 shrink-0', isSelected ? 'text-white' : 'text-brand')} />
                  <span className="truncate">{item.badge}</span>
                </button>
              );
            })}
          </div>

          {/* Desktop Circular Wheel (md+) */}
          <div className="hidden md:flex relative h-[420px] w-full items-center justify-center">
            {/* Dynamic Glowing Aura */}
            <div
              className={cn(
                'absolute h-[280px] w-[280px] rounded-full transition-all duration-500 pointer-events-none',
                'bg-brand/5 scale-105 shadow-lg'
              )}
            />

            {/* Static outer guide circle */}
            <div className="absolute h-[250px] w-[250px] rounded-full border-2 border-red-100 border-dashed pointer-events-none" />

            {/* Animated spinning highlighted red dashed circle */}
            <div
              className="absolute h-[250px] w-[250px] rounded-full border-2 border-dashed border-transparent transition-all duration-300 pointer-events-none border-t-brand border-r-brand border-b-brand/60 shadow-lg"
              style={{ animation: 'spin 14s linear infinite' }}
            />

            {/* Inner decorative circle */}
            <div className="absolute h-[180px] w-[180px] rounded-full border border-red-100/80 pointer-events-none" />

            {/* Center Display Badge (140px x 140px) */}
            <div className="absolute z-20 flex h-[140px] w-[140px] flex-col items-center justify-center rounded-full border-4 border-red-50 bg-white p-2.5 text-center shadow-xl transition-all duration-500">
              <div className="mb-1.5 flex h-9 w-9 items-center justify-center rounded-full border border-red-100 bg-red-50 text-brand shadow-xs transition-transform duration-300">
                <ActiveIcon className="h-5 w-5 text-brand" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider text-brand line-clamp-1 px-1">
                {activeItem.badge}
              </span>
              <p className="mt-0.5 text-[9px] font-semibold text-gray-400">
                {t('Click node')}
              </p>
            </div>

            {/* 4 Radial Nodes */}
            {items.map((item, index) => {
              const rad = (item.angle * Math.PI) / 180;
              const x = Math.cos(rad) * radius;
              const y = Math.sin(rad) * radius;

              const isSelected = selectedIndex === index;
              const Icon = item.icon;

              return (
                <div
                  key={`node-${item.key}`}
                  className="absolute z-30"
                  style={{
                    transform: `translate(${x}px, ${y}px)`,
                  }}
                >
                  <div
                    className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
                    onClick={() => setSelectedIndex(index)}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    {/* Node Button (44px x 44px) */}
                    <div
                      className={cn(
                        'flex h-11 w-11 items-center justify-center rounded-full border-2 transition-all duration-300 relative z-10',
                        isSelected
                          ? 'scale-115 border-white bg-brand text-white shadow-lg'
                          : 'border-red-100 bg-white text-gray-700 shadow-md group-hover:scale-105 group-hover:border-brand group-hover:text-brand'
                      )}
                    >
                      <Icon className={cn('h-4.5 w-4.5', isSelected ? 'text-white' : 'text-gray-700 group-hover:text-brand')} />
                    </div>

                    {/* Node Title Label Badge below button */}
                    <div
                      className={cn(
                        'absolute top-full mt-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] transition-all duration-300 pointer-events-none',
                        isSelected
                          ? 'bg-brand text-white font-bold shadow-xs scale-105 z-20'
                          : 'bg-white/95 border border-red-100/90 text-gray-700 font-semibold shadow-xs'
                      )}
                    >
                      {item.badge}
                    </div>

                    {/* Laser Connecting Line */}
                    <svg
                      className={cn(
                        'absolute left-1/2 top-1/2 -z-10 pointer-events-none transition-all duration-300',
                        isSelected ? 'opacity-100' : 'opacity-0'
                      )}
                      style={{
                        transformOrigin: '0% 50%',
                        transform: `translate(0, -50%) rotate(${item.angle + 180}deg)`,
                        width: `${radius - 70}px`,
                        height: '4px',
                        overflow: 'visible',
                      }}
                    >
                      <line
                        x1="22"
                        y1="2"
                        x2="100%"
                        y2="2"
                        stroke="var(--gb-brand)"
                        strokeWidth="2.5"
                        strokeDasharray="5 5"
                        className="animate-[dash_0.6s_linear_infinite]"
                        style={{ filter: 'drop-shadow(0 0 3px var(--gb-brand))' }}
                      />
                    </svg>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column (7 Cols): Rich Strategic Detail Panel */}
        <div className="flex flex-col justify-between rounded-gb-2xl border border-rose-200/80 bg-white p-gb-lg lg:p-gb-xl shadow-gb-xs lg:col-span-7 min-w-0 transition-all duration-300">
          <div className="flex flex-col">
            {/* Top Badge & Selector Indicator */}
            <div className="flex items-center justify-between gap-gb-sm border-b border-line/60 pb-gb-sm">
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-rose-700">
                  {activeItem.badge}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-subtle px-3 py-1 text-[11px] font-semibold text-fg-muted">
                  <CheckCircle2Icon className="h-3.5 w-3.5 text-brand" />
                  <span>{activeItem.highlight}</span>
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-fg-muted">
                0{selectedIndex + 1} / 0{items.length}
              </span>
            </div>

            {/* Headline Title */}
            <h3 className="mt-gb-md text-gb-md font-bold text-fg">
              {activeItem.title}
            </h3>

            {/* Takeaway Narrative Body */}
            <div className="mt-gb-sm text-gb-sm leading-relaxed text-fg-secondary break-words whitespace-pre-line">
              {activeItem.description}
            </div>
          </div>

          {/* Bottom References & Switcher */}
          <div className="mt-gb-lg border-t border-line/60 pt-gb-sm">
            <V3ReferenceList
              evidenceIds={activeItem.data.evidenceIds}
              targetSourceRefs={activeItem.data.targetSourceRefs}
              metricIds={activeItem.data.metricIds}
              metricLabels={metricLabels}
              evidenceIndex={evidenceIndex}
              targetSourceIndex={targetSourceIndex}
            />

            {/* Quick Switcher Buttons */}
            <div className="mt-gb-md flex items-center justify-between gap-2 border-t border-line/40 pt-gb-sm">
              <button
                type="button"
                onClick={() => setSelectedIndex((prev) => (prev - 1 + items.length) % items.length)}
                className="rounded-lg border border-line/80 px-3 py-1 text-xs font-semibold text-fg-secondary hover:bg-surface-subtle transition-colors"
              >
                ← {t('Previous')}
              </button>
              <div className="flex items-center gap-1.5">
                {items.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedIndex(idx)}
                    className={cn(
                      'h-2 rounded-full transition-all duration-300',
                      selectedIndex === idx ? 'w-5 bg-brand' : 'w-2 bg-rose-200 hover:bg-rose-300'
                    )}
                    aria-label={`Go to item ${idx + 1}`}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() => setSelectedIndex((prev) => (prev + 1) % items.length)}
                className="rounded-lg border border-line/80 px-3 py-1 text-xs font-semibold text-fg-secondary hover:bg-surface-subtle transition-colors"
              >
                {t('Next')} →
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section (12 Cols): Evidence Snapshot Graph Card */}
      <div className="flex flex-col justify-between rounded-gb-2xl border border-line bg-surface p-gb-lg shadow-gb-xs">
        <div className="flex flex-col gap-gb-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h4 className="text-gb-sm font-bold text-fg">{t('Evidence Snapshot')}</h4>
              <span className="text-xs text-fg-muted">· {t('Key Dimension Highlights')}</span>
            </div>
            <span className="rounded-full bg-surface-subtle px-2.5 py-0.5 text-[10px] font-semibold uppercase text-fg-muted">
              {t('Summary')}
            </span>
          </div>

          <div className="mt-gb-md grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gb-md">
            {evidenceSnapshot.map((item) => {
              const val = item.score !== null ? Math.max(0, Math.min(100, Math.round(item.score))) : null;
              return (
                <div key={item.id} className="flex flex-col gap-gb-2xs rounded-xl border border-line/70 bg-surface-subtle/30 p-3">
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

        <div className="mt-gb-md border-t border-line/60 pt-gb-xs text-[11px] text-fg-tertiary">
          <p>{t('Dimensional scores reflect evidence verified in your profile.')}</p>
        </div>
      </div>

      {/* Scoped CSS animation keyframes for rotating dashed circle and laser line */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
            @keyframes dash {
              to { stroke-dashoffset: -10; }
            }
          `,
        }}
      />
    </div>
  );
}
