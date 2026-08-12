'use client';

import { useState } from 'react';
import { useLanguage } from '@/lib/i18n';

/**
 * Chrome shared by the report pages — the section tab bar.
 *
 * The stage bar that used to live here (Reflections/Personal Report/Matching
 * Report/Strategy/Planner) was removed 12/08: every report page already sits
 * under the `/ai-strategy/[applicationId]` layout, which renders the
 * brand-red `ApplicationNav` above it with the same destinations. Two bars
 * stacked on one page told the student nothing a single bar didn't, and
 * disagreed with each other about which entries were reachable. See
 * `src/shared/ui/sub-nav.tsx` for the one bar that remains.
 */

export type ReportTab = {
  key: string;
  label: string;
};

/**
 * The section tab bar both reports carry.
 *
 * Tabs scroll horizontally rather than wrapping: six of them at the widths the
 * design uses do not fit a phone, and a wrapped second row moves the content
 * down the page as the label lengths change between languages — the same
 * jumping the guide page was rebuilt to remove.
 */
export function ReportTabs({
  tabs,
  active,
  onSelect,
  label,
}: {
  tabs: readonly ReportTab[];
  active: string;
  onSelect: (key: string) => void;
  label: string;
}) {
  const { t } = useLanguage();

  return (
    <div
      role="tablist"
      aria-label={label}
      className="-mx-gb-xl flex gap-gb-3xl overflow-x-auto border-b border-line px-gb-xl"
    >
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            id={`tab-${tab.key}`}
            aria-selected={isActive}
            aria-controls={`panel-${tab.key}`}
            onClick={() => onSelect(tab.key)}
            className={`whitespace-nowrap border-b-2 pb-gb-md pt-gb-xs text-gb-xs font-semibold uppercase tracking-wide transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
              isActive
                ? 'border-brand text-fg-brand'
                : 'border-transparent text-fg-muted hover:text-fg-secondary'
            }`}
          >
            {t(tab.label)}
          </button>
        );
      })}
    </div>
  );
}

/** Tab state + the panel wrapper, so both reports handle selection identically. */
export function useReportTabs(tabs: readonly ReportTab[]) {
  const [active, setActive] = useState(tabs[0]?.key ?? '');
  // A tab that disappears (its section lost content on a refresh) must not
  // leave the panel blank with no tab selected.
  const resolved = tabs.some((tab) => tab.key === active) ? active : (tabs[0]?.key ?? '');
  return { active: resolved, setActive };
}

export function ReportPanel({
  tabKey,
  children,
}: {
  tabKey: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role="tabpanel"
      id={`panel-${tabKey}`}
      aria-labelledby={`tab-${tabKey}`}
      className="flex flex-col gap-gb-2xl pt-gb-3xl"
    >
      {children}
    </div>
  );
}
