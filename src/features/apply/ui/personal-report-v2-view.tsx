'use client';

import { useState } from 'react';
import { useT } from '@/lib/i18n';
import type {
  CoreIdentitySection,
  DrivingForceSection,
  EmergingThemesSection,
  InsufficientData,
  PersonalPositioningSection,
  PersonalReportV2,
  ProofOfMeSection,
  ReportConfidence,
  SignaturePatternSection,
} from '../domain';
import { Badge, Button, Panel, PanelHeader } from '@/shared/ui';
import { useLoadingIndicator } from '@/shared/ui/loading-overlay';

/**
 * The canonical Personal Report — six sections, report-like, not a
 * dashboard. Renders `PersonalReportV2` (`src/features/apply/domain/
 * personal-report.ts`), which is itself a rendering of the Shared
 * Evaluation Engine's `ProfileEvaluation` — every claim shown here traces
 * back to that structured object.
 *
 * ─── WHY ONE LONG PAGE, NOT SIX TABS ─────────────────────────────────────────
 *
 * The v1 view (`personal-report-view.tsx`, now superseded) used a tab strip.
 * The rebuild spec asks for something "report-like, generous white space,
 * not dashboard-heavy" — a report is read top to bottom, not clicked through
 * section by section, and a PDF export (structural groundwork only, not
 * built yet) reads naturally from a single scroll rather than six hidden
 * panels. Each section is its own `<section>` with its own heading, so a
 * long page still has real in-page structure for a screen reader.
 *
 * ─── ONE CONFIDENCE NUMBER, LABELLED HONESTLY ────────────────────────────────
 *
 * `overallEvidenceConfidence` is exactly `ProfileEvaluation.confidence` — the
 * engine's own floor, not an average and not a new metric. It is shown once,
 * in the header, labelled "Overall evidence confidence" — never an
 * admissions-probability number.
 */

const CONFIDENCE_LABEL: Record<ReportConfidence, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

const CONFIDENCE_BADGE_VARIANT: Record<ReportConfidence, 'safe-chip' | 'brand-chip' | 'neutral-chip'> = {
  high: 'safe-chip',
  medium: 'brand-chip',
  low: 'neutral-chip',
};

function ConfidenceBadge({ confidence }: { confidence: ReportConfidence }) {
  const t = useT();
  return <Badge variant={CONFIDENCE_BADGE_VARIANT[confidence]}>{t(CONFIDENCE_LABEL[confidence])}</Badge>;
}

