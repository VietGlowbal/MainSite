/**
 * Navigation Buttons Component
 * Previous/Next step navigation at bottom of stage panel
 */

'use client';

type Props = {
  currentStageIndex: number;
  totalStages: number;
  onPrevious: () => void;
  onNext: () => void;
  canProceed?: boolean;
};

export function NavigationButtons({ 
  currentStageIndex, 
  totalStages, 
  onPrevious, 
  onNext,
  canProceed = true 
}: Props) {
  const isFirst = currentStageIndex === 0;
  const isLast = currentStageIndex === totalStages - 1;

  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
      {/* Previous button */}
      <button
        type="button"
        onClick={onPrevious}
        disabled={isFirst}
        className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Previous step
      </button>

      {/* Stage indicator */}
      <div className="text-center">
        <p className="text-xs text-slate-500">
          Step {currentStageIndex + 1} of {totalStages}
        </p>
      </div>

      {/* Next button */}
      <button
        type="button"
        onClick={onNext}
        disabled={isLast || !canProceed}
        className="inline-flex h-10 items-center gap-2 rounded-full bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] px-5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(255,77,140,0.28)] transition hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0"
      >
        {isLast ? 'Complete' : 'Next step'}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    </div>
  );
}
