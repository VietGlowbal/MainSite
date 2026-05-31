/**
 * Journey Pipeline Component
 * Horizontal scrollable stage selector with status indicators
 */

'use client';

import type { ApplicationStage } from '@/lib/apply-types';

type Props = {
  stages: ApplicationStage[];
  activeStageId?: string;
  onSelectStage: (stageId: string) => void;
};

export function JourneyPipeline({ stages, activeStageId, onSelectStage }: Props) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-900">Your application journey</h2>
        <button 
          type="button" 
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          View full timeline
        </button>
      </div>

      {/* Scrollable stage pipeline */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
        {stages.map((stage, index) => {
          const isActive = stage.id === activeStageId;
          const isCompleted = stage.status === 'completed';
          const isInProgress = stage.status === 'in_progress';
          const isBlocked = stage.status === 'blocked';

          return (
            <button
              key={stage.id}
              type="button"
              onClick={() => onSelectStage(stage.id)}
              className={`flex min-w-[90px] flex-col items-center gap-2 rounded-xl p-3 transition ${
                isActive ? 'bg-pink-50 ring-2 ring-pink-200' : 'hover:bg-slate-50'
              }`}
            >
              {/* Status icon with number badge */}
              <div className="relative">
                {isCompleted ? (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                ) : isInProgress ? (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500">
                    <span className="text-sm font-bold text-white">{index + 1}</span>
                  </div>
                ) : isBlocked ? (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 border-2 border-red-300">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                  </div>
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-slate-300 bg-white">
                    <span className="text-sm font-semibold text-slate-400">{index + 1}</span>
                  </div>
                )}
              </div>

              {/* Stage name */}
              <span className={`text-center text-xs font-semibold leading-tight ${
                isActive ? 'text-pink-600' : isCompleted ? 'text-green-600' : 'text-slate-600'
              }`}>
                {stage.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
