'use client';

import type { PersonalReportV2 } from '../../domain';
import type {
  CapabilityRating,
  FuturePathway,
  GrowthPriority,
  PersonalCanvasDetails,
} from '../../domain/personal-canvas-details';
import { Badge, HorizontalBarChart, RadarChart } from '@/shared/ui';
import {
  CapabilityProfileView as LegacyCapabilityProfileView,
  FuturePathwaysView as LegacyFuturePathwaysView,
  GrowthMatrixView as LegacyGrowthMatrixView,
  MotivationProfileView as LegacyMotivationProfileView,
  SocialProofSummaryView as LegacySocialProofSummaryView,
} from './personal-report-insights';

type ReportWithCanvasDetails = PersonalReportV2 & { canvasDetails?: PersonalCanvasDetails };

function detailsFor(report: PersonalReportV2): PersonalCanvasDetails | undefined {
  return (report as ReportWithCanvasDetails).canvasDetails;
}

const BAND_LABEL: Record<CapabilityRating['band'], string> = {
  very_strong: 'Very strong evidence',
  strong: 'Strong evidence',
  consistent: 'Consistent evidence',
  emerging: 'Emerging evidence',
  limited: 'Limited evidence',
};

function confidenceLabel(confidence: CapabilityRating['confidence']): string {
  return confidence === 'high' ? 'High confidence' : confidence === 'medium' ? 'Medium confidence' : 'Low confidence';
}

function Stars({ stars }: { stars: CapabilityRating['stars'] }) {
  return (
    <span aria-label={`${stars} out of 5 evidence stars`} className="whitespace-nowrap text-gb-lg tracking-[0.08em] text-fg-brand">
      <span aria-hidden="true">{'★'.repeat(stars)}{'☆'.repeat(5 - stars)}</span>
    </span>
  );
}

