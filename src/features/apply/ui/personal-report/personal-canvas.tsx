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

function CanvasCell({
  href,
  index,
  title,
  preview,
  className = '',
}: {
  href: string;
  index: number;
  title: string;
  preview: string;
  className?: string;
}) {
  return (
    <a
      href={href}
      className={`group flex min-h-[10.5rem] flex-col justify-between gap-gb-lg bg-brand p-gb-xl text-white transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand ${className}`}
    >
      <span className="text-gb-xs font-semibold uppercase tracking-[0.14em] text-white/65">
        {index}. Personal Canvas
      </span>
      <div className="flex flex-col gap-gb-sm">
        <h3 className="font-display text-gb-display-xs font-semibold tracking-gb-display-tight">
          {title}
        </h3>
        <p className="max-w-[18rem] text-gb-sm leading-relaxed text-white/75" data-no-auto-translate>
          {preview}
        </p>
        <span className="text-gb-xs font-semibold text-white/70 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          View section →
        </span>
      </div>
    </a>
  );
}

/**
 * The six-area Personal Canvas is the report's navigation model, not a
 * decorative image. Desktop mirrors the approved quadrant + central-identity
 * concept; mobile deliberately becomes a readable card grid instead of
 * shrinking the diagram until its labels become unusable.
 */
