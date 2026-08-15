'use client';

import type { PersonalReportV2 } from '../../domain';
import type { PersonalCanvasDetails } from '../../domain/personal-canvas-details';

export const PERSONAL_REPORT_SECTION_IDS = {
  coreIdentity: 'personal-report-core-identity',
  drivingForces: 'personal-report-driving-forces',
  provenCapabilities: 'personal-report-proven-capabilities',
  socialProof: 'personal-report-social-proof',
  areasForGrowth: 'personal-report-areas-for-growth',
  longTermVision: 'personal-report-long-term-vision',
} as const;

export type PersonalReportSectionId =
  (typeof PERSONAL_REPORT_SECTION_IDS)[keyof typeof PERSONAL_REPORT_SECTION_IDS];

export type PersonalCanvasSectionKey =
  | 'coreIdentity'
  | 'drivingForces'
  | 'provenCapabilities'
  | 'socialProof'
  | 'areasForGrowth'
  | 'longTermVision';

type ReportWithCanvasDetails = PersonalReportV2 & { canvasDetails?: PersonalCanvasDetails };

function firstUseful(values: Array<string | null | undefined>, fallback: string): string {
  return values.find((value) => Boolean(value?.trim()))?.trim() ?? fallback;
}

function strongestCapabilityLabels(report: PersonalReportV2): string[] {
  const stored = (report as ReportWithCanvasDetails).canvasDetails?.capabilities;
  if (stored && stored.length > 0) return stored.slice(0, 2).map((capability) => capability.name);

  return (report.analytics?.competencyEvidenceProfile ?? [])
    .filter((metric) => metric.score !== null)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 2)
    .map((metric) => metric.label.replace(' specificity', ''));
}

function canvasPreviews(report: PersonalReportV2): Record<PersonalCanvasSectionKey, string> {
  const canvasDetails = (report as ReportWithCanvasDetails).canvasDetails;
  const capabilities = strongestCapabilityLabels(report);
  const themePathways = canvasDetails?.futurePathways
    .filter((pathway) => !pathway.isStatedDirection)
    .slice(0, 2);
  const themes = themePathways?.length
    ? themePathways.map((pathway) => pathway.label)
    : report.emergingThemes.themes.slice(0, 2).map((theme) => theme.theme);
  const evidenceCount = report.analytics?.evidenceSummary.totalItems;
  const storedGrowth = canvasDetails?.growthPriorities[0]?.gap;

  return {
    coreIdentity: firstUseful(
      [report.coreIdentity.recurringRole, report.coreIdentity.valueOrientation, report.coreIdentity.headline],
      'Your recurring identity patterns',
    ),
    drivingForces:
      canvasDetails?.motivations
        .slice(0, 2)
        .map((motivation) => motivation.label)
        .join(' · ') ||
      report.drivingForce.repeatedMotivations.slice(0, 2).join(' · ') ||
      firstUseful([report.drivingForce.headline], 'What repeatedly motivates your choices'),
    provenCapabilities: capabilities.join(' · ') || 'What your evidence shows you can do',
    socialProof:
      evidenceCount == null
        ? 'The evidence behind your profile'
        : `${evidenceCount} evidence item${evidenceCount === 1 ? '' : 's'} supporting your profile`,
    areasForGrowth: firstUseful(
      [
        storedGrowth,
        report.personalPositioning.whatPreventsStrongerPositioning[0],
        report.coreIdentity.stillDeveloping[0],
        report.emergingThemes.themes[0]?.limitation,
      ],
      'Where more evidence or development could strengthen your profile',
    ),
    longTermVision: themes.join(' × ') || 'The directions emerging from your current trajectory',
  };
}

type CanvasCellProps = {
  section: PersonalCanvasSectionKey;
  index: number;
  title: string;
  preview: string;
  active: boolean;
  side: 'left' | 'right';
  className?: string;
  onSelect: (section: PersonalCanvasSectionKey) => void;
};

