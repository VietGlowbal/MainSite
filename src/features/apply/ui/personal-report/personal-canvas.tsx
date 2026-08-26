'use client';

import type { ComponentType, SVGProps } from 'react';
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
  if (stored && stored.length > 0) {
    return stored.slice(0, 2).map((capability) => capability.name);
  }

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
      [
        report.coreIdentity.recurringRole,
        report.coreIdentity.valueOrientation,
        report.coreIdentity.headline,
      ],
      'Your recurring identity patterns',
    ),
    drivingForces:
      canvasDetails?.motivations
        .slice(0, 2)
        .map((motivation) => motivation.label)
        .join(' · ') ||
      report.drivingForce.repeatedMotivations.slice(0, 2).join(' · ') ||
      firstUseful([report.drivingForce.headline], 'Driving Force Analysis'),
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
      'Identity, signature pattern and theme do not yet point toward the same direction.',
    ),
    longTermVision: themes.join(' × ') || 'The directions emerging from your current trajectory',
  };
}

/* ==========================================================================
   ICONS
   ========================================================================== */

function RocketIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
  );
}
function TrophyIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.45 1-1 1H8v4h8v-4h-1c-.55 0-1-.45-1-1v-2.34" />
      <path d="M6 4h12v6a6 6 0 0 1-12 0V4z" />
      <polygon points="12 7 13.09 9.26 15.5 9.5 13.75 11.2 14.18 13.5 12 12.3 9.82 13.5 10.25 11.2 8.5 9.5 10.91 9.26 12 7" />
    </svg>
  );
}

function SproutIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M7 20h10" />
      <path d="M10 20c5.5-2.5.8-6.4 3-10" />
      <path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-2-4.2 2.8-.5 4.5.8 4.5.8z" />
      <path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.7-2.3 1.7-4.6-2.7-.2-4.1.8-4.9 2z" />
    </svg>
  );
}

function CommunityIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function CompassIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  );
}

function BarChartIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
      <line x1="2" y1="20" x2="22" y2="20" />
    </svg>
  );
}

function FlagIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  );
}

/* ==========================================================================
   QUADRANT CELL
   ========================================================================== */

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
        'group relative flex min-h-[14.5rem] overflow-hidden rounded-gb-2xl',
        'border border-white/15 bg-brand p-gb-xl text-white shadow-md',
        'transition duration-300 ease-out hover:-translate-y-1 hover:scale-[1.006] hover:shadow-xl',
        'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand',
        active
          ? 'z-20 -translate-y-0.5 ring-[3px] ring-white ring-offset-[5px] ring-offset-surface shadow-2xl'
          : '',
        className,
      ].join(' ')}
    >
      {/* Background glow sheen */}
      <div className="pointer-events-none absolute -inset-full bg-gradient-to-tr from-white/0 via-white/5 to-white/0 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

      {/* Main card content */}
      <div
        className={`relative flex w-full flex-col justify-between ${
          isRight ? 'items-end text-right' : 'items-start text-left'
        }`}
      >
        <span className="rounded-full border border-white/15 bg-white/10 px-gb-sm py-1 text-gb-xs font-semibold uppercase tracking-[0.14em] text-white/80 backdrop-blur-sm">
          {index}. Personal Canvas
        </span>

        <div
          className={`mt-auto flex max-w-[17.5rem] flex-col gap-gb-xs ${
            isRight ? 'items-end' : 'items-start'
          }`}
        >
          <h3 className="font-display text-gb-display-xs font-semibold tracking-gb-display-tight">
            {title}
          </h3>
          <p
            className={`text-gb-sm leading-relaxed text-white/85 ${
              isRight ? 'text-right' : 'text-left'
            }`}
            data-no-auto-translate
          >
            {preview}
          </p>
          <span className="mt-gb-xs inline-flex items-center gap-1 text-gb-xs font-semibold text-white/80 opacity-70 transition-all group-hover:translate-x-0.5 group-hover:opacity-100 group-focus-visible:opacity-100">
            Explore <span aria-hidden="true">→</span>
          </span>
        </div>
      </div>
    </button>
  );
}

/* ==========================================================================
   LONG-TERM VISION PANORAMA ROADMAP
   ========================================================================== */

