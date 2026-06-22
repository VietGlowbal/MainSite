'use client';

/**
 * CourseResultCard - Display a single course search result with selection capability
 * 
 * Features:
 * - Confidence badge (color-coded by quality)
 * - Course name with 2-line truncation
 * - Snippet with 3-line truncation
 * - Metadata row (degree level, duration, tuition)
 * - Source domain badge
 * - "View official page" link
 * - Optional checkbox for multi-select
 * - Full card clickable to toggle selection (except links)
 */

interface CourseResultCardProps {
  result: {
    universityId: number;
    courseName: string;
    courseUrl: string;
    sourceDomain: string;
    snippet: string;
    degreeLevel?: string;
    duration?: string;
    tuitionFeeText?: string;
    confidenceLabel: string;
    sourceConfidence: number;
    rank: number;
    sourceType: 'cached' | 'web' | 'fallback';
  };
  selectable?: boolean;
  selected?: boolean;
  onSelect?: () => void;
}

/**
 * Get confidence badge color based on label
 */
function getConfidenceBadgeClasses(label: string): string {
  switch (label) {
    case 'Checked recently':
      return 'bg-green-100 text-green-700 border-green-200';
    case 'Good match':
      return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'Needs review':
      return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'Needs refresh':
      return 'bg-slate-100 text-slate-700 border-slate-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}

export function CourseResultCard({
  result,
  selectable = false,
  selected = false,
  onSelect,
}: CourseResultCardProps) {
  const handleCardClick = (e: React.MouseEvent) => {
    // Don't toggle if clicking on a link
    if ((e.target as HTMLElement).closest('a')) {
      return;
    }
    
    if (selectable && onSelect) {
      onSelect();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (selectable && onSelect) {
        onSelect();
      }
    }
  };

  return (
    <div
      role={selectable ? 'button' : undefined}
      tabIndex={selectable ? 0 : undefined}
      onClick={handleCardClick}
      onKeyDown={handleKeyPress}
      className={`
        group relative rounded-xl border transition-all
        p-4 sm:p-5
        ${selectable ? 'cursor-pointer hover:border-pink-300 hover:bg-pink-50/30 active:border-pink-400 active:bg-pink-50/50' : ''}
        ${
          selected
            ? 'border-pink-500 bg-pink-50/50 ring-2 ring-pink-100'
            : 'border-slate-200 bg-white'
        }
      `}
      style={{
        // Task 24.2: Ensure smooth touch interactions with hardware acceleration
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {/* Checkbox (if selectable) - Touch-friendly 44x44px tap target */}
      {selectable && (
        <div className="absolute right-2 top-2 sm:right-4 sm:top-4">
          <div
            role="checkbox"
            aria-checked={selected}
            aria-label={`Select ${result.courseName}`}
            className={`
              flex items-center justify-center rounded transition-colors
              h-11 w-11 sm:h-5 sm:w-5
              ${
                selected
                  ? 'border-pink-500 bg-pink-500 sm:border-2'
                  : 'border-slate-300 bg-white group-hover:border-pink-400 sm:border-2'
              }
            `}
          >
            {selected && (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="sm:h-3 sm:w-3"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </div>
        </div>
      )}

      {/* Confidence Badge */}
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <span
          className={`
            inline-flex items-center gap-1.5 rounded-full border text-xs font-medium
            px-3 py-1.5 sm:px-2.5 sm:py-0.5
            ${getConfidenceBadgeClasses(result.confidenceLabel)}
          `}
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <circle cx="12" cy="12" r="10" />
          </svg>
          {result.confidenceLabel}
        </span>
        
        {/* Source domain badge */}
        <span className="text-xs text-slate-500">
          {result.sourceDomain}
        </span>
      </div>

      {/* Course Name (2-line truncation) */}
      <h3 className="mb-2 text-base font-semibold leading-snug text-slate-900 line-clamp-2 pr-12 sm:pr-6">
        {result.courseName}
      </h3>

      {/* Snippet (3-line truncation) */}
      {result.snippet && (
        <p className="mb-3 text-sm leading-relaxed text-slate-600 line-clamp-3 break-words">
          {result.snippet}
        </p>
      )}

      {/* Metadata Row */}
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-slate-500 sm:gap-y-1">
        {result.degreeLevel && (
          <div className="flex items-center gap-1.5">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="flex-shrink-0"
            >
              <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
              <path d="M6 12v5c3 3 9 3 12 0v-5" />
            </svg>
            <span className="break-words">{result.degreeLevel}</span>
          </div>
        )}
        
        {result.duration && (
          <div className="flex items-center gap-1.5">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="flex-shrink-0"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span className="break-words">{result.duration}</span>
          </div>
        )}
        
        {result.tuitionFeeText && (
          <div className="flex items-center gap-1.5">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="flex-shrink-0"
            >
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
            <span className="break-words">{result.tuitionFeeText}</span>
          </div>
        )}
      </div>

      {/* View Official Page Link - Touch-friendly 44px min height on mobile */}
      <a
        href={result.courseUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-pink-600 transition-colors hover:text-pink-700 active:text-pink-800 min-h-[44px] sm:min-h-0 py-2 sm:py-0"
        onClick={(e) => e.stopPropagation()}
      >
        View official page
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="flex-shrink-0"
        >
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      </a>
    </div>
  );
}
