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

function ShieldCheckIcon({ className = 'h-8 w-8' }: { className?: string; size?: number }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
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
  const [selectedIndex, setSelectedIndex] = useState<number | null>(0);

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

  const getTitlePosition = (angle: number) => {
    if (angle === -90) return 'bottom-full mb-3 left-1/2 -translate-x-1/2 text-center';
    if (angle === 0) return 'left-full ml-4 top-1/2 -translate-y-1/2 text-left';
    if (angle === 90) return 'top-full mt-3 left-1/2 -translate-x-1/2 text-center';
    if (angle === 180) return 'right-full mr-4 top-1/2 -translate-y-1/2 text-right';
    return '';
  };

  const radius = 230; // Radius matching 8-col desktop card container

  return (
    <div className="grid grid-cols-1 items-stretch gap-gb-md lg:grid-cols-12">
      {/* Left (8 Cols): Orbital Takeaway Hub */}
      <div className="flex flex-col justify-between overflow-hidden rounded-gb-2xl border border-line bg-surface p-gb-lg shadow-gb-xs lg:col-span-8 min-w-0">
        {/* Desktop Interactive Circular Layout */}
        <div className="hidden md:flex relative w-full h-[620px] items-center justify-center">
          {/* Dynamic Glowing Aura when Node Hovered/Active */}
          <div
            className={cn(
              'absolute w-[460px] h-[460px] rounded-full transition-all duration-500 pointer-events-none',
              selectedIndex !== null
                ? 'bg-[#EE0033]/[0.06] scale-105 shadow-[0_0_60px_rgba(238,0,51,0.18)]'
                : 'bg-red-50/30'
            )}
          />

          {/* Static outer guide circle */}
          <div className="absolute w-[460px] h-[460px] rounded-full border-2 border-red-100 border-dashed pointer-events-none" />

          {/* Animated spinning highlighted red dashed circle */}
          <div
            className={cn(
              'absolute w-[460px] h-[460px] rounded-full border-2 border-dashed border-transparent transition-all duration-300 pointer-events-none',
              selectedIndex !== null
                ? 'border-t-[#EE0033] border-r-[#EE0033] border-b-[#EE0033]/60 shadow-[0_0_25px_rgba(238,0,51,0.25)]'
                : 'border-t-[#EE0033] border-r-[#EE0033]/50'
            )}
            style={{
              animation: selectedIndex !== null ? 'spin 12s linear infinite' : 'spin 25s linear infinite',
            }}
          />

          {/* Inner decorative circle */}
          <div className="absolute w-[320px] h-[320px] rounded-full border border-red-100/80 pointer-events-none" />

          {/* Center Display Card (300px x 300px) */}
          <div className="absolute z-20 w-[300px] h-[300px]">
            {/* Default State (When no node is selected) */}
            <div
              className={cn(
                'absolute inset-0 rounded-full flex flex-col items-center justify-center p-6 text-center transition-all duration-500',
                'bg-white shadow-xl border-4 border-red-50',
                selectedIndex !== null ? 'opacity-0 scale-90 pointer-events-none' : 'opacity-100 scale-100'
              )}
            >
              <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center text-[#EE0033] mb-3 border-2 border-red-100 shadow-md animate-pulse">
                <ShieldCheckIcon className="h-9 w-9 text-[#EE0033]" />
              </div>
              <h3 className="text-xl font-black text-gray-900 leading-tight tracking-tight">
                <span className="text-[#EE0033]">{t('KEY TAKEAWAYS')}</span><br />{t('& STRATEGY')}
              </h3>
            </div>

            {/* Selected State Cards - Brand Red Glassmorphism Showcase */}
            {items.map((item, index) => {
              const Icon = item.icon;
              const isSelected = selectedIndex === index;
              return (
                <div
                  key={`center-${item.key}`}
                  className={cn(
                    'absolute inset-0 rounded-full flex flex-col items-center justify-center p-6 text-center transition-all duration-500 overflow-hidden',
                    'bg-[#EE0033] text-white shadow-[0_0_50px_rgba(238,0,51,0.35)] border-4 border-white',
                    isSelected ? 'opacity-100 scale-100 z-10' : 'opacity-0 scale-110 pointer-events-none -z-10'
                  )}
                >
                  {/* Glowing Icon Container */}
                  <div className="w-12 h-12 rounded-full bg-white/20 border border-white/40 flex items-center justify-center text-white mb-1.5 shadow-inner -mt-2">
                    <Icon className="h-6 w-6 text-white" />
                  </div>

                  {/* Badge */}
                  <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-3 py-0.5 rounded-full border border-white/30 mb-1.5 shadow-sm">
                    {item.badge}
                  </span>

                  {/* Description */}
                  <div className="max-h-28 overflow-y-auto px-2 text-[12px] text-white/95 leading-relaxed font-medium">
                    {item.description}
                  </div>

                  {/* Bottom Highlight Tag */}
                  <div className="mt-2">
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-black text-[#EE0033] bg-white px-3 py-1 rounded-full shadow-sm">
                      <CheckCircle2Icon className="h-3 w-3 text-[#EE0033]" />
                      <span>{item.highlight}</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 4 Radial Node Items */}
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
                  {/* Node Button Container (56px x 56px) */}
                  <div
                    className={cn(
                      'w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 relative z-10 border-2',
                      isSelected
                        ? 'bg-[#EE0033] text-white border-white scale-125 shadow-[0_0_25px_rgba(238,0,51,0.5)]'
                        : 'bg-white text-gray-700 border-red-100 shadow-md group-hover:text-[#EE0033] group-hover:border-[#EE0033] group-hover:scale-110'
                    )}
                  >
                    <Icon className={cn('h-6 w-6', isSelected ? 'text-white' : 'text-gray-700 group-hover:text-[#EE0033]')} />
                  </div>

                  {/* Node Title Label */}
                  <div
                    className={cn(
                      'absolute whitespace-nowrap transition-all duration-300 pointer-events-none',
                      getTitlePosition(item.angle),
                      isSelected ? 'text-[#EE0033] font-black text-xs scale-105' : 'text-gray-800 font-bold text-xs'
                    )}
                  >
                    {item.title}
                  </div>

                  {/* Laser Connecting Line */}
                  <svg
                    className={cn(
                      'absolute top-1/2 left-1/2 -z-10 pointer-events-none transition-all duration-300',
                      isSelected ? 'opacity-100' : 'opacity-0'
                    )}
                    style={{
                      transformOrigin: '0% 50%',
                      transform: `translate(0, -50%) rotate(${item.angle + 180}deg)`,
                      width: `${radius - 150}px`,
                      height: '4px',
                      overflow: 'visible',
                    }}
                  >
                    <line
                      x1="28"
                      y1="2"
                      x2="100%"
                      y2="2"
                      stroke="#EE0033"
                      strokeWidth="2.5"
                      strokeDasharray="5 5"
                      className="animate-[dash_0.6s_linear_infinite]"
                      style={{ filter: 'drop-shadow(0 0 3px #EE0033)' }}
                    />
                  </svg>
                </div>
              </div>
            );
          })}
        </div>

        {/* References Footer for the active takeaway item */}
        {selectedIndex !== null && items[selectedIndex] ? (
          <div className="mt-4 border-t border-line/60 pt-3">
            <V3ReferenceList
              evidenceIds={items[selectedIndex].data.evidenceIds}
              targetSourceRefs={items[selectedIndex].data.targetSourceRefs}
              metricIds={items[selectedIndex].data.metricIds}
              metricLabels={metricLabels}
              evidenceIndex={evidenceIndex}
              targetSourceIndex={targetSourceIndex}
            />
          </div>
        ) : null}

        {/* Mobile Grid Fallback Layout */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:hidden">
          {items.map((item, index) => {
            const Icon = item.icon;
            return (
              <div
                key={`mobile-${item.key}`}
                className="bg-white rounded-2xl p-4 border border-red-100 shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-red-50 text-[#EE0033] flex items-center justify-center border border-red-100">
                      <Icon className="h-5 w-5 text-[#EE0033]" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-red-50 text-[#EE0033] border border-red-100">
                      {item.badge}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-gray-900 mb-1.5">{item.title}</h3>
                  <p className="text-xs text-gray-600 leading-relaxed">{item.description}</p>
                </div>
                <div className="mt-3 pt-2 border-t border-gray-100">
                  <V3ReferenceList
                    evidenceIds={item.data.evidenceIds}
                    targetSourceRefs={item.data.targetSourceRefs}
                    metricIds={item.data.metricIds}
                    metricLabels={metricLabels}
                    evidenceIndex={evidenceIndex}
                    targetSourceIndex={targetSourceIndex}
                  />
                </div>
              </div>
            );
          })}
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
