'use client';

import type { ReactNode } from 'react';
import { useT } from '@/lib/i18n';
import type { PersonalReportV2 } from '../../domain';
import { AreasForGrowthView } from './areas-for-growth';
import { CoreIdentityView } from './core-identity';
import { DrivingForceView } from './driving-force';
import { EmergingThemesView } from './emerging-themes';
import { IdentityEvidenceProfileView } from './identity-evidence-profile';
import { PersonalPositioningView } from './personal-positioning';
import { ProofOfMeView } from './proof-of-me';
import {
  SnapshotCapabilityProfileView,
  SnapshotFuturePathwaysView,
  SnapshotGrowthMatrixView,
  SnapshotMotivationProfileView,
  SnapshotSocialProofSummaryView,
} from './personal-report-snapshot-insights';
import { SignaturePatternView } from './signature-pattern';

function PrintChapter({
  index,
  title,
  description,
  children,
}: {
  index: number;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-gb-xl border-t border-line pt-gb-2xl print:[break-inside:avoid-page]">
      <div className="flex flex-col gap-gb-sm">
        <p className="text-gb-xs font-semibold uppercase tracking-[0.14em] text-fg-brand">
          {index}. Personal Canvas
        </p>
        <h2 className="font-display text-gb-display-sm font-semibold tracking-gb-display-tight text-fg">
          {title}
        </h2>
        <p className="max-w-3xl text-gb-sm leading-relaxed text-fg-tertiary">
          {description}
        </p>
      </div>
      {children}
    </section>
  );
}

/**
 * Linear fallback used only by print/PDF media. The interactive Canvas is the
 * canonical web experience; print still needs every evidence-backed chapter
 * in one deterministic snapshot, regardless of which panel was open onscreen.
 */
export function PersonalReportPrintView({
  report,
  returnTo,
}: {
  report: PersonalReportV2;
  returnTo: string | undefined;
}) {
  const t = useT();

  return (
    // Duplicates the interactive Canvas content in a flat, printable layout —
    // real report content for sighted print users, but a screen reader
    // shouldn't see two copies of the same report, and none of the section
    // components here get `onAnswered` (no interactive save flow makes sense
    // on a printed page), so their gap actions render as plain links rather
    // than the inline-answer buttons the interactive Canvas uses.
    <div className="hidden flex-col gap-gb-3xl print:flex" aria-hidden="true">
      <PrintChapter
        index={1}
        title={t('Core Identity')}
        description={t(
          'The recurring roles, behaviours and patterns that describe who you consistently show yourself to be.',
        )}
      >
        <div className="flex flex-col gap-gb-xl">
          <CoreIdentityView section={report.coreIdentity} returnTo={returnTo} />
          <IdentityEvidenceProfileView report={report} />
          <SignaturePatternView
            section={report.signaturePattern}
            patternSupport={report.analytics?.signaturePatternSupport}
            returnTo={returnTo}
          />
        </div>
      </PrintChapter>

      <PrintChapter
        index={2}
        title={t('Driving Forces')}
        description={t(
          'What repeatedly motivates your choices, where those motivations appear in your experiences, and how confidently the evidence supports them.',
        )}
      >
        <div className="flex flex-col gap-gb-xl">
          <DrivingForceView section={report.drivingForce} returnTo={returnTo} />
          <SnapshotMotivationProfileView report={report} />
        </div>
      </PrintChapter>

      <PrintChapter
        index={3}
        title={t('Proven Capabilities')}
        description={t(
          'What your evidence demonstrates you can do, how those strengths combine, and the positioning they create for you as an applicant.',
        )}
      >
        <div className="flex flex-col gap-gb-xl">
          <SnapshotCapabilityProfileView report={report} />
          <PersonalPositioningView
            section={report.personalPositioning}
            positioningDimensions={report.analytics?.positioningDimensions}
            returnTo={returnTo}
          />
        </div>
      </PrintChapter>

      <PrintChapter
        index={4}
        title={t('Social Proof')}
        description={t(
          'The tangible activities, outcomes and verification that make the claims in your profile credible.',
        )}
      >
        <div className="flex flex-col gap-gb-xl">
          <SnapshotSocialProofSummaryView report={report} />
          <ProofOfMeView
            section={report.proofOfMe}
            evidenceSummary={report.analytics?.evidenceSummary}
            overallSummary={undefined}
            returnTo={returnTo}
          />
        </div>
      </PrintChapter>

      <PrintChapter
        index={5}
        title={t('Areas for Growth')}
        description={t(
          'Where the current evidence is limited, what still needs development, and where stronger proof could make the profile more complete.',
        )}
      >
        <div className="flex flex-col gap-gb-xl">
          <SnapshotGrowthMatrixView report={report} />
          <AreasForGrowthView report={report} />
        </div>
      </PrintChapter>

      <PrintChapter
        index={6}
        title={t('Long-Term Vision')}
        description={t(
          'The themes and directions emerging from the choices you repeatedly make — presented as possibilities, not predictions.',
        )}
      >
        <div className="flex flex-col gap-gb-xl">
          <SnapshotFuturePathwaysView report={report} />
          <EmergingThemesView
            section={report.emergingThemes}
            themeMaturity={report.analytics?.themeMaturity}
            returnTo={returnTo}
          />
        </div>
      </PrintChapter>
    </div>
  );
}
