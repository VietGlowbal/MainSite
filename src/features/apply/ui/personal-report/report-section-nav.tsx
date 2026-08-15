'use client';

import { useEffect, useState } from 'react';
import { PERSONAL_REPORT_SECTION_IDS, type PersonalReportSectionId } from './personal-canvas';

const ITEMS: Array<{ id: PersonalReportSectionId; label: string }> = [
  { id: PERSONAL_REPORT_SECTION_IDS.coreIdentity, label: 'Identity' },
  { id: PERSONAL_REPORT_SECTION_IDS.drivingForces, label: 'Forces' },
  { id: PERSONAL_REPORT_SECTION_IDS.provenCapabilities, label: 'Capabilities' },
  { id: PERSONAL_REPORT_SECTION_IDS.socialProof, label: 'Proof' },
  { id: PERSONAL_REPORT_SECTION_IDS.areasForGrowth, label: 'Growth' },
  { id: PERSONAL_REPORT_SECTION_IDS.longTermVision, label: 'Vision' },
];

/**
 * Compact macro-navigation for the long report. The Personal Canvas remains
 * the visual overview; this bar becomes the practical way to move between
 * sections once the reader is further down the page.
 */
export function PersonalReportSectionNav() {
  const [activeId, setActiveId] = useState<PersonalReportSectionId>(PERSONAL_REPORT_SECTION_IDS.coreIdentity);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;

    const elements = ITEMS
      .map((item) => document.getElementById(item.id))
      .filter((element): element is HTMLElement => Boolean(element));
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) setActiveId(visible.target.id as PersonalReportSectionId);
      },
      { rootMargin: '-22% 0px -62% 0px', threshold: [0, 0.1, 0.25, 0.5] },
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  return (
    <nav
      aria-label="Personal Report sections"
      className="sticky top-4 z-20 -mx-gb-sm overflow-x-auto rounded-gb-xl border border-line bg-surface/95 p-gb-xs shadow-sm backdrop-blur print:hidden"
    >
      <div className="flex min-w-max items-center gap-gb-xxs">
        {ITEMS.map((item) => {
          const active = item.id === activeId;
          return (
            <a
              key={item.id}
              href={`#${item.id}`}
              aria-current={active ? 'location' : undefined}
              className={`rounded-gb-lg px-gb-md py-gb-sm text-gb-xs font-semibold transition ${
                active
                  ? 'bg-brand text-white'
                  : 'text-fg-tertiary hover:bg-surface-muted hover:text-fg'
              }`}
            >
              {item.label}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