function LongTermVisionBanner({
  preview,
  active,
  onSelect,
}: {
  preview: string;
  active: boolean;
  onSelect: (section: PersonalCanvasSectionKey) => void;
}) {
  return (
    <button
      type="button"
      data-canvas-section="longTermVision"
      aria-pressed={active}
      onClick={() => onSelect('longTermVision')}
      className={[
        'group relative w-full overflow-hidden rounded-gb-2xl text-left shadow-md transition duration-300 ease-out',
        'border border-rose-200/80 bg-gradient-to-b from-[#ffedf1] via-[#ffe3e8] to-[#fecdd6]',
        'hover:-translate-y-1 hover:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand',
        active
          ? 'z-20 -translate-y-0.5 ring-[3px] ring-brand ring-offset-[5px] ring-offset-surface shadow-2xl'
          : '',
      ].join(' ')}
    >
      {/* High Fidelity Landscape SVG (Mountains, Sky, Pine Trees, Winding Highway & Flag) */}
      <div className="absolute inset-0 h-full w-full pointer-events-none">
        <svg
          viewBox="0 0 1000 320"
          preserveAspectRatio="none"
          className="h-full w-full"
        >
          <defs>
            <linearGradient id="skyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#fff5f7" />
              <stop offset="100%" stopColor="#ffe4e9" />
            </linearGradient>
            <linearGradient id="farMountain" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#fca5a5" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#f87171" stopOpacity="0.8" />
            </linearGradient>
            <linearGradient id="peakSun" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f43f5e" />
              <stop offset="100%" stopColor="#e11d48" />
            </linearGradient>
            <linearGradient id="peakShadow" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#be123c" />
              <stop offset="100%" stopColor="#881337" />
            </linearGradient>
            <linearGradient id="midHills" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#fb7185" />
              <stop offset="100%" stopColor="#be123c" />
            </linearGradient>
            <linearGradient id="foreHills" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#e11d48" />
              <stop offset="100%" stopColor="#9f1239" />
            </linearGradient>
          </defs>

          {/* Sky background */}
          <rect width="1000" height="320" fill="url(#skyGrad)" />

          {/* Soft clouds */}
          <g fill="#ffffff" fillOpacity="0.7">
            <path d="M260 55 Q275 35 300 40 Q325 35 340 50 Q360 50 365 65 Q355 80 330 80 L270 80 Q255 75 260 55 Z" />
            <path d="M600 40 Q615 25 635 30 Q655 25 670 40 Q685 40 690 55 Q680 65 660 65 L610 65 Q595 60 600 40 Z" />
          </g>

          {/* Distant mountain silhouette on right */}
          <path d="M580 320 L760 110 L940 320 Z" fill="url(#farMountain)" />
          <path d="M760 110 L740 145 Q760 135 780 145 Z" fill="#ffffff" fillOpacity="0.8" />

          {/* Middle Range Mountains & foothills */}
          <path
            d="M0 320 Q200 230 430 260 Q580 210 740 250 Q860 180 1000 210 L1000 320 Z"
            fill="url(#midHills)"
            opacity="0.85"
          />

          {/* Main Mountain Peak Facets (3D Shaded Peak) */}
          <polygon points="760,110 660,320 765,320" fill="url(#peakSun)" />
          <polygon points="760,110 765,320 890,320" fill="url(#peakShadow)" />
          <polygon points="760,110 735,145 760,138 785,148" fill="#ffffff" fillOpacity="0.95" />

          {/* Flag at summit */}
          <line x1="760" y1="110" x2="760" y2="70" stroke="#e11d48" strokeWidth="2.5" />
          <path d="M760 70 L790 82 L760 94 Z" fill="#e11d48" />

          {/* Foreground Foothill curves */}
          <path d="M0 320 Q180 250 350 280 Q520 310 700 280 L1000 320 Z" fill="url(#foreHills)" />

          {/* Pine Tree Groves (Realistic sharp vector pines) */}
          <g fill="#6b0d26">
            <path d="M680 280 L686 260 L692 280 Z M682 268 L686 250 L690 268 Z" />
            <path d="M700 275 L707 252 L714 275 Z M703 260 L707 242 L711 260 Z" />
            <path d="M720 285 L726 265 L732 285 Z" />
            <path d="M820 290 L828 260 L836 290 Z M823 270 L828 248 L833 270 Z" />
            <path d="M840 280 L848 250 L856 280 Z M843 260 L848 238 L853 260 Z" />
            <path d="M860 270 L869 238 L878 270 Z M863 250 L869 225 L875 250 Z" />
            <path d="M885 285 L894 252 L903 285 Z M888 262 L894 240 L900 262 Z" />
            <path d="M910 275 L919 245 L928 275 Z M913 255 L919 232 L925 255 Z" />
            <path d="M935 290 L943 262 L951 290 Z" />
            <path d="M960 280 L968 255 L976 280 Z" />
          </g>

          {/* Curving Ribbon Highway (Path from Ripple to Summit) */}
          <path
            d="M 500 135
               C 490 185, 455 215, 465 245
               C 475 275, 380 285, 260 295
               C 180 302, 90 312, 0 320
               L 0 320
               C 100 312, 200 298, 290 288
               C 400 272, 510 282, 630 275
               C 695 270, 755 240, 725 195
               C 710 170, 745 155, 760 148
               C 755 148, 730 162, 735 188
               C 742 215, 700 240, 640 252
               C 525 258, 440 238, 485 195
               C 512 168, 502 142, 500 135 Z"
            fill="#ffffff"
            stroke="#ffffff"
            strokeWidth="1.5"
          />

          {/* Concentric Ripple Target directly under vertical connector */}
          <g transform="translate(500, 135)">
            <ellipse cx="0" cy="0" rx="46" ry="16" fill="none" stroke="#ffffff" strokeWidth="2" strokeOpacity="0.75" />
            <ellipse cx="0" cy="0" rx="30" ry="10.5" fill="none" stroke="#ffffff" strokeWidth="2" strokeOpacity="0.85" />
            <ellipse cx="0" cy="0" rx="15" ry="5.5" fill="none" stroke="#ffffff" strokeWidth="1.5" />
            <circle cx="0" cy="0" r="5" fill="#e11d48" stroke="#ffffff" strokeWidth="2" />
          </g>
        </svg>
      </div>

      {/* Foreground Content & Milestones Overlay */}
      <div className="relative z-10 flex min-h-[17rem] flex-col justify-between p-gb-xl">
        {/* Top Left Title & Badge */}
        <div className="flex max-w-[21rem] flex-col gap-gb-xs">
          <span className="w-fit rounded-full border border-rose-300/80 bg-white/70 px-gb-sm py-1 text-gb-xs font-semibold uppercase tracking-[0.14em] text-rose-900 backdrop-blur-sm">
            6. Personal Canvas
          </span>
          <h3 className="mt-gb-xs font-display text-gb-display-sm font-semibold tracking-gb-display-tight text-neutral-900">
            Long-Term Vision
          </h3>
          <p className="text-gb-sm leading-relaxed text-neutral-700" data-no-auto-translate>
            {preview}
          </p>
          <span className="mt-gb-xs inline-flex items-center gap-1 text-gb-xs font-semibold text-brand transition-all group-hover:translate-x-1">
            Explore <span aria-hidden="true">→</span>
          </span>
        </div>

        {/* Milestone Pin 1: Short Term (1–2 years) */}
        <div className="absolute left-[31%] bottom-6 hidden md:flex flex-col items-center">
          <div className="flex items-center gap-2 rounded-full border border-rose-200/80 bg-white/95 px-3 py-1.5 shadow-md backdrop-blur-sm transition-transform duration-300 group-hover:scale-105">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-50 text-rose-600">
              <CompassIcon className="h-3.5 w-3.5" />
            </div>
            <div className="flex flex-col text-left leading-none">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-800">
                Short Term
              </span>
              <span className="text-[11px] font-medium text-neutral-600">1–2 years</span>
            </div>
          </div>
          <div className="mt-1 h-8 w-[1.5px] border-l-2 border-dashed border-white" />
          <div className="h-2 w-2 rounded-full bg-white shadow-xs" />
        </div>

        {/* Milestone Pin 2: Mid Term (3–5 years) */}
        <div className="absolute left-[54%] bottom-16 hidden md:flex flex-col items-center">
          <div className="flex items-center gap-2 rounded-full border border-rose-200/80 bg-white/95 px-3 py-1.5 shadow-md backdrop-blur-sm transition-transform duration-300 group-hover:scale-105">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-50 text-rose-600">
              <BarChartIcon className="h-3.5 w-3.5" />
            </div>
            <div className="flex flex-col text-left leading-none">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-800">
                Mid Term
              </span>
              <span className="text-[11px] font-medium text-neutral-600">3–5 years</span>
            </div>
          </div>
          <div className="mt-1 h-12 w-[1.5px] border-l-2 border-dashed border-white" />
          <div className="h-2 w-2 rounded-full bg-white shadow-xs" />
        </div>

        {/* Milestone Pin 3: Long Term (5+ years) */}
        <div className="absolute right-[8%] top-16 hidden md:flex flex-col items-center">
          <div className="flex items-center gap-2 rounded-full border border-rose-200/80 bg-white/95 px-3 py-1.5 shadow-md backdrop-blur-sm transition-transform duration-300 group-hover:scale-105">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-50 text-rose-600">
              <FlagIcon className="h-3.5 w-3.5" />
            </div>
            <div className="flex flex-col text-left leading-none">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-800">
                Long Term
              </span>
              <span className="text-[11px] font-medium text-neutral-600">5+ years</span>
            </div>
          </div>
          <div className="mt-1 h-14 w-[1.5px] border-l-2 border-dashed border-white" />
          <div className="h-2 w-2 rounded-full bg-white shadow-xs" />
        </div>
      </div>
    </button>
  );
}


