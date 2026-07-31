'use client';

/**
 * THROWAWAY DEMO — the header strip: scenario switcher plus page jump list.
 * Delete with the folder.
 *
 * This banner exists so nobody mistakes the demo for the real thing, and so the
 * scenario can be changed without editing a URL by hand mid-presentation.
 */

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { SCENARIOS, SCENARIO_LABEL, type Scenario } from './fixtures';

const PAGES = [
  { href: '/demo-throwaway', label: 'Index' },
  { href: '/demo-throwaway/overview', label: 'Overview' },
  { href: '/demo-throwaway/cv/target-profile', label: 'Target Profile' },
  { href: '/demo-throwaway/cv/content', label: 'CV Content' },
  { href: '/demo-throwaway/cv/review', label: 'CV Assessment' },
  { href: '/demo-throwaway/cv/layout', label: 'Layout & PDF' },
  { href: '/demo-throwaway/statement', label: 'Statement' },
];

export function DemoNav() {
  const pathname = usePathname();
  const params = useSearchParams();
  const scenario = (params.get('scenario') ?? 'partial') as Scenario;

  const withScenario = (href: string, s: Scenario = scenario) => `${href}?scenario=${s}`;

  return (
    <div className="flex flex-col gap-gb-lg rounded-gb-2xl border border-line-error bg-surface-error p-gb-2xl">
      <div className="flex flex-wrap items-center justify-between gap-gb-lg">
        <p className="text-gb-sm font-semibold text-fg-error">
          Throwaway demo · fixtures only · no database
        </p>
        <div className="flex flex-wrap items-center gap-gb-md">
          <span className="text-gb-xs font-medium text-fg-tertiary">Scenario</span>
          {SCENARIOS.map((s) => (
            <Link
              key={s}
              href={withScenario(pathname, s)}
              className={`rounded-gb-full border px-gb-lg py-gb-xs text-gb-xs font-semibold ${
                s === scenario
                  ? 'border-brand bg-brand text-on-brand'
                  : 'border-line-strong bg-surface text-fg-secondary hover:bg-surface-hover'
              }`}
            >
              {SCENARIO_LABEL[s]}
            </Link>
          ))}
        </div>
      </div>

      <nav aria-label="Demo pages" className="flex flex-wrap items-center gap-gb-md">
        {PAGES.map((page) => {
          const active = pathname === page.href;
          return (
            <Link
              key={page.href}
              href={withScenario(page.href)}
              className={`rounded-gb-md px-gb-md py-gb-xxs text-gb-xs font-medium ${
                active
                  ? 'bg-surface-inverse text-fg-on-inverse'
                  : 'text-fg-tertiary hover:bg-surface-hover hover:text-fg'
              }`}
            >
              {page.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
