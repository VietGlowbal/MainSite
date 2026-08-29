'use client';

import { useT } from '@/lib/i18n';
import type { PersonalReportV2, ProofCard, ReportConfidence } from '../../domain';
import { derivedSocialProofMetrics } from '../../domain/personal-canvas-details';
import { Badge, HorizontalBarChart, RadarChart } from '@/shared/ui';

const STRENGTH_POINTS: Record<ProofCard['evidenceStrength'], number> = {
  strong: 20,
  moderate: 12,
  limited: 5,
};

const VERIFICATION_POINTS: Record<ProofCard['verificationStatus'], number> = {
  verified: 20,
  attributable: 12,
  stated: 5,
};

function normalise(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function starsFromScore(score: number): 1 | 2 | 3 | 4 | 5 {
  if (score >= 80) return 5;
  if (score >= 60) return 4;
  if (score >= 40) return 3;
  if (score >= 20) return 2;
  return 1;
}

function evidenceLabel(score: number): string {
  if (score >= 80) return 'Very strong evidence';
  if (score >= 60) return 'Strong evidence';
  if (score >= 40) return 'Consistent evidence';
  if (score >= 20) return 'Emerging evidence';
  return 'Limited evidence';
}

function confidenceFromCount(count: number): ReportConfidence {
  if (count >= 3) return 'high';
  if (count >= 2) return 'medium';
  return 'low';
}

function confidenceLabel(confidence: ReportConfidence): string {
  return confidence === 'high' ? 'High confidence' : confidence === 'medium' ? 'Medium confidence' : 'Low confidence';
}

function Stars({ score }: { score: number }) {
  const stars = starsFromScore(score);
  return (
    <span aria-label={`${stars} out of 5 evidence stars`} className="whitespace-nowrap text-gb-lg tracking-[0.08em] text-fg-brand">
      <span aria-hidden="true">{'★'.repeat(stars)}{'☆'.repeat(5 - stars)}</span>
    </span>
  );
}

type CapabilityInsight = {
  name: string;
  score: number;
  evidenceCount: number;
  confidence: ReportConfidence;
  strongEvidenceCount: number;
  verifiedEvidenceCount: number;
  supportingCards: ProofCard[];
};

/**
 * Scores are evidence-strength scores, never admissions probability or a
 * psychological measurement. Recurrence, evidence quality, verification and
 * recorded outcomes contribute to the score. One activity is capped below
 * the "strong" band, and two activities below the "very strong" band.
 */
function capabilityInsights(report: PersonalReportV2): CapabilityInsight[] {
  if (!report.proofOfMe.available) return [];

  const grouped = new Map<string, { label: string; cards: ProofCard[] }>();
  for (const card of report.proofOfMe.cards) {
    for (const capability of card.competenciesDemonstrated) {
      const key = normalise(capability);
      if (!key) continue;
      const item = grouped.get(key) ?? { label: capability.trim(), cards: [] };
      if (!item.cards.some((existing) => existing.activityId === card.activityId)) item.cards.push(card);
      grouped.set(key, item);
    }
  }

  return [...grouped.values()]
    .map(({ label, cards }) => {
      const count = cards.length;
      const recurrence = Math.min(40, count * 15);
      const evidenceQuality = average(cards.map((card) => STRENGTH_POINTS[card.evidenceStrength]));
      const verification = average(cards.map((card) => VERIFICATION_POINTS[card.verificationStatus]));
      const outcomes = Math.round((cards.filter((card) => Boolean(card.outcome?.trim())).length / Math.max(count, 1)) * 20);
      const rawScore = Math.round(recurrence + evidenceQuality + verification + outcomes);
      const score = Math.min(count === 1 ? 59 : count === 2 ? 79 : 100, rawScore);
      return {
        name: label,
        score,
        evidenceCount: count,
        confidence: confidenceFromCount(count),
        strongEvidenceCount: cards.filter((card) => card.evidenceStrength === 'strong').length,
        verifiedEvidenceCount: cards.filter((card) => card.verificationStatus === 'verified').length,
        supportingCards: cards.slice(0, 4),
      };
    })
    .sort((a, b) => b.score - a.score || b.evidenceCount - a.evidenceCount || a.name.localeCompare(b.name))
    .slice(0, 6);
}

function motivationSignals(report: PersonalReportV2) {
  const motivations = report.drivingForce.repeatedMotivations.filter((value) => value.trim().length > 0);
  if (motivations.length === 0) return [];
  const grouped = new Map<string, { label: string; count: number }>();
  for (const value of motivations) {
    const key = normalise(value);
    const item = grouped.get(key) ?? { label: value.trim(), count: 0 };
    item.count += 1;
    grouped.set(key, item);
  }
  return [...grouped.values()]
    .map((item) => ({
      key: normalise(item.label),
      label: item.label,
      value: Math.round((item.count / motivations.length) * 100),
      evidenceCount: item.count,
      confidence: confidenceFromCount(item.count),
    }))
    .sort((a, b) => b.value - a.value || b.evidenceCount - a.evidenceCount)
    .slice(0, 5);
}

export function MotivationProfileView({ report }: { report: PersonalReportV2 }) {
  const signals = motivationSignals(report);
  if (signals.length === 0) return null;

  return (
    <div className="flex flex-col gap-gb-lg rounded-gb-xl border border-line p-gb-xl">
      <div className="flex flex-col gap-gb-xs">
        <p className="text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">Motivation profile</p>
        <h3 className="text-gb-lg font-semibold text-fg">What repeatedly appears in your own stated motivations</h3>
        <p className="text-gb-sm leading-relaxed text-fg-tertiary">
          These bars show recurrence across the motivations you explicitly recorded. They are not personality scores.
        </p>
      </div>
      <HorizontalBarChart
        ariaLabel="Repeated stated motivations"
        data={signals.map((signal) => ({
          key: signal.key,
          label: signal.label,
          value: signal.value,
          caption: `${signal.evidenceCount} supporting reflection${signal.evidenceCount === 1 ? '' : 's'} · ${confidenceLabel(signal.confidence)}`,
        }))}
      />
    </div>
  );
}

export function CapabilityProfileView({ report }: { report: PersonalReportV2 }) {
  const t = useT();
  const capabilities = capabilityInsights(report);
  if (capabilities.length === 0) return null;

  return (
    <div className="flex flex-col gap-gb-2xl">
      <div className="grid gap-gb-xl lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-gb-xl border border-line p-gb-xl">
          <p className="text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">Capability profile</p>
          <p className="mt-gb-md text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">{t('Capability overview')}</p>
          <p className="mt-gb-xs text-gb-sm leading-relaxed text-fg-tertiary">
            {report.narrativeDetails?.provenCapabilities?.overview ?? t('The clearest capabilities in this snapshot are {capabilities}. They are grounded in {count} recorded experiences.', {
                capabilities: capabilities.slice(0, 3).map((capability) => capability.name).join(', '),
                count: new Set(capabilities.flatMap((capability) => capability.supportingCards.map((card) => card.activityId))).size,
              })}
          </p>
          <p className="mt-gb-xs text-gb-sm leading-relaxed text-fg-tertiary">
            The strongest named capabilities extracted from your evidence. Scores represent evidence strength, not ability ceilings.
          </p>
          <div className="mt-gb-lg">
            <RadarChart
              ariaLabel="Named capability evidence profile"
              data={capabilities.map((capability) => ({
                key: normalise(capability.name),
                label: capability.name,
                value: capability.score,
              }))}
            />
          </div>
        </div>

        <div className="grid gap-gb-md sm:grid-cols-2">
          {capabilities.map((capability) => (
            <article key={capability.name} className="flex flex-col gap-gb-md rounded-gb-xl border border-line p-gb-lg">
              <div className="flex items-start justify-between gap-gb-md">
                <div>
                  <h3 className="text-gb-md font-semibold text-fg">{capability.name}</h3>
                  <p className="text-gb-xs text-fg-muted">{evidenceLabel(capability.score)}</p>
                </div>
                <Stars score={capability.score} />
              </div>
              <p className="text-gb-sm leading-relaxed text-fg-tertiary">
                {report.narrativeDetails?.provenCapabilities?.capabilities.find((item) => item.capability.toLowerCase() === capability.name.toLowerCase())?.howDemonstrated ?? (capability.evidenceCount >= 3
                  ? `Repeated across ${capability.evidenceCount} separate experiences, including ${capability.strongEvidenceCount} strongly supported example${capability.strongEvidenceCount === 1 ? '' : 's'}.`
                  : capability.evidenceCount === 2
                    ? 'Shown in two separate experiences. The pattern is becoming consistent, but needs broader repetition before it is treated as a defining capability.'
                    : 'Supported by one experience. GlowBal treats this as emerging evidence rather than a recurring strength.')}
              </p>
              {report.narrativeDetails?.provenCapabilities?.capabilities.find((item) => item.capability.toLowerCase() === capability.name.toLowerCase())?.whyItMatters ? (
                <p className="text-gb-xs leading-relaxed text-fg-muted">
                  <span className="font-semibold text-fg">{t('Why it matters')}:</span>{' '}
                  {report.narrativeDetails.provenCapabilities.capabilities.find((item) => item.capability.toLowerCase() === capability.name.toLowerCase())?.whyItMatters}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-gb-sm">
                <Badge variant="neutral-chip">{capability.evidenceCount} experience{capability.evidenceCount === 1 ? '' : 's'}</Badge>
                <Badge variant="neutral-chip">{confidenceLabel(capability.confidence)}</Badge>
                {capability.verifiedEvidenceCount > 0 ? <Badge variant="safe-chip">{capability.verifiedEvidenceCount} verified</Badge> : null}
              </div>
              <div className="border-t border-line pt-gb-md">
                <p className="text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">Supporting evidence</p>
                <ul className="mt-gb-sm flex flex-col gap-gb-xs text-gb-xs text-fg-tertiary" data-no-auto-translate>
                  {capability.supportingCards.map((card) => (
                    <li key={card.activityId} className="flex items-start justify-between gap-gb-md">
                      <span>{card.title}</span>
                      <span className="shrink-0 text-fg-muted">{card.evidenceStrength}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </div>
      <div className="rounded-gb-xl border border-line bg-surface-muted p-gb-xl">
        <p className="text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">{t('How these capabilities combine')}</p>
        <p className="mt-gb-xs text-gb-sm leading-relaxed text-fg-tertiary">{report.narrativeDetails?.provenCapabilities?.combinationInsight ?? t('This profile shows how the named capabilities overlap across the same evidence record. The combination is more informative than any single score and remains bounded by the supporting activities shown above.')}</p>
      </div>
      <p className="text-gb-xs text-fg-muted">
        Rating rule: recurrence + evidence quality + verification + recorded outcomes. One activity cannot receive more than 3 stars; two cannot receive 5 stars.
      </p>
    </div>
  );
}

function socialProofMetrics(report: PersonalReportV2) {
  const cards = report.proofOfMe.available ? report.proofOfMe.cards : [];
  return [
    { label: 'Experiences analysed', value: cards.length, caption: 'Contributing to this report' },
    { label: 'Strong evidence', value: cards.filter((card) => card.evidenceStrength === 'strong').length, caption: 'Outcome + capability + evidence' },
    {
      label: 'Checkable evidence',
      value: cards.filter((card) => card.verificationStatus === 'verified' || card.verificationStatus === 'attributable').length,
      caption: 'Verified or attributable',
    },
    { label: 'Recorded outcomes', value: cards.filter((card) => Boolean(card.outcome?.trim())).length, caption: 'A result or change is stated' },
    { label: 'Quantified outcomes', value: cards.filter((card) => /\d/.test(card.outcome ?? '')).length, caption: 'Includes a measurable result' },
    {
      label: 'Capabilities evidenced',
      value: new Set(cards.flatMap((card) => card.competenciesDemonstrated.map(normalise))).size,
      caption: 'Distinct grounded capabilities',
    },
    ...derivedSocialProofMetrics(cards),
  ];
}

export function SocialProofSummaryView({ report }: { report: PersonalReportV2 }) {
  const t = useT();
  const metrics = socialProofMetrics(report);
  if (metrics.every((metric) => metric.value === 0)) return null;
  const cards = report.proofOfMe.available ? report.proofOfMe.cards : [];
  const quantified = metrics.find((metric) => metric.label === 'Quantified outcomes')?.value ?? 0;
  const checkable = metrics.find((metric) => metric.label === 'Checkable evidence')?.value ?? 0;
  return (
    <div className="flex flex-col gap-gb-xl">
      <div className="grid gap-gb-md sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-gb-xl border border-line p-gb-lg">
            <p className="font-display text-gb-display-xs font-semibold text-fg">{metric.value}</p>
            <p className="mt-gb-xs text-gb-sm font-semibold text-fg">{t(metric.label)}</p>
            <p className="mt-1 text-gb-xs text-fg-muted">{t(metric.caption)}</p>
          </div>
        ))}
      </div>
      <div className="rounded-gb-xl border border-line bg-surface-muted p-gb-xl" data-no-auto-translate>
        <p className="text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">{t('What the numbers suggest')}</p>
        <p className="mt-gb-xs text-gb-sm leading-relaxed text-fg-tertiary">
          {report.narrativeDetails?.socialProof?.conclusion ?? t('The current record contains {activities} recorded experiences; {quantified} include quantified outcomes and {checkable} are verified or checkable. These counts describe the evidence base, not an admissions prediction.', {
            activities: cards.length,
            quantified,
            checkable,
          })}
        </p>
      </div>
    </div>
  );
}

type GrowthItem = {
  id: string;
  gap: string;
  title: string;
  source: 'Positioning' | 'Identity' | 'Theme';
  impact: 'High' | 'Medium';
  effort: 'Low' | 'Medium' | 'High';
  direction: string;
};

function growthItems(report: PersonalReportV2): GrowthItem[] {
  const raw: Array<Omit<GrowthItem, 'id' | 'effort' | 'direction'>> = [
    ...report.personalPositioning.whatPreventsStrongerPositioning.map((gap, index) => ({
      gap,
      title: index === 0 ? 'Stronger positioning' : 'Profile coherence',
      source: 'Positioning' as const,
      impact: 'High' as const,
    })),
    ...report.coreIdentity.stillDeveloping.map((gap) => ({
      gap,
      title: 'Identity evidence',
      source: 'Identity' as const,
      impact: 'High' as const,
    })),
    ...(report.emergingThemes.available
      ? report.emergingThemes.themes
          .filter((theme) => theme.status !== 'established_theme')
          .map((theme) => ({
            gap: theme.limitation,
            title: `${theme.theme} depth`,
            source: 'Theme' as const,
            impact: 'Medium' as const,
          }))
      : []),
  ];

  const seen = new Set<string>();
  return raw
    .filter((item) => {
      const key = normalise(item.gap);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 4)
    .map((item, index) => {
      const gap = item.gap.toLowerCase();
      const effort: GrowthItem['effort'] = /attach|evidence|detail|intended direction|clarif/.test(gap)
        ? 'Low'
        : /more activities|other themes|broader|narrow scope/.test(gap)
          ? 'High'
          : 'Medium';
      const direction = /evidence|linked|support|document/.test(gap)
        ? 'Strengthen an existing experience with specific outcomes or checkable supporting evidence.'
        : /intended direction|direction/.test(gap)
          ? 'State the direction you want to pursue and explicitly connect it to the experiences already supporting it.'
          : /theme|activities|broader|narrow scope/.test(gap)
            ? 'Build depth by showing this pattern in another context rather than relying on a single experience.'
            : 'Add another reflected example that clearly records your role, action and outcome.';
      return { ...item, id: `${item.source}-${index}`, effort, direction };
    });
}

function MatrixQuadrant({ title, subtitle, items }: { title: string; subtitle: string; items: GrowthItem[] }) {
  const t = useT();
  return (
    <div className="min-h-40 rounded-gb-xl border border-line bg-surface p-gb-lg">
      <p className="text-gb-sm font-semibold text-fg">{title}</p>
      <p className="text-gb-xs text-fg-muted">{subtitle}</p>
      <div className="mt-gb-md flex flex-col gap-gb-sm">
        {items.length === 0 ? (
          <p className="rounded-gb-md bg-surface-muted px-gb-md py-gb-sm text-gb-xs text-fg-muted">
            {t('No current priority in this quadrant.')}
          </p>
        ) : null}
        {items.map((item) => (
          <div key={item.id} className="rounded-gb-md bg-surface-muted px-gb-md py-gb-sm">
            <p className="text-gb-sm font-medium text-fg">{item.title}</p>
            <p className="text-gb-xs text-fg-muted">{item.source} signal</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function GrowthMatrixView({ report }: { report: PersonalReportV2 }) {
  const items = growthItems(report);
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-gb-xl rounded-gb-xl border border-line p-gb-xl">
      <div>
        <p className="text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">Growth priority matrix</p>
        <h3 className="mt-gb-xs text-gb-lg font-semibold text-fg">Where additional evidence could strengthen your profile</h3>
        <p className="mt-gb-xs text-gb-sm leading-relaxed text-fg-tertiary">
          Impact reflects how central the current gap is to your personal profile. Effort is an estimate based on whether the gap can be fixed by clarifying existing evidence or requires new experiences.
        </p>
      </div>
      <div className="grid gap-gb-md md:grid-cols-2">
        <MatrixQuadrant title="Quick wins" subtitle="High impact · Low/medium effort" items={items.filter((item) => item.impact === 'High' && item.effort !== 'High')} />
        <MatrixQuadrant title="Major investments" subtitle="High impact · High effort" items={items.filter((item) => item.impact === 'High' && item.effort === 'High')} />
        <MatrixQuadrant title="Useful additions" subtitle="Medium impact · Low/medium effort" items={items.filter((item) => item.impact === 'Medium' && item.effort !== 'High')} />
        <MatrixQuadrant title="Longer-term depth" subtitle="Medium impact · High effort" items={items.filter((item) => item.impact === 'Medium' && item.effort === 'High')} />
      </div>
      <div className="grid gap-gb-md sm:grid-cols-2">
        {items.map((item) => (
          <article key={item.id} className="rounded-gb-xl bg-surface-muted p-gb-lg">
            <div className="flex flex-wrap items-center gap-gb-sm">
              <Badge variant="neutral-chip">{item.impact} impact</Badge>
              <Badge variant="neutral-chip">{item.effort} effort</Badge>
            </div>
            <h4 className="mt-gb-md text-gb-sm font-semibold text-fg">{item.title}</h4>
            <p className="mt-gb-xs text-gb-sm leading-relaxed text-fg-tertiary" data-no-auto-translate>{item.gap}</p>
            <p className="mt-gb-md text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">Suggested direction</p>
            <p className="mt-gb-xs text-gb-sm text-fg-tertiary">{item.direction}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

export function FuturePathwaysView({ report }: { report: PersonalReportV2 }) {
  if (!report.emergingThemes.available || report.emergingThemes.themes.length === 0) return null;
  return (
    <div className="flex flex-col gap-gb-lg">
      <div>
        <p className="text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">Possible future directions</p>
        <p className="mt-gb-xs text-gb-sm leading-relaxed text-fg-tertiary">
          These are evidence-backed themes already present in your experiences. They are possibilities to explore, not career predictions.
        </p>
      </div>
      <div className="grid gap-gb-md sm:grid-cols-2">
        {report.emergingThemes.themes.slice(0, 4).map((theme) => (
          <article key={theme.theme} className="flex flex-col gap-gb-md rounded-gb-xl border border-line p-gb-lg">
            <div className="flex items-start justify-between gap-gb-md">
              <h3 className="text-gb-md font-semibold text-fg" data-no-auto-translate>{theme.theme}</h3>
              <Badge variant={theme.status === 'established_theme' ? 'safe-chip' : 'neutral-chip'}>{theme.statusLabel}</Badge>
            </div>
            <p className="text-gb-sm leading-relaxed text-fg-tertiary" data-no-auto-translate>{theme.explanation}</p>
            <div>
              <p className="text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">Supported by</p>
              <div className="mt-gb-sm flex flex-wrap gap-gb-sm" data-no-auto-translate>
                {theme.supportingExperiences.slice(0, 4).map((experience) => (
                  <Badge key={experience} variant="brand-chip">{experience}</Badge>
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