const DESKTOP_QUADRANT_HOVER_CUTOUTS = {
  drivingForces: { cx: 102.08, cy: 101.55, rx: 24.79, ry: 56.83 },
  provenCapabilities: { cx: -2.73, cy: 101.55, rx: 24.95, ry: 56.83 },
  areasForGrowth: { cx: 102.08, cy: 4.9, rx: 24.79, ry: 60.57 },
  socialProof: { cx: -2.73, cy: 4.9, rx: 24.95, ry: 60.57 },
} as const;

function DesktopQuadrantHover({
  section,
  active,
}: {
  section: keyof typeof DESKTOP_QUADRANT_HOVER_CUTOUTS;
  active: boolean;
}) {
  const { cx, cy, rx, ry } = DESKTOP_QUADRANT_HOVER_CUTOUTS[section];

  return (
    <svg
      aria-hidden="true"
      className={[
        'pointer-events-none absolute inset-0 z-0 h-full w-full fill-white transition-opacity duration-300 ease-out',
        active ? 'opacity-[0.19]' : 'opacity-0 group-hover:opacity-[0.14]',
      ].join(' ')}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <path
        fillRule="evenodd"
        d={`M0 0H100V100H0ZM${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${rx * 2} 0a${rx} ${ry} 0 1 0 -${rx * 2} 0`}
      />
    </svg>
  );
}