function CanvasCell({
  section,
  index,
  title,
  preview,
  active,
  side,
  className = '',
  onSelect,
}: CanvasCellProps) {
  const isRight = side === 'right';

  return (
    <button
      type="button"
      data-canvas-section={section}
      aria-pressed={active}
      onClick={() => onSelect(section)}
      className={[
        'group relative flex min-h-[13.75rem] flex-col overflow-hidden rounded-[1.5rem]',
        'bg-brand px-gb-xl py-gb-xl text-white shadow-sm',
        'transition duration-300 ease-out hover:-translate-y-0.5 hover:brightness-[0.98]',
        'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand',
        active
          ? 'z-20 -translate-y-0.5 ring-[3px] ring-white ring-offset-[5px] ring-offset-surface shadow-xl'
          : '',
        isRight ? 'items-end text-right' : 'items-start text-left',
        className,
      ].join(' ')}
    >
      <span className="text-gb-xs font-semibold uppercase tracking-[0.14em] text-white/70">
        {index}. Personal Canvas
      </span>

      <div className={`mt-auto flex max-w-[19rem] flex-col gap-gb-sm ${isRight ? 'items-end' : 'items-start'}`}>
        <h3 className="font-display text-gb-display-xs font-semibold tracking-gb-display-tight">
          {title}
        </h3>
        <p
          className={`text-gb-sm leading-relaxed text-white/80 ${isRight ? 'text-right' : 'text-left'}`}
          data-no-auto-translate
        >
          {preview}
        </p>
        <span className="text-gb-xs font-semibold text-white/80 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          Explore →
        </span>
      </div>
    </button>
  );
}

/**
 * Personal Canvas navigation surface.
 *
 * Desktop deliberately mirrors the approved Personal Canvas model:
 * four quadrants form one 2×2 block with a visible cross-gap, while Core
 * Identity overlaps the exact centre of that gap. Long-Term Vision sits below
 * as the sixth connected area. The component is controlled so the workspace
 * can open a contextual report panel without changing route or scrolling to a
 * separate chapter.
 */