function InsufficientDataCard({ data }: { data: InsufficientData }) {
  const t = useT();
  return (
    <div className="flex flex-col gap-gb-md rounded-gb-xl border border-line bg-surface-muted p-gb-xl">
      <p className="text-gb-sm font-semibold text-fg">{t('More evidence needed')}</p>
      <p className="text-gb-sm text-fg-tertiary" data-no-auto-translate>
        {data.reason}
      </p>
      {data.actions.length > 0 ? (
        <div className="flex flex-wrap gap-gb-md">
          {data.actions.map((action) => (
            <Button key={action.kind + action.href} href={action.href} variant="secondary" size="sm">
              {t(action.label)}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SectionShell({
  eyebrow,
  title,
  confidence,
  children,
}: {
  eyebrow: string;
  title: string;
  confidence?: ReportConfidence | undefined;
  children: React.ReactNode;
}) {
  return (
    <Panel as="section" elevation="flat" className="flex flex-col gap-gb-xl">
      <PanelHeader
        title={title}
        description={eyebrow}
        action={confidence ? <ConfidenceBadge confidence={confidence} /> : undefined}
      />
      <div className="flex flex-col gap-gb-lg">{children}</div>
    </Panel>
  );
}

/* ── Section 1 — Core Identity ─────────────────────────────────────────── */

function CoreIdentityView({ section }: { section: CoreIdentitySection }) {
  const t = useT();
  return (
    <SectionShell eyebrow={t('Core Identity')} title={t('Who they consistently are')} confidence={section.confidence}>
      {section.available ? (
        <div className="flex flex-col gap-gb-lg" data-no-auto-translate>
          <h3 className="font-display text-gb-display-xs font-semibold tracking-gb-display-tight text-fg">
            {section.headline}
          </h3>
          <p className="text-gb-md leading-relaxed text-fg-tertiary">{section.interpretation}</p>
          <div className="grid gap-gb-lg sm:grid-cols-3">
            {section.recurringRole ? (
              <div>
                <p className="text-gb-xs text-fg-muted">{t('Recurring role')}</p>
                <p className="text-gb-sm text-fg">{section.recurringRole}</p>
              </div>
            ) : null}
            {section.valueOrientation ? (
              <div>
                <p className="text-gb-xs text-fg-muted">{t('Value orientation')}</p>
                <p className="text-gb-sm text-fg">{section.valueOrientation}</p>
              </div>
            ) : null}
          </div>
          {section.recurringBehaviours.length > 0 ? (
            <div className="flex flex-col gap-gb-sm">
              <p className="text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">
                {t('What GlowBal observed')}
              </p>
              <ul className="flex list-disc flex-col gap-gb-xs pl-gb-xl text-gb-sm text-fg-tertiary">
                {section.observations.map((observation) => (
                  <li key={observation}>{observation}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {section.stillDeveloping.length > 0 ? (
            <p className="text-gb-xs text-fg-muted">
              {t('Still developing')}: {section.stillDeveloping.join(' ')}
            </p>
          ) : null}
        </div>
      ) : (
        <InsufficientDataCard data={section.insufficientData!} />
      )}
    </SectionShell>
  );
}

/* ── Section 2 — Driving Force ─────────────────────────────────────────── */

function DrivingForceView({ section }: { section: DrivingForceSection }) {
  const t = useT();
  return (
    <SectionShell eyebrow={t('Driving Force')} title={t('What consistently motivates them')} confidence={section.confidence}>
      {section.available ? (
        <div className="flex flex-col gap-gb-lg" data-no-auto-translate>
          <div className="flex flex-wrap items-center gap-gb-md">
            <h3 className="font-display text-gb-display-xs font-semibold tracking-gb-display-tight text-fg">
              {section.headline}
            </h3>
            {section.isHypothesis ? (
              <Badge variant="neutral-chip">{t('Emerging hypothesis')}</Badge>
            ) : null}
          </div>
          <p className="text-gb-md leading-relaxed text-fg-tertiary">{section.explanation}</p>
          {section.repeatedMotivations.length > 0 ? (
            <div className="flex flex-col gap-gb-sm">
              <p className="text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">
                {t('Repeated motivations')}
              </p>
              <ul className="flex list-disc flex-col gap-gb-xs pl-gb-xl text-gb-sm text-fg-tertiary">
                {section.repeatedMotivations.map((motivation) => (
                  <li key={motivation}>{motivation}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {section.missingPersonalGrounding ? (
            <p className="rounded-gb-xl bg-surface-muted p-gb-lg text-gb-sm text-fg-tertiary">
              {section.missingPersonalGrounding}
            </p>
          ) : null}
          {section.reflectionPrompt ? (
            <div className="flex flex-wrap items-center justify-between gap-gb-md rounded-gb-xl border border-line bg-surface-muted p-gb-lg">
              <p className="text-gb-sm text-fg-tertiary">{section.reflectionPrompt}</p>
              <Button href="/ai-strategy/reflection" variant="secondary" size="sm">
                {t('Answer this')}
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <InsufficientDataCard data={section.insufficientData!} />
      )}
    </SectionShell>
  );
}

/* ── Section 3 — Signature Pattern ─────────────────────────────────────── */

function SignaturePatternView({ section }: { section: SignaturePatternSection }) {
  const t = useT();
  return (
    <SectionShell
      eyebrow={t('Signature Pattern')}
      title={t('The behavioural sequence that repeats')}
      confidence={section.confidence}
    >
      {section.available ? (
        <div className="flex flex-col gap-gb-lg" data-no-auto-translate>
          <div className="flex flex-wrap items-center gap-gb-lg text-gb-sm text-fg-tertiary">
            <span>
              {t('Pattern strength')}:{' '}
              {section.patternStrength === 'established' ? t('Established') : t('Emerging')}
            </span>
            <span>
              {t('{count} supporting experiences', { count: section.supportingExperienceCount })}
            </span>
          </div>
          <div className="grid gap-gb-lg sm:grid-cols-2">
            {section.steps.map((step, index) => (
              <div key={step.key} className="flex flex-col gap-gb-sm rounded-gb-xl border border-line p-gb-lg">
                <p className="text-gb-xs font-semibold uppercase tracking-wide text-fg-brand">
                  {index + 1}. {step.label}
                </p>
                <p className="text-gb-sm text-fg">{step.description}</p>
                {step.examples.length > 0 ? (
                  <p className="text-gb-xs text-fg-muted">{step.examples.join(', ')}</p>
                ) : null}
              </div>
            ))}
          </div>
          {section.distinctiveness ? (
            <p className="text-gb-sm text-fg-tertiary">{section.distinctiveness}</p>
          ) : null}
        </div>
      ) : (
        <InsufficientDataCard data={section.insufficientData!} />
      )}
    </SectionShell>
  );
}

/* ── Section 4 — Emerging Themes ───────────────────────────────────────── */

function EmergingThemesView({ section }: { section: EmergingThemesSection }) {
  const t = useT();
  return (
    <SectionShell eyebrow={t('Emerging Themes')} title={t('What they keep returning to')}>
      {section.available ? (
        <div className="flex flex-col gap-gb-lg">
          {section.themes.map((theme) => (
            <div key={theme.theme} className="flex flex-col gap-gb-sm rounded-gb-xl border border-line p-gb-lg" data-no-auto-translate>
              <div className="flex flex-wrap items-center justify-between gap-gb-md">
                <h3 className="text-gb-md font-semibold text-fg">{theme.theme}</h3>
                <Badge variant="neutral-chip">{theme.statusLabel}</Badge>
              </div>
              <p className="text-gb-sm text-fg-tertiary">{theme.explanation}</p>
              {theme.supportingExperiences.length > 0 ? (
                <p className="text-gb-xs text-fg-muted">{theme.supportingExperiences.join(', ')}</p>
              ) : null}
              <p className="text-gb-xs text-fg-muted">{theme.limitation}</p>
            </div>
          ))}
        </div>
      ) : (
        <InsufficientDataCard data={section.insufficientData!} />
      )}
    </SectionShell>
  );
}

/* ── Section 5 — Personal Positioning ──────────────────────────────────── */

function PositioningTrait({ label, value }: { label: string; value: boolean }) {
  const t = useT();
  return (
    <div className="flex items-center justify-between gap-gb-md rounded-gb-md border border-line px-gb-lg py-gb-sm">
      <span className="text-gb-sm text-fg-tertiary">{label}</span>
      <Badge variant={value ? 'safe-chip' : 'neutral-chip'}>{value ? t('Yes') : t('Not yet')}</Badge>
    </div>
  );
}

function PersonalPositioningView({ section }: { section: PersonalPositioningSection }) {
  const t = useT();
  return (
    <SectionShell
      eyebrow={t('Personal Positioning')}
      title={t('An evidence-grounded positioning statement')}
      confidence={section.confidence}
    >
      {section.available ? (
        <div className="flex flex-col gap-gb-lg">
          <p className="text-gb-md leading-relaxed text-fg" data-no-auto-translate>
            {section.statement}
          </p>
          <div className="grid gap-gb-sm sm:grid-cols-2">
            <PositioningTrait label={t('Authentic')} value={section.authentic} />
            <PositioningTrait label={t('Differentiated')} value={section.differentiated} />
            <PositioningTrait label={t('Coherent')} value={section.coherent} />
            <PositioningTrait label={t('Direction aligned')} value={section.directionAligned} />
            <PositioningTrait label={t('Credible')} value={section.credible} />
          </div>
          {section.whatPreventsStrongerPositioning.length > 0 ? (
            <div className="flex flex-col gap-gb-sm">
              <p className="text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">
                {t('What prevents stronger positioning')}
              </p>
              <ul className="flex list-disc flex-col gap-gb-xs pl-gb-xl text-gb-sm text-fg-tertiary">
                {section.whatPreventsStrongerPositioning.map((limitation) => (
                  <li key={limitation}>{limitation}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : (
        <InsufficientDataCard data={section.insufficientData!} />
      )}
    </SectionShell>
  );
}

/* ── Section 6 — Proof of Me ────────────────────────────────────────────── */

const VERIFICATION_LABEL: Record<string, string> = {
  verified: 'Verified',
  attributable: 'Checkable',
  stated: 'Self-reported',
};

function ProofOfMeView({ section }: { section: ProofOfMeSection }) {
  const t = useT();
  return (
    <SectionShell eyebrow={t('Proof of Me')} title={t('The evidence behind every claim above')}>
      {section.available ? (
        <div className="grid gap-gb-lg sm:grid-cols-2">
          {section.cards.map((card) => (
            <div key={card.activityId} className="flex flex-col gap-gb-md rounded-gb-xl border border-line p-gb-lg" data-no-auto-translate>
              <div className="flex flex-wrap items-start justify-between gap-gb-md">
                <div>
                  <h3 className="text-gb-md font-semibold text-fg">{card.title}</h3>
                  {card.role ? <p className="text-gb-xs text-fg-muted">{card.role}</p> : null}
                </div>
                <Badge variant={card.evidenceStrength === 'strong' ? 'safe-chip' : 'neutral-chip'}>
                  {t('Evidence')}: {card.evidenceStrength}
                </Badge>
              </div>
              {card.personalContribution ? (
                <p className="text-gb-sm text-fg-tertiary">{card.personalContribution}</p>
              ) : null}
              {card.outcome ? <p className="text-gb-sm font-medium text-fg">{card.outcome}</p> : null}
              {card.competenciesDemonstrated.length > 0 ? (
                <div className="flex flex-wrap gap-gb-sm">
                  {card.competenciesDemonstrated.map((competency) => (
                    <Badge key={competency} variant="brand-chip">
                      {competency}
                    </Badge>
                  ))}
                </div>
              ) : null}
              {card.supports.length > 0 ? (
                <p className="text-gb-xs text-fg-muted">
                  {t('Supports')}: {card.supports.join(', ')}
                </p>
              ) : null}
              <div className="flex items-center justify-between gap-gb-md border-t border-line pt-gb-md">
                <Badge variant="neutral-chip">{t(VERIFICATION_LABEL[card.verificationStatus] ?? card.verificationStatus)}</Badge>
                {card.evidenceSource ? (
                  <span className="text-gb-xs text-fg-muted">{card.evidenceSource}</span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <InsufficientDataCard data={section.insufficientData!} />
      )}
    </SectionShell>
  );
}

/* ── Report shell ──────────────────────────────────────────────────────── */

export function PersonalReportV2View({
  initialReport,
  studentName,
  generatedAt,
  migrationMissing,
}: {
  initialReport: PersonalReportV2 | null;
  studentName: string;
  generatedAt: string | null;
  migrationMissing: boolean;
}) {
  const t = useT();
  const [report, setReport] = useState(initialReport);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    migrationMissing ? t('This feature is not enabled in the database.') : null,
  );
  const [nextAt, setNextAt] = useState<string | null>(null);
  useLoadingIndicator(busy, report ? t('Updating your Personal Report') : t('Creating your Personal Report'));

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/ai-strategy/personal-report', { method: 'POST' });
      const body = await response.json().catch(() => ({}));
      if (body.reportV2) setReport(body.reportV2 as PersonalReportV2);
      if (body.nextRegenerationAt) setNextAt(body.nextRegenerationAt as string);
      if (!response.ok) throw new Error(body.error || t('Could not create the report.'));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t('Could not create the report.'));
    } finally {
      setBusy(false);
    }
  }

  if (!report) {
    return (
      <div className="flex min-h-[32rem] flex-col items-center justify-center gap-gb-2xl text-center">
        <Badge variant="brand-subtle">{t('Personal Report')}</Badge>
        <div className="flex max-w-2xl flex-col gap-gb-md">
          <h1 className="font-display text-gb-display-md font-semibold tracking-gb-display-tight text-fg">
            {t('Who is this applicant?')}
          </h1>
          <p className="text-gb-md text-fg-tertiary">
            {t('GlowBal reads your reflection, achievements, and activities to find evidence-backed patterns. Missing data is called out rather than filled in by AI.')}
          </p>
        </div>
        {error ? <p className="max-w-xl text-gb-sm text-fg-error">{error}</p> : null}
        <Button size="lg" onClick={generate} disabled={busy || migrationMissing}>
          {busy ? t('Creating report…') : t('Create report')}
        </Button>
        <Button href="/ai-strategy/reflection" variant="secondary">
          {t('Review Reflection')}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-gb-3xl">
      <header className="flex flex-col gap-gb-lg">
        <Badge variant="brand-subtle">{t('Personal Report')}</Badge>
        <div className="flex flex-wrap items-end justify-between gap-gb-lg">
          <div className="flex flex-col gap-gb-xs">
            <h1 className="font-display text-gb-display-md font-semibold tracking-gb-display-tight text-fg" data-no-auto-translate>
              {studentName}
            </h1>
            {generatedAt ? (
              <p className="text-gb-xs text-fg-muted">
                {t('Generated')}: {new Date(generatedAt).toLocaleDateString('vi-VN')}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-gb-md">
            <span className="text-gb-sm text-fg-tertiary">{t('Overall evidence confidence')}:</span>
            <ConfidenceBadge confidence={report.overallEvidenceConfidence} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-gb-lg border-t border-line pt-gb-lg">
          <Button href="/ai-strategy/reflection" variant="secondary" size="sm">
            {t('View confirmed information')}
          </Button>
        </div>
        {nextAt ? (
          <p className="text-gb-xs text-fg-muted">
            {t('Next free generation')}: {new Date(nextAt).toLocaleString('vi-VN')}
          </p>
        ) : null}
        {error ? <p className="text-gb-sm text-fg-error">{error}</p> : null}
      </header>

      <CoreIdentityView section={report.coreIdentity} />
      <DrivingForceView section={report.drivingForce} />
      <SignaturePatternView section={report.signaturePattern} />
      <EmergingThemesView section={report.emergingThemes} />
      <PersonalPositioningView section={report.personalPositioning} />
      <ProofOfMeView section={report.proofOfMe} />

      <div className="flex flex-wrap justify-between gap-gb-lg border-t border-line pt-gb-2xl">
        <Button href="/ai-strategy/reflection" variant="secondary">
          {t('View confirmed information')}
        </Button>
        <Button href="/ai-strategy/matching">{t('Continue to Matching Report')}</Button>
      </div>
    </div>
  );
}