/* ==========================================================================
   PERSONAL CANVAS MAIN VIEW
   ========================================================================== */

/**
 * Personal Canvas navigation surface.
 *
 * Desktop uses the high-fidelity clean vector backdrop (`/images/personal-canvas-bg.jpg`)
 * overlaid with interactive accessible buttons for the 6 sections.
 * Mobile (< md) uses a stacked layout for responsive touch screens.
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
    <section aria-label="Personal Canvas" className="flex flex-col gap-gb-lg">
      {/* ──────────────────────────────────────────────────────────────────
          Mobile Fallback Layout (< md)
          ────────────────────────────────────────────────────────────────── */}
      <div className="grid gap-gb-sm rounded-gb-2xl bg-brand/5 p-gb-sm md:hidden">
        <button
          type="button"
          data-canvas-section="coreIdentity"
          aria-pressed={activeSection === 'coreIdentity'}
          onClick={() => onSelect('coreIdentity')}
          className={[
            'rounded-gb-xl border border-white/15 bg-brand px-gb-xl py-gb-lg text-left text-white shadow-md',
            'transition duration-300 ease-out hover:-translate-y-0.5 hover:shadow-lg',
            activeSection === 'coreIdentity'
              ? 'ring-[3px] ring-white ring-offset-[4px] ring-offset-surface'
              : '',
          ].join(' ')}
        >
          <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-gb-sm py-1 text-gb-xs font-semibold uppercase tracking-[0.14em] text-white/80">
            1. Core
          </span>
          <p className="mt-gb-lg font-display text-gb-display-xs font-semibold">Core Identity</p>
          <p className="mt-gb-xs text-gb-sm text-white/80" data-no-auto-translate>
            {previews.coreIdentity}
          </p>
        </button>

        <div className="grid gap-gb-sm sm:grid-cols-2">
          <CanvasCell
            section="drivingForces"
            index={2}
            title="Driving Forces"
            preview={previews.drivingForces}
            active={activeSection === 'drivingForces'}
            side="left"
            onSelect={onSelect}
          />
          <CanvasCell
            section="provenCapabilities"
            index={3}
            title="Proven Capabilities"
            preview={previews.provenCapabilities}
            active={activeSection === 'provenCapabilities'}
            side="left"
            onSelect={onSelect}
          />
          <CanvasCell
            section="areasForGrowth"
            index={5}
            title="Areas for Growth"
            preview={previews.areasForGrowth}
            active={activeSection === 'areasForGrowth'}
            side="left"
            onSelect={onSelect}
          />
          <CanvasCell
            section="socialProof"
            index={4}
            title="Social Proof"
            preview={previews.socialProof}
            active={activeSection === 'socialProof'}
            side="left"
            onSelect={onSelect}
          />
        </div>

        <LongTermVisionBanner
          preview={previews.longTermVision}
          active={activeSection === 'longTermVision'}
          onSelect={onSelect}
        />
      </div>

      {/* ──────────────────────────────────────────────────────────────────
          Desktop Personal Canvas: High-Fidelity Clean Background + Hotspots
          ────────────────────────────────────────────────────────────────── */}
      <div className="mx-auto hidden w-full max-w-[64rem] md:block">
        <div
          className="relative w-full overflow-hidden rounded-[2rem] border border-rose-200/60 bg-white shadow-xl select-none"
          style={{ aspectRatio: '1024 / 731' }}
        >
          {/* Real Clean Background Image (Mountains, Road, Network Spokes & Icons) */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/personal-canvas-bg.jpg"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          />

          {/* Interactive Dynamic Overlay Layer */}
          <div
            className={[
              'absolute inset-0 z-10',
              activeSection ? '[&_[data-canvas-copy]]:hidden' : '',
            ].join(' ')}
          >
            {/* 1. Core Identity (Center Hub - Highest z-index) */}
            <button
              type="button"
              data-canvas-section="coreIdentity"
              aria-pressed={activeSection === 'coreIdentity'}
              aria-label="Open Core Identity details"
              onClick={() => onSelect('coreIdentity')}
              className={[
                'group absolute left-1/2 -translate-x-1/2 -translate-y-1/2 z-30',
                'flex flex-col items-center justify-center rounded-full text-center text-white cursor-pointer',
                'transition-all duration-300 ease-out hover:scale-[1.04] hover:bg-white/18 hover:shadow-2xl focus:outline-none focus-visible:ring-4 focus-visible:ring-white',
                activeSection === 'coreIdentity'
                  ? 'ring-4 ring-white shadow-2xl scale-[1.04] bg-white/23'
                  : '',
              ].join(' ')}
              style={{
                top: '31.67%',
                width: '23.14%',
                height: '32.15%',
              }}
            >
              <div data-canvas-copy className="contents">
                <span className="rounded-full border border-white/25 bg-white/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white/90 transition-colors group-hover:bg-white/25">
                  1. Core
                </span>
                <span className="mt-1 font-display text-lg font-bold tracking-tight drop-shadow-xs">
                  Core Identity
                </span>
                <span
                  className="mt-0.5 max-w-[170px] text-[11px] leading-tight text-white/85"
                  data-no-auto-translate
                >
                  {previews.coreIdentity}
                </span>
              </div>
            </button>

            {/* 2. Driving Forces (Top-Left) */}
            <button
              type="button"
              data-canvas-section="drivingForces"
              aria-pressed={activeSection === 'drivingForces'}
              aria-label="Open Driving Forces details"
              onClick={() => onSelect('drivingForces')}
              className={[
                'group absolute z-10 flex flex-col justify-start overflow-hidden p-5 text-left text-white',
                'rounded-tl-[1.75rem] rounded-tr-[1.25rem] rounded-bl-[1.25rem] rounded-br-[0.5rem] cursor-pointer',
                'transition-opacity duration-300 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60',
              ].join(' ')}
              style={{
                left: '2.25%',
                top: '3.01%',
                width: '46.68%',
                height: '28.25%',
              }}
            >
              <DesktopQuadrantHover section="drivingForces" active={activeSection === 'drivingForces'} />
              <div data-canvas-copy className="contents">
              <span className="relative z-10 w-fit rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/85 transition-colors group-hover:bg-white/20">
                2. Personal Canvas
              </span>
              <div className="relative z-10 mt-2.5 flex max-w-[245px] flex-col gap-0.5">
                <h3 className="font-display text-base font-bold tracking-tight text-white drop-shadow-xs">
                  Driving Forces
                </h3>
                <p
                  className="text-xs leading-snug text-white/85"
                  data-no-auto-translate
                >
                  {previews.drivingForces}
                </p>
                <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-white/80 group-hover:translate-x-1 group-hover:text-white transition-all">
                  Explore <span aria-hidden="true">→</span>
                </span>
              </div>
              </div>
            </button>

            {/* 3. Proven Capabilities (Top-Right) */}
            <button
              type="button"
              data-canvas-section="provenCapabilities"
              aria-pressed={activeSection === 'provenCapabilities'}
              aria-label="Open Proven Capabilities details"
              onClick={() => onSelect('provenCapabilities')}
              className={[
                'group absolute z-10 flex flex-col justify-start overflow-hidden p-5 text-right items-end text-white',
                'rounded-tr-[1.75rem] rounded-tl-[1.25rem] rounded-br-[1.25rem] rounded-bl-[0.5rem] cursor-pointer',
                'transition-opacity duration-300 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60',
              ].join(' ')}
              style={{
                left: '51.17%',
                top: '3.01%',
                width: '46.39%',
                height: '28.25%',
              }}
            >
              <DesktopQuadrantHover section="provenCapabilities" active={activeSection === 'provenCapabilities'} />
              <div data-canvas-copy className="contents">
              <span className="relative z-10 w-fit rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/85 transition-colors group-hover:bg-white/20">
                3. Personal Canvas
              </span>
              <div className="relative z-10 mt-2.5 flex max-w-[245px] flex-col items-end gap-0.5">
                <h3 className="font-display text-base font-bold tracking-tight text-white drop-shadow-xs">
                  Proven Capabilities
                </h3>
                <p
                  className="text-xs leading-snug text-white/85 text-right"
                  data-no-auto-translate
                >
                  {previews.provenCapabilities}
                </p>
                <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-white/80 group-hover:translate-x-1 group-hover:text-white transition-all">
                  Explore <span aria-hidden="true">→</span>
                </span>
              </div>
              </div>
            </button>

            {/* 5. Areas for Growth (Bottom-Left) */}
            <button
              type="button"
              data-canvas-section="areasForGrowth"
              aria-pressed={activeSection === 'areasForGrowth'}
              aria-label="Open Areas for Growth details"
              onClick={() => onSelect('areasForGrowth')}
              className={[
                'group absolute z-10 flex flex-col justify-start overflow-hidden p-5 text-left text-white',
                'rounded-bl-[1.75rem] rounded-tl-[1.25rem] rounded-br-[1.25rem] rounded-tr-[0.5rem] cursor-pointer',
                'transition-opacity duration-300 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60',
              ].join(' ')}
              style={{
                left: '2.25%',
                top: '30.37%',
                width: '46.68%',
                height: '26.54%',
              }}
            >
              <DesktopQuadrantHover section="areasForGrowth" active={activeSection === 'areasForGrowth'} />
              <div data-canvas-copy className="contents">
              <span className="relative z-10 w-fit rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/85 transition-colors group-hover:bg-white/20">
                5. Personal Canvas
              </span>
              <div className="relative z-10 mt-1.5 flex max-w-[245px] flex-col gap-0.5">
                <h3 className="font-display text-base font-bold tracking-tight text-white drop-shadow-xs">
                  Areas for Growth
                </h3>
                <p
                  className="text-xs leading-snug text-white/85"
                  data-no-auto-translate
                >
                  {previews.areasForGrowth}
                </p>
                <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-white/80 group-hover:translate-x-1 group-hover:text-white transition-all">
                  Explore <span aria-hidden="true">→</span>
                </span>
              </div>
              </div>
            </button>

            {/* 4. Social Proof (Bottom-Right) */}
            <button
              type="button"
              data-canvas-section="socialProof"
              aria-pressed={activeSection === 'socialProof'}
              aria-label="Open Social Proof details"
              onClick={() => onSelect('socialProof')}
              className={[
                'group absolute z-10 flex flex-col justify-start overflow-hidden p-5 text-right items-end text-white',
                'rounded-br-[1.75rem] rounded-tr-[1.25rem] rounded-bl-[1.25rem] rounded-tl-[0.5rem] cursor-pointer',
                'transition-opacity duration-300 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60',
              ].join(' ')}
              style={{
                left: '51.17%',
                top: '30.37%',
                width: '46.39%',
                height: '26.54%',
              }}
            >
              <DesktopQuadrantHover section="socialProof" active={activeSection === 'socialProof'} />
              <div data-canvas-copy className="contents">
              <span className="relative z-10 w-fit rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/85 transition-colors group-hover:bg-white/20">
                4. Personal Canvas
              </span>
              <div className="relative z-10 mt-1.5 flex max-w-[245px] flex-col items-end gap-0.5">
                <h3 className="font-display text-base font-bold tracking-tight text-white drop-shadow-xs">
                  Social Proof
                </h3>
                <p
                  className="text-xs leading-snug text-white/85 text-right"
                  data-no-auto-translate
                >
                  {previews.socialProof}
                </p>
                <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-white/80 group-hover:translate-x-1 group-hover:text-white transition-all">
                  Explore <span aria-hidden="true">→</span>
                </span>
              </div>
              </div>
            </button>

            {/* 6. Long-Term Vision (Bottom Full Width) */}
            <button
              type="button"
              data-canvas-section="longTermVision"
              aria-pressed={activeSection === 'longTermVision'}
              aria-label="Open Long-Term Vision details"
              onClick={() => onSelect('longTermVision')}
              className={[
                'group absolute z-10 flex flex-col justify-between p-6 text-left rounded-[1.75rem] cursor-pointer',
                'transition-all duration-300 ease-out hover:bg-brand/[0.14] hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand',
                activeSection === 'longTermVision'
                  ? 'bg-brand/[0.2] shadow-2xl'
                  : '',
              ].join(' ')}
              style={{
                left: '2.25%',
                top: '58.28%',
                width: '95.31%',
                height: '38.58%',
              }}
            >
              <div data-canvas-copy className="flex max-w-[300px] flex-col gap-1">
                <span className="w-fit rounded-full border border-rose-300/80 bg-white/80 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-rose-900 shadow-xs transition-colors group-hover:bg-white">
                  6. Personal Canvas
                </span>
                <h3 className="mt-0.5 font-display text-lg font-bold tracking-tight text-neutral-900">
                  Long-Term Vision
                </h3>
                <p
                  className="text-xs leading-snug text-neutral-700"
                  data-no-auto-translate
                >
                  {previews.longTermVision}
                </p>
                <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-brand group-hover:translate-x-1 transition-all">
                  Explore <span aria-hidden="true">→</span>
                </span>
              </div>

              {/* Milestone Text Badges (Positioned next to the pins on the background image) */}
              <div data-canvas-copy className="pointer-events-none absolute left-[32.8%] bottom-[12.5%] flex flex-col text-left">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-neutral-800 leading-none">
                  Short Term
                </span>
                <span className="mt-0.5 text-[11px] font-semibold text-neutral-600 leading-none">
                  1–2 years
                </span>
              </div>

              <div data-canvas-copy className="pointer-events-none absolute left-[57.5%] bottom-[23.5%] flex flex-col text-left">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-neutral-800 leading-none">
                  Mid Term
                </span>
                <span className="mt-0.5 text-[11px] font-semibold text-neutral-600 leading-none">
                  3–5 years
                </span>
              </div>

              <div data-canvas-copy className="pointer-events-none absolute right-[5%] top-[23%] flex flex-col text-left">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-neutral-800 leading-none">
                  Long Term
                </span>
                <span className="mt-0.5 text-[11px] font-semibold text-neutral-600 leading-none">
                  5+ years
                </span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