export function SnapshotCapabilityProfileView({ report }: { report: PersonalReportV2 }) {
  const details = detailsFor(report);
  if (!details) return <LegacyCapabilityProfileView report={report} />;
  if (details.capabilities.length === 0) return null;

  return (
    <div className="flex flex-col gap-gb-2xl">
      <div className="grid gap-gb-xl lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-gb-xl border border-line p-gb-xl">
          <p className="text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">Capability profile</p>
          <p className="mt-gb-xs text-gb-sm leading-relaxed text-fg-tertiary">
            The strongest named capabilities in this report snapshot. Scores represent strength of supporting evidence, not an ability ceiling.
          </p>
          <div className="mt-gb-lg">
            <RadarChart
              ariaLabel="Named capability evidence profile"
              data={details.capabilities.map((capability) => ({
                key: capability.name.toLowerCase().replace(/\s+/g, '-'),
                label: capability.name,
                value: capability.score,
              }))}
            />
          </div>
        </div>

        <div className="grid gap-gb-md sm:grid-cols-2">
          {details.capabilities.map((capability) => (
            <article key={capability.name} className="flex flex-col gap-gb-md rounded-gb-xl border border-line p-gb-lg">
              <div className="flex items-start justify-between gap-gb-md">
                <div>
                  <h3 className="text-gb-md font-semibold text-fg" data-no-auto-translate>{capability.name}</h3>
                  <p className="text-gb-xs text-fg-muted">{BAND_LABEL[capability.band]}</p>
                </div>
                <Stars stars={capability.stars} />
              </div>
              <p className="text-gb-sm leading-relaxed text-fg-tertiary">{capability.why}</p>
              <div className="flex flex-wrap gap-gb-sm">
                <Badge variant="neutral-chip">{capability.evidenceCount} experience{capability.evidenceCount === 1 ? '' : 's'}</Badge>
                <Badge variant="neutral-chip">{confidenceLabel(capability.confidence)}</Badge>
                {capability.verifiedEvidenceCount > 0 ? (
                  <Badge variant="safe-chip">{capability.verifiedEvidenceCount} verified</Badge>
                ) : null}
              </div>
              <div className="border-t border-line pt-gb-md">
                <p className="text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">Supporting evidence</p>
                <ul className="mt-gb-sm flex flex-col gap-gb-xs text-gb-xs text-fg-tertiary" data-no-auto-translate>
                  {capability.supportingEvidence.map((evidence) => (
                    <li key={evidence.activityId} className="flex items-start justify-between gap-gb-md">
                      <span>{evidence.title}</span>
                      <span className="shrink-0 text-fg-muted">{evidence.evidenceStrength}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </div>
      <p className="text-gb-xs text-fg-muted">
        Rating rule: recurrence + evidence quality + verification + recorded outcomes. One activity cannot receive more than 3 stars; two cannot receive 5 stars.
      </p>
    </div>
  );
}

export function SnapshotMotivationProfileView({ report }: { report: PersonalReportV2 }) {
  const details = detailsFor(report);
  if (!details) return <LegacyMotivationProfileView report={report} />;
  if (details.motivations.length === 0) return null;

  return (
    <div className="flex flex-col gap-gb-lg rounded-gb-xl border border-line p-gb-xl">
      <div className="flex flex-col gap-gb-xs">
        <p className="text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">Motivation profile</p>
        <h3 className="text-gb-lg font-semibold text-fg">What repeatedly appears in your stated motivations</h3>
        <p className="text-gb-sm leading-relaxed text-fg-tertiary">
          These bars show recurrence across motivations you explicitly recorded. They are not personality scores.
        </p>
      </div>
      <HorizontalBarChart
        ariaLabel="Repeated stated motivations"
        data={details.motivations.map((motivation) => ({
          key: motivation.label.toLowerCase().replace(/\s+/g, '-'),
          label: motivation.label,
          value: motivation.score,
          caption: `${motivation.evidenceCount} supporting reflection${motivation.evidenceCount === 1 ? '' : 's'} · ${confidenceLabel(motivation.confidence)}`,
        }))}
      />
    </div>
  );
}

export function SnapshotSocialProofSummaryView({ report }: { report: PersonalReportV2 }) {
  const details = detailsFor(report);
  if (!details) return <LegacySocialProofSummaryView report={report} />;
  if (details.socialProof.every((metric) => metric.value === 0)) return null;

  return (
    <div className="grid gap-gb-md sm:grid-cols-2 lg:grid-cols-3">
      {details.socialProof.map((metric) => (
        <div key={metric.key} className="rounded-gb-xl border border-line p-gb-lg">
          <p className="font-display text-gb-display-xs font-semibold text-fg">{metric.value}</p>
          <p className="mt-gb-xs text-gb-sm font-semibold text-fg">{metric.label}</p>
          <p className="mt-1 text-gb-xs text-fg-muted">{metric.caption}</p>
        </div>
      ))}
    </div>
  );
}

function MatrixQuadrant({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle: string;
  items: GrowthPriority[];
}) {
  return (
    <div className="min-h-40 rounded-gb-xl border border-line bg-surface p-gb-lg">
      <p className="text-gb-sm font-semibold text-fg">{title}</p>
      <p className="text-gb-xs text-fg-muted">{subtitle}</p>
      <div className="mt-gb-md flex flex-col gap-gb-sm">
        {items.map((item) => (
          <div key={item.id} className="rounded-gb-md bg-surface-muted px-gb-md py-gb-sm">
            <p className="text-gb-sm font-medium text-fg">{item.title}</p>
            <p className="text-gb-xs capitalize text-fg-muted">{item.source} signal</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SnapshotGrowthMatrixView({ report }: { report: PersonalReportV2 }) {
  const details = detailsFor(report);
  if (!details) return <LegacyGrowthMatrixView report={report} />;
  const items = details.growthPriorities;
  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-gb-xl rounded-gb-xl border border-line p-gb-xl">
      <div>
        <p className="text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">Growth priority matrix</p>
        <h3 className="mt-gb-xs text-gb-lg font-semibold text-fg">Where additional evidence could strengthen your profile</h3>
        <p className="mt-gb-xs text-gb-sm leading-relaxed text-fg-tertiary">
          Impact reflects how central the current gap is to your personal profile. Effort estimates whether it can be improved by clarifying current evidence or needs new experiences.
        </p>
      </div>
      <div className="grid gap-gb-md md:grid-cols-2">
        <MatrixQuadrant title="Quick wins" subtitle="High impact · Low/medium effort" items={items.filter((item) => item.impact === 'high' && item.effort !== 'high')} />
        <MatrixQuadrant title="Major investments" subtitle="High impact · High effort" items={items.filter((item) => item.impact === 'high' && item.effort === 'high')} />
        <MatrixQuadrant title="Useful additions" subtitle="Medium impact · Low/medium effort" items={items.filter((item) => item.impact === 'medium' && item.effort !== 'high')} />
        <MatrixQuadrant title="Longer-term depth" subtitle="Medium impact · High effort" items={items.filter((item) => item.impact === 'medium' && item.effort === 'high')} />
      </div>
      <div className="grid gap-gb-md sm:grid-cols-2">
        {items.map((item) => (
          <article key={item.id} className="rounded-gb-xl bg-surface-muted p-gb-lg">
            <div className="flex flex-wrap items-center gap-gb-sm">
              <Badge variant="neutral-chip"><span className="capitalize">{item.impact}</span> impact</Badge>
              <Badge variant="neutral-chip"><span className="capitalize">{item.effort}</span> effort</Badge>
            </div>
            <h4 className="mt-gb-md text-gb-sm font-semibold text-fg">{item.title}</h4>
            <p className="mt-gb-xs text-gb-sm leading-relaxed text-fg-tertiary" data-no-auto-translate>{item.gap}</p>
            <p className="mt-gb-md text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">Suggested direction</p>
            <p className="mt-gb-xs text-gb-sm text-fg-tertiary">{item.suggestedDirection}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function PathwayCard({ pathway }: { pathway: FuturePathway }) {
  return (
    <article className="flex flex-col gap-gb-md rounded-gb-xl border border-line p-gb-lg">
      <div className="flex items-start justify-between gap-gb-md">
        <h3 className="text-gb-md font-semibold text-fg" data-no-auto-translate>{pathway.label}</h3>
        <Badge variant={pathway.isStatedDirection ? 'brand-chip' : pathway.confidence === 'high' ? 'safe-chip' : 'neutral-chip'}>
          {pathway.statusLabel}
        </Badge>
      </div>
      <p className="text-gb-sm leading-relaxed text-fg-tertiary" data-no-auto-translate>{pathway.rationale}</p>
      {pathway.supportingExperiences.length > 0 ? (
        <div>
          <p className="text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">Supported by</p>
          <div className="mt-gb-sm flex flex-wrap gap-gb-sm" data-no-auto-translate>
            {pathway.supportingExperiences.map((experience) => (
              <Badge key={experience} variant="brand-chip">{experience}</Badge>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}

export function SnapshotFuturePathwaysView({ report }: { report: PersonalReportV2 }) {
  const details = detailsFor(report);
  if (!details) return <LegacyFuturePathwaysView report={report} />;
  if (details.futurePathways.length === 0) return null;

  return (
    <div className="flex flex-col gap-gb-lg">
      <div>
        <p className="text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">Possible future directions</p>
        <p className="mt-gb-xs text-gb-sm leading-relaxed text-fg-tertiary">
          Your stated direction is separated from evidence-backed emerging themes. The latter are possibilities to explore, not career predictions.
        </p>
      </div>
      <div className="grid gap-gb-md sm:grid-cols-2">
        {details.futurePathways.map((pathway) => <PathwayCard key={`${pathway.isStatedDirection ? 'stated' : 'theme'}-${pathway.label}`} pathway={pathway} />)}
      </div>
    </div>
  );
}
