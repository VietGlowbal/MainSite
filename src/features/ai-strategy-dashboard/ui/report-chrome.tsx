'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useLanguage } from '@/lib/i18n';

/**
 * Chrome shared by the two report pages — the stage bar and the section tabs.
 *
 * ─── LIGHT, NOT DARK ─────────────────────────────────────────────────────────
 *
 * Both mockups are dark. The rest of the app is light, and the owner chose to
 * keep these continuous with it, so the layout, the tab bar, the rings and the
 * hero are taken from the design and the surface is not. The dark-band tokens
 * (`bg-surface-inverse-deep`, `fg-on-inverse`) exist and are used by the stage
 * bar alone, which IS dark in the design and reads as chrome rather than page.
 *
 * ─── THE STAGE BAR IS NOT THE SITE NAV ───────────────────────────────────────
 *
 * It names the five stages of one strategy — Reflections, Personal Report,
 * Matching Report, Strategy, Planner — and every entry is a real route the
 * student has or will reach. Stages ahead of them are shown but not linked:
 * `/strategy/dashboard` redirects back to onboarding when the analysis has not
 * run, so linking it would offer a door that bounces them. Showing the whole
 * path and dimming what is not yet open is the honest version.
 */

export type StageKey = 'reflection' | 'portrait' | 'fit' | 'strategy' | 'planner';

type Stage = {
  key: StageKey;
  label: string;
  href: (applicationId: string) => string;
};

const STAGES: readonly Stage[] = [
  { key: 'reflection', label: 'Reflections', href: () => '/ai-strategy/reflection' },
  {
    key: 'portrait',
    label: 'Personal Report',
    href: (id) => `/ai-strategy/${id}/strategy/analysis/portrait`,
  },
  {
    key: 'fit',
    label: 'GlowBal Matching Report',
    href: (id) => `/ai-strategy/${id}/strategy/analysis/fit`,
  },
  { key: 'strategy', label: 'Personalized Strategy', href: (id) => `/ai-strategy/${id}/strategy/intro` },
  {
    key: 'planner',
    label: 'Application Planner',
    href: (id) => `/ai-strategy/${id}/strategy/dashboard`,
  },
];

export function StageBar({
  applicationId,
  active,
  unlockedStages,
}: {
  applicationId: string;
  active: StageKey;
  /** Stages the student can actually open. Others render dimmed and inert. */
  unlockedStages: readonly StageKey[];
}) {
  const { t } = useLanguage();

  return (
    <nav
      aria-label={t('Strategy stages')}
      className="rounded-gb-xl bg-surface-inverse-deep px-gb-xl py-gb-md"
    >
      <ul className="flex flex-wrap items-center gap-x-gb-2xl gap-y-gb-md">
        {STAGES.map((stage) => {
          const isActive = stage.key === active;
          const isUnlocked = unlockedStages.includes(stage.key);

          if (!isUnlocked) {
            return (
              <li key={stage.key}>
                <span
                  className="text-gb-sm font-medium text-fg-on-inverse-muted opacity-60"
                  title={t('Available once your analysis has run')}
                >
                  {t(stage.label)}
                </span>
              </li>
            );
          }

          return (
            <li key={stage.key}>
              <Link
                href={stage.href(applicationId)}
                aria-current={isActive ? 'page' : undefined}
                className={`rounded-gb-sm text-gb-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white ${
                  isActive
                    ? 'text-fg-on-inverse underline decoration-2 underline-offset-8'
                    : 'text-fg-on-inverse-secondary hover:text-fg-on-inverse'
                }`}
              >
                {t(stage.label)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

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