export function PersonalCanvasView({
  report,
  activeSection,
  onSelect,
}: {
  report: PersonalReportV2;
  activeSection: PersonalCanvasSectionKey | null;
  onSelect: (section: PersonalCanvasSectionKey) => void;
}) {
  const previews = canvasPreviews(report);

  return (
    <section aria-labelledby="personal-canvas-title" className="flex flex-col gap-gb-xl">
      <div className="mx-auto flex max-w-2xl flex-col gap-gb-sm text-center">
        <p className="text-gb-xs font-semibold uppercase tracking-[0.14em] text-fg-brand">
          Personal Canvas
        </p>
        <h2
          id="personal-canvas-title"
          className="font-display text-gb-display-sm font-semibold tracking-gb-display-tight text-fg"
        >
          Your applicant profile, in six connected parts
        </h2>
        <p className="text-gb-sm leading-relaxed text-fg-tertiary">
          Start with the whole picture, then open any area to inspect the evidence and reasoning behind it.
        </p>
      </div>

      {/* Narrow screens use readable cards rather than shrinking the diagram. */}
      <div className="grid gap-gb-sm rounded-gb-2xl bg-brand/5 p-gb-sm md:hidden">
        <button
          type="button"
          data-canvas-section="coreIdentity"
          aria-pressed={activeSection === 'coreIdentity'}
          onClick={() => onSelect('coreIdentity')}
          className="rounded-gb-xl bg-brand px-gb-xl py-gb-lg text-left text-white shadow-sm"
        >
          <span className="text-gb-xs font-semibold uppercase tracking-[0.14em] text-white/70">1. Core</span>
          <p className="mt-gb-sm font-display text-gb-display-xs font-semibold">Core Identity</p>
          <p className="mt-gb-xs text-gb-sm text-white/80" data-no-auto-translate>{previews.coreIdentity}</p>
        </button>

        <div className="grid gap-gb-sm sm:grid-cols-2">
          <CanvasCell section="drivingForces" index={2} title="Driving Forces" preview={previews.drivingForces} active={activeSection === 'drivingForces'} side="left" onSelect={onSelect} />
          <CanvasCell section="provenCapabilities" index={3} title="Proven Capabilities" preview={previews.provenCapabilities} active={activeSection === 'provenCapabilities'} side="left" onSelect={onSelect} />
          <CanvasCell section="areasForGrowth" index={5} title="Areas for Growth" preview={previews.areasForGrowth} active={activeSection === 'areasForGrowth'} side="left" onSelect={onSelect} />
          <CanvasCell section="socialProof" index={4} title="Social Proof" preview={previews.socialProof} active={activeSection === 'socialProof'} side="left" onSelect={onSelect} />
        </div>

        <CanvasCell
          section="longTermVision"
          index={6}
          title="Long-Term Vision"
          preview={previews.longTermVision}
          active={activeSection === 'longTermVision'}
          side="left"
          className="min-h-[9rem]"
          onSelect={onSelect}
        />
      </div>

      {/* Desktop Personal Canvas: exact quadrant + overlapping central-circle geometry. */}
      <div className="mx-auto hidden w-full max-w-[62rem] rounded-[2rem] border border-brand/10 bg-brand/5 p-gb-md shadow-sm md:block">
        <div className="relative grid grid-cols-2 grid-rows-2 gap-gb-md">
          <CanvasCell
            section="drivingForces"
            index={2}
            title="Driving Forces"
            preview={previews.drivingForces}
            active={activeSection === 'drivingForces'}
            side="left"
            className="pr-[8.25rem]"
            onSelect={onSelect}
          />
          <CanvasCell
            section="provenCapabilities"
            index={3}
            title="Proven Capabilities"
            preview={previews.provenCapabilities}
            active={activeSection === 'provenCapabilities'}
            side="right"
            className="pl-[8.25rem]"
            onSelect={onSelect}
          />
          <CanvasCell
            section="areasForGrowth"
            index={5}
            title="Areas for Growth"
            preview={previews.areasForGrowth}
            active={activeSection === 'areasForGrowth'}
            side="left"
            className="pr-[8.25rem]"
            onSelect={onSelect}
          />
          <CanvasCell
            section="socialProof"
            index={4}
            title="Social Proof"
            preview={previews.socialProof}
            active={activeSection === 'socialProof'}
            side="right"
            className="pl-[8.25rem]"
            onSelect={onSelect}
          />

          <div className="pointer-events-none absolute left-1/2 top-1/2 z-30 h-[14.5rem] w-[14.5rem] -translate-x-1/2 -translate-y-1/2">
            <button
              type="button"
              data-canvas-section="coreIdentity"
              aria-pressed={activeSection === 'coreIdentity'}
              onClick={() => onSelect('coreIdentity')}
              className={[
                'pointer-events-auto flex h-full w-full flex-col items-center justify-center rounded-full',
                'border-[6px] border-white bg-brand px-gb-xl text-center text-white shadow-xl',
                'ring-[10px] ring-brand/10 transition duration-300 ease-out',
                'hover:scale-[1.025] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand',
                activeSection === 'coreIdentity'
                  ? 'scale-[1.035] ring-white/30 shadow-2xl'
                  : '',
              ].join(' ')}
            >
              <span className="text-gb-xs font-semibold uppercase tracking-[0.14em] text-white/70">1. Core</span>
              <span className="mt-gb-sm font-display text-gb-display-xs font-semibold">Core Identity</span>
              <span className="mt-gb-xs max-w-[11rem] text-gb-xs leading-relaxed text-white/80" data-no-auto-translate>
                {previews.coreIdentity}
              </span>
            </button>
          </div>
        </div>

        <CanvasCell
          section="longTermVision"
          index={6}
          title="Long-Term Vision"
          preview={previews.longTermVision}
          active={activeSection === 'longTermVision'}
          side="left"
          className="mt-gb-md min-h-[9.75rem]"
          onSelect={onSelect}
        />
      </div>
    </section>
  );
}