export function PersonalCanvasView({ report }: { report: PersonalReportV2 }) {
  const canvasDetails = (report as ReportWithCanvasDetails).canvasDetails;
  const capabilities = strongestCapabilityLabels(report);
  const themePathways = canvasDetails?.futurePathways.filter((pathway) => !pathway.isStatedDirection).slice(0, 2);
  const themes = themePathways?.length
    ? themePathways.map((pathway) => pathway.label)
    : report.emergingThemes.themes.slice(0, 2).map((theme) => theme.theme);
  const evidenceCount = report.analytics?.evidenceSummary.totalItems;
  const storedGrowth = canvasDetails?.growthPriorities[0]?.gap;
  const growthPreview = firstUseful(
    [
      storedGrowth,
      report.personalPositioning.whatPreventsStrongerPositioning[0],
      report.coreIdentity.stillDeveloping[0],
      report.emergingThemes.themes[0]?.limitation,
    ],
    'Where more evidence or development could strengthen your profile',
  );

  const corePreview = firstUseful(
    [report.coreIdentity.recurringRole, report.coreIdentity.valueOrientation, report.coreIdentity.headline],
    'Your recurring identity patterns',
  );
  const drivingPreview =
    canvasDetails?.motivations.slice(0, 2).map((motivation) => motivation.label).join(' · ') ||
    report.drivingForce.repeatedMotivations.slice(0, 2).join(' · ') ||
    firstUseful([report.drivingForce.headline], 'What repeatedly motivates your choices');
  const capabilityPreview = capabilities.join(' · ') || 'What your evidence shows you can do';
  const socialProofPreview =
    evidenceCount == null
      ? 'The evidence behind your profile'
      : `${evidenceCount} evidence item${evidenceCount === 1 ? '' : 's'} supporting your profile`;
  const visionPreview = themes.join(' × ') || 'The directions emerging from your current trajectory';

  return (
    <section aria-labelledby="personal-canvas-title" className="flex flex-col gap-gb-xl py-gb-md">
      <div className="mx-auto flex max-w-2xl flex-col gap-gb-sm text-center">
        <p className="text-gb-xs font-semibold uppercase tracking-[0.14em] text-fg-brand">Personal Canvas</p>
        <h2
          id="personal-canvas-title"
          className="font-display text-gb-display-sm font-semibold tracking-gb-display-tight text-fg"
        >
          Your applicant profile, in six connected parts
        </h2>
        <p className="text-gb-sm leading-relaxed text-fg-tertiary">
          Start with the whole picture, then open any area to see the evidence and reasoning behind it.
        </p>
      </div>

      {/* Mobile / narrow screens: preserve the hierarchy without forcing a tiny diagram. */}
      <div className="grid overflow-hidden rounded-gb-2xl border border-line sm:grid-cols-2 md:hidden">
        <CanvasCell
          href={`#${PERSONAL_REPORT_SECTION_IDS.coreIdentity}`}
          index={1}
          title="Core Identity"
          preview={corePreview}
          className="sm:col-span-2 border-b border-white/25"
        />
        <CanvasCell
          href={`#${PERSONAL_REPORT_SECTION_IDS.drivingForces}`}
          index={2}
          title="Driving Forces"
          preview={drivingPreview}
          className="border-b border-white/25 sm:border-r"
        />
        <CanvasCell
          href={`#${PERSONAL_REPORT_SECTION_IDS.provenCapabilities}`}
          index={3}
          title="Proven Capabilities"
          preview={capabilityPreview}
          className="border-b border-white/25"
        />
        <CanvasCell
          href={`#${PERSONAL_REPORT_SECTION_IDS.areasForGrowth}`}
          index={5}
          title="Areas for Growth"
          preview={growthPreview}
          className="border-b border-white/25 sm:border-r"
        />
        <CanvasCell
          href={`#${PERSONAL_REPORT_SECTION_IDS.socialProof}`}
          index={4}
          title="Social Proof"
          preview={socialProofPreview}
          className="border-b border-white/25"
        />
        <CanvasCell
          href={`#${PERSONAL_REPORT_SECTION_IDS.longTermVision}`}
          index={6}
          title="Long-Term Vision"
          preview={visionPreview}
          className="sm:col-span-2"
        />
      </div>

      {/* Desktop: four quadrants around Core Identity, followed by Long-Term Vision. */}
      <div className="mx-auto hidden w-full max-w-[820px] flex-col gap-gb-md md:flex">
        <div className="relative overflow-hidden rounded-gb-2xl border border-line bg-brand">
          <div className="grid grid-cols-2">
            <CanvasCell
              href={`#${PERSONAL_REPORT_SECTION_IDS.drivingForces}`}
              index={2}
              title="Driving Forces"
              preview={drivingPreview}
              className="border-b border-r border-white/30 pb-gb-4xl pr-[7rem]"
            />
            <CanvasCell
              href={`#${PERSONAL_REPORT_SECTION_IDS.provenCapabilities}`}
              index={3}
              title="Proven Capabilities"
              preview={capabilityPreview}
              className="border-b border-white/30 pb-gb-4xl pl-[7rem]"
            />
            <CanvasCell
              href={`#${PERSONAL_REPORT_SECTION_IDS.areasForGrowth}`}
              index={5}
              title="Areas for Growth"
              preview={growthPreview}
              className="border-r border-white/30 pt-gb-4xl pr-[7rem]"
            />
            <CanvasCell
              href={`#${PERSONAL_REPORT_SECTION_IDS.socialProof}`}
              index={4}
              title="Social Proof"
              preview={socialProofPreview}
              className="pt-gb-4xl pl-[7rem]"
            />
          </div>

          <a
            href={`#${PERSONAL_REPORT_SECTION_IDS.coreIdentity}`}
            className="group absolute left-1/2 top-1/2 flex h-[15rem] w-[15rem] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-gb-sm rounded-full border-[5px] border-white bg-brand px-gb-xl text-center text-white shadow-lg transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
          >
            <span className="text-gb-xs font-semibold uppercase tracking-[0.14em] text-white/65">1. Core</span>
            <span className="font-display text-gb-display-xs font-semibold">Core Identity</span>
            <span className="max-w-[11rem] text-gb-xs leading-relaxed text-white/75" data-no-auto-translate>
              {corePreview}
            </span>
            <span className="text-gb-xs font-semibold text-white/70 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              View section →
            </span>
          </a>
        </div>

        <CanvasCell
          href={`#${PERSONAL_REPORT_SECTION_IDS.longTermVision}`}
          index={6}
          title="Long-Term Vision"
          preview={visionPreview}
          className="min-h-[8rem] rounded-gb-2xl border border-line"
        />
      </div>
    </section>
  );
}
