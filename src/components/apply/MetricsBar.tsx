/**
 * Metrics Bar Component
 * Shows 5 key metrics: deadline, progress, current match, max match, requirements
 */

type Props = {
  metrics: {
    deadline?: {
      date: string;
      daysLeft: number;
      label: string;
    };
    progress: number;
    currentMatch?: number;
    maxPossibleMatch?: number;
    requirementsMet: number;
    requirementsTotal: number;
  };
  entryRequirements?: string;
};

export function MetricsBar({ metrics, entryRequirements }: Props) {
  const { deadline, progress, currentMatch, maxPossibleMatch } = metrics;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      {/* Deadline */}
      {deadline && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
          <div className="flex items-center gap-2 mb-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FF3D9A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <p className="text-xs font-medium text-slate-500">Apply deadline</p>
          </div>
          <p className="text-lg font-bold text-[#FF3D9A] leading-tight">
            {new Date(deadline.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
          <p className="mt-0.5 text-xs text-red-600 font-medium">{deadline.label}</p>
        </div>
      )}

      {/* Progress */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
        <div className="flex items-center gap-2 mb-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <p className="text-xs font-medium text-slate-500">Progress</p>
        </div>
        <p className="text-2xl font-bold text-slate-900 leading-tight">{progress}%</p>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,#FF3D9A,#FF85B3)] transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Current Match */}
      {currentMatch !== undefined && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
          <div className="flex items-center gap-2 mb-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <p className="text-xs font-medium text-slate-500">Your match</p>
          </div>
          <p className="text-2xl font-bold text-slate-900 leading-tight">{currentMatch}%</p>
          <p className="mt-0.5 text-xs text-slate-500">Your current CV</p>
        </div>
      )}

      {/* Max Possible Match */}
      {maxPossibleMatch !== undefined && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
          <div className="flex items-center gap-2 mb-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
            <p className="text-xs font-medium text-slate-500">Max possible match</p>
          </div>
          <p className="text-2xl font-bold text-slate-900 leading-tight">{maxPossibleMatch}%</p>
          <p className="mt-0.5 text-xs text-amber-600 font-medium">With AI-optimized CV</p>
        </div>
      )}

      {/* Entry Requirements */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
        <div className="flex items-center gap-2 mb-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          <p className="text-xs font-medium text-slate-500">Entry requirements</p>
        </div>
        <p className="text-base font-bold text-slate-900 leading-tight">
          {entryRequirements || 'AAA-AAB'}
        </p>
        <p className="mt-0.5 text-xs text-slate-500">A-Level</p>
      </div>
    </div>
  );
}
