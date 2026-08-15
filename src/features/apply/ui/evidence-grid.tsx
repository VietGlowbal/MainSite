'use client';

import { ICONS, KitIcon } from '@/shared/ui';
import { questionIcon } from './question-chrome';

/**
 * The tabs, sort control, responsive card grid and empty state that frame the
 * achievement/activity cards.
 *
 * Same tab visual language as `report-chrome.tsx`'s `ReportTabs` (underlined,
 * uppercase, brand on active) — not imported from there, because `apply` and
 * `ai-strategy-dashboard` are separate features and eslint forbids importing
 * across that boundary. Two components stating the same three classes is the
 * smaller cost next to a feature-to-feature dependency neither team owns.
 */

export type EvidenceTabKey = 'academic' | 'extracurricular';

export function EvidenceTabs({
  active,
  onSelect,
  academicLabel,
  extracurricularLabel,
  academicCount,
  extracurricularCount,
}: {
  active: EvidenceTabKey;
  onSelect: (key: EvidenceTabKey) => void;
  academicLabel: string;
  extracurricularLabel: string;
  academicCount: number;
  extracurricularCount: number;
}) {
  const tabs: Array<{ key: EvidenceTabKey; label: string; count: number }> = [
    { key: 'academic', label: academicLabel, count: academicCount },
    { key: 'extracurricular', label: extracurricularLabel, count: extracurricularCount },
  ];

  return (
    <div
      role="tablist"
      aria-label={academicLabel}
      className="flex gap-gb-3xl overflow-x-auto border-b border-line"
    >
      {tabs.map((tab) => {
        const selected = tab.key === active;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            id={`evidence-tab-${tab.key}`}
            aria-selected={selected}
            aria-controls={`evidence-panel-${tab.key}`}
            onClick={() => onSelect(tab.key)}
            className={`flex items-center gap-gb-sm whitespace-nowrap border-b-2 pb-gb-md pt-gb-xs text-gb-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
              selected
                ? 'border-brand text-fg-brand'
                : 'border-transparent text-fg-muted hover:text-fg-secondary'
            }`}
          >
            {tab.label}
            <span
              className={`rounded-gb-full px-gb-sm py-0.5 text-gb-xs ${
                selected ? 'bg-brand-subtle text-fg-brand' : 'bg-surface-muted text-fg-muted'
              }`}
            >
              {tab.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export type EvidenceSort =
  | 'recent'
  | 'oldest'
  | 'type'
  | 'reviewed_first'
  | 'needs_review_first';

export function EvidenceSortSelect({
  value,
  onChange,
  label,
  options,
}: {
  value: EvidenceSort;
  onChange: (next: EvidenceSort) => void;
  label: string;
  options: ReadonlyArray<{ value: EvidenceSort; label: string }>;
}) {
  return (
    <label className="flex items-center gap-gb-sm text-gb-sm text-fg-tertiary">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as EvidenceSort)}
        className="rounded-gb-md border border-line bg-surface px-gb-md py-gb-xs text-gb-sm text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** The 3/2/1-column responsive grid every card renders inside. */
export function EvidenceGrid({ children }: { children: React.ReactNode }) {
  return (
    <div role="tabpanel" className="grid grid-cols-1 gap-gb-lg sm:grid-cols-2 lg:grid-cols-3">
      {children}
    </div>
  );
}

export function EvidenceEmptyState({
  icon = 'search',
  heading,
  hint,
  addLabel,
  onAdd,
}: {
  icon?: string;
  heading: string;
  hint: string;
  addLabel: string;
  onAdd: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-gb-lg rounded-gb-xl border border-dashed border-line bg-surface-muted p-gb-5xl text-center">
      <span
        aria-hidden="true"
        className="flex size-12 items-center justify-center rounded-gb-full bg-brand-subtle text-fg-brand"
      >
        <KitIcon art={questionIcon(icon)} frame={22} />
      </span>
      <div className="flex flex-col gap-gb-xxs">
        <p className="text-gb-sm font-semibold text-fg">{heading}</p>
        <p className="text-gb-sm text-fg-tertiary">{hint}</p>
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex items-center gap-gb-sm rounded-gb-lg border border-brand px-gb-lg py-gb-sm text-gb-sm font-semibold text-fg-brand transition-colors hover:bg-brand-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <KitIcon art={ICONS.plus} frame={16} />
        {addLabel}
      </button>
    </div>
  );
}
