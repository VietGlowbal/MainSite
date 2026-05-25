'use client';

import { useState, useRef, useEffect } from 'react';
import type { MatchBreakdown } from '@/lib/matching';
import { GlobeIcon, BookIcon, DollarIcon } from '@/components/icons';

interface Props {
  percentage: number | null;
  breakdown?: MatchBreakdown | null;
  size?: 'sm' | 'md';
}

const iconComponents: Record<string, React.ComponentType<{ className?: string; size?: number }>> = {
  country: GlobeIcon,
  subjects: BookIcon,
  budget: DollarIcon,
  level: BookIcon, // Reuse book for level
  environment: GlobeIcon, // Reuse globe for environment
  support: BookIcon, // Reuse book for support
};

export function MatchBadge({ percentage, breakdown, size = 'sm' }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  if (percentage == null) {
    return (
      <a href="/onboarding" className="text-xs text-pink-500 hover:underline">
        Complete your profile for match scores →
      </a>
    );
  }

  const color =
    percentage >= 75 ? 'text-emerald-600' :
    percentage >= 50 ? 'text-amber-600' :
    'text-pink-600';

  const bgColor =
    percentage >= 75 ? 'bg-emerald-50' :
    percentage >= 50 ? 'bg-amber-50' :
    'bg-pink-50';

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={() => breakdown && setOpen((o) => !o)}
        className={`font-bold ${size === 'md' ? 'text-sm' : 'text-xs'} ${color} ${breakdown ? 'hover:underline cursor-pointer' : 'cursor-default'} focus:outline-none`}
        aria-expanded={open}
        aria-label={`${percentage}% match — click for breakdown`}
      >
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${bgColor}`}>
          {percentage}% match
          {breakdown && <span className="text-[10px] opacity-60">ⓘ</span>}
        </span>
      </button>

      {open && breakdown && (
        <div className="absolute z-50 bottom-full mb-2 left-0 max-w-[calc(100vw-2rem)] w-72 bg-white border border-slate-200 rounded-xl shadow-xl p-4 text-xs text-slate-700 animate-[fadeIn_0.2s_ease-out]">
          <p className="font-semibold text-slate-900 mb-3">Match breakdown</p>
          {Object.entries(breakdown).map(([key, val]) => {
            const IconComponent = iconComponents[key];
            return (
              <div key={key} className="flex items-start gap-2 mb-2 last:mb-0">
                <span className="shrink-0 text-slate-400">
                  {IconComponent ? <IconComponent size={14} /> : '•'}
                </span>
                <div className="flex-1">
                  <div className="flex items-center gap-1">
                    <span className={val.score === val.max ? 'text-emerald-600 font-medium' : val.score > 0 ? 'text-amber-600 font-medium' : 'text-red-500 font-medium'}>
                      {val.score === val.max ? '✓' : val.score > 0 ? '~' : '✗'}
                    </span>
                    <span className="text-slate-500">{val.score}/{val.max}</span>
                  </div>
                  <span className="text-slate-600">{val.reason}</span>
                </div>
              </div>
            );
          })}
          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; transform: translateY(4px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
