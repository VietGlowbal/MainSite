'use client';

import Link from 'next/link';
import type {
  Confidence,
  EvidenceItem,
  EvidenceProfile,
  NarrativeProfile,
  PortraitSectionMeta,
  VaguenessReport,
} from '../domain';
import {
  CONFIDENCE_LABEL,
  EVIDENCE_REACH_LABEL,
  EVIDENCE_TIER_LABEL,
  VAGUENESS_REASON_LABEL,
} from '../domain';
import { ReportPanel, ReportTabs, useReportTabs } from './report-chrome';
import { useLanguage } from '@/lib/i18n';
import { Avatar, Badge, Panel, ScoreRing, type BadgeVariant } from '@/shared/ui';

/**
 * Applicant Portrait — "Phân tích chân dung ứng viên", the first of the two
 * report pages.
 *
 * Six sections, tabbed, from the mockup: Core identity, Driving force,
 * Signature pattern, Emerging themes, Personal positioning, Proof of me. Which
 * of them appear is decided by the engine (`portraitSections`), not here — a
 * section with nothing in it is absent rather than empty, and the count of
 * what is waiting is shown so nothing vanishes silently.
 *
 * ─── THE MOCKUP'S ENTRY-REQUIREMENTS BLOCK IS NOT ON THIS PAGE ───────────────
 *
 * The design puts a "Nhập học yêu cầu" checklist — GPA, TOEFL, SAT/ACT,
 * difficulty — under the portrait, with a "find universities" button. Those are
 * facts about a *university*, and this report is deliberately course-agnostic:
 * it is the same portrait whichever course the student opens it from, and the
 * AI is told so ("this report is course-agnostic"). Putting one university's
 * requirements here would make a course-independent report look
 * course-specific, and the requirements already have a home on the Programme
 * Fit page where they belong. The CTA survives, pointing at that page.
 */

const CONFIDENCE_VARIANT: Record<Confidence, BadgeVariant> = {
  high: 'safe-chip',
  medium: 'info-chip',
  low: 'neutral-chip',
};

const TIER_VARIANT: Record<EvidenceItem['tier'], BadgeVariant> = {
  verified: 'safe-chip',
  attributable: 'info-chip',
  stated: 'neutral-chip',
};

export function ApplicantPortrait({
  applicationId,
  studentName,
  studentAvatarUrl,
  narrative,
  evidence,
  vagueness,
  sections,
  pendingSectionCount,
  confidence,
  generatedAt,
}: {
  applicationId: string;
  studentName: string;
  studentAvatarUrl: string | null;
  narrative: NarrativeProfile;
  evidence: EvidenceProfile;
  vagueness: VaguenessReport;
  sections: readonly PortraitSectionMeta[];
  pendingSectionCount: number;
  confidence: Confidence;
  generatedAt: string;
}) {
  const { t } = useLanguage();
  const tabs = sections.map((section) => ({ key: section.key, label: section.label }));
  const { active, setActive } = useReportTabs(tabs);
  const activeSection = sections.find((section) => section.key === active);

  return (
    <div className="flex flex-col gap-gb-3xl">
      <header className="flex flex-col gap-gb-2xl">
        <h1 className="font-display text-gb-display-sm font-semibold text-fg">
          {t('Applicant portrait analysis')}
        </h1>

        <div className="flex flex-wrap items-center justify-between gap-gb-xl">
          <div className="flex items-center gap-gb-lg">
            <Avatar name={studentName} src={studentAvatarUrl} size="lg" />
            <div className="flex flex-col">
              <p className="text-gb-md font-semibold text-fg">
                {t('Welcome back, {name}', { name: studentName })}
              </p>
              <p className="text-gb-sm text-fg-tertiary">{formatDate(generatedAt)}</p>
            </div>
          </div>

          <div className="flex items-center gap-gb-lg">
            <Badge variant={CONFIDENCE_VARIANT[confidence]}>
              {t(CONFIDENCE_LABEL[confidence])}
            </Badge>
            {narrative.overallRating != null ? (
              <ScoreRing
                value={narrative.overallRating}
                measure="match"
                label={t('Portrait strength')}
                size="sm"
              />
            ) : null}
          </div>
        </div>
      </header>

      {sections.length === 0 ? (
        <EmptyPortrait />
      ) : (
        <>
          <ReportTabs
            tabs={tabs}
            active={active}
            onSelect={setActive}
            label={t('Portrait sections')}
          />

          <ReportPanel tabKey={active}>
            {activeSection ? (
              <p className="text-gb-sm text-fg-tertiary">{t(activeSection.blurb)}</p>
            ) : null}

            {active === 'core-identity' ? (
              <CoreIdentity narrative={narrative} />
            ) : null}
            {active === 'driving-force' ? (
              <Prose heading={t('What drives you')} body={narrative.drivingForce} />
            ) : null}
            {active === 'signature-pattern' ? (
              <Chips
                heading={t('Only you can claim this combination')}
                items={narrative.signaturePattern}
              />
            ) : null}
            {active === 'emerging-themes' ? (
              <Chips
                heading={t('Patterns running through your record')}
                items={narrative.emergingThemes}
              />
            ) : null}
            {active === 'personal-positioning' ? (
              <Prose heading={t('How to present yourself')} body={narrative.personalPositioning} />
            ) : null}
            {active === 'proof-of-me' ? <ProofOfMe evidence={evidence} /> : null}
          </ReportPanel>
        </>
      )}

      {pendingSectionCount > 0 ? (
        <PendingSections count={pendingSectionCount} vagueness={vagueness} />
      ) : null}

      <div className="flex justify-center pt-gb-xl">
        <Link
          href={`/ai-strategy/${applicationId}/strategy/analysis/fit`}
          className="rounded-gb-md bg-brand px-gb-4xl py-gb-lg text-gb-sm font-semibold text-white transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {t('See how you match your course')}
        </Link>
      </div>
    </div>
  );
}

function CoreIdentity({ narrative }: { narrative: NarrativeProfile }) {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col gap-gb-2xl">
      {narrative.coreIdentity ? (
        <section className="flex flex-col gap-gb-md">
          <h2 className="text-gb-lg font-semibold text-fg">{t('Brief summary')}</h2>
          <p className="max-w-2xl text-gb-sm leading-relaxed text-fg-secondary">
            {narrative.coreIdentity}
          </p>
        </section>
      ) : null}

      {narrative.academicStrengths.length > 0 ? (
        <Chips heading={t('Academic strengths')} items={narrative.academicStrengths} />
      ) : null}

      {narrative.learningStyle.length > 0 ? (
        <Chips heading={t('How you learn')} items={narrative.learningStyle} />
      ) : null}

      {/* The design has no tab for growth areas and they are too useful to
          drop — they are the one honest counterweight to five sections of
          strengths. See domain/evaluation/reflection.ts. */}
      {narrative.growthAreas.length > 0 ? (
        <section className="flex flex-col gap-gb-md">
          <h2 className="text-gb-lg font-semibold text-fg">{t("Where you're still building")}</h2>
          <ul className="flex flex-col gap-gb-xs">
            {narrative.growthAreas.map((area) => (
              <li key={area} className="text-gb-sm text-fg-tertiary">
                {area}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Prose({ heading, body }: { heading: string; body: string | null }) {
  if (!body) return null;
  return (
    <section className="flex flex-col gap-gb-md">
      <h2 className="text-gb-lg font-semibold text-fg">{heading}</h2>
      <p className="max-w-2xl text-gb-sm leading-relaxed text-fg-secondary">{body}</p>
    </section>
  );
}

function Chips({ heading, items }: { heading: string; items: readonly string[] }) {
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col gap-gb-md">
      <h2 className="text-gb-lg font-semibold text-fg">{heading}</h2>
      <ul className="flex flex-wrap gap-gb-xs">
        {items.map((item) => (
          <li key={item}>
            <Badge variant="brand-subtle">{item}</Badge>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * F3 rendered — the evidence hierarchy, strongest first.
 *
 * Every row states its tier and its reach, because they fail differently and
 * the fix differs: "get the certificate" and "aim higher next time" are not the
 * same advice. `needsProof` is separated out below as the actionable list.
 */
function ProofOfMe({ evidence }: { evidence: EvidenceProfile }) {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col gap-gb-2xl">
      <div className="flex flex-wrap gap-gb-md">
        <Badge variant="safe-chip">
          {t('{n} verified', { n: evidence.counts.verified })}
        </Badge>
        <Badge variant="info-chip">
          {t('{n} checkable', { n: evidence.counts.attributable })}
        </Badge>
        <Badge variant="neutral-chip">
          {t('{n} self-reported', { n: evidence.counts.stated })}
        </Badge>
      </div>

      <ul className="flex flex-col gap-gb-md">
        {evidence.items.map((item) => (
          <li key={item.id}>
            <Panel padding="sm" elevation="flat" className="flex flex-wrap items-center gap-gb-lg">
              <div className="flex min-w-[12rem] flex-1 flex-col gap-gb-xxs">
                <p className="text-gb-sm font-semibold text-fg">{item.title}</p>
                <p className="text-gb-xs text-fg-tertiary">
                  {[item.organisation, item.competition, item.when]
                    .filter(Boolean)
                    .join(' · ') || t('No detail given')}
                </p>
              </div>
              <Badge variant={TIER_VARIANT[item.tier]}>{t(EVIDENCE_TIER_LABEL[item.tier])}</Badge>
              <Badge variant="neutral">{t(EVIDENCE_REACH_LABEL[item.reach])}</Badge>
            </Panel>
          </li>
        ))}
      </ul>

      {evidence.needsProof.length > 0 ? (
        <section className="flex flex-col gap-gb-md rounded-gb-xl border border-line bg-surface-muted p-gb-xl">
          <h3 className="text-gb-sm font-semibold text-fg">
            {t('Worth attaching proof for')}
          </h3>
          <p className="text-gb-xs text-fg-tertiary">
            {t(
              'A document moves each of these up a tier. Admissions readers weigh what they can check.',
            )}
          </p>
          <ul className="flex flex-col gap-gb-xs">
            {evidence.needsProof.map((item) => (
              <li key={item.id} className="text-gb-sm text-fg-secondary">
                {item.title}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/**
 * What is missing, and why — driven by F6 rather than a generic prompt, so the
 * student is told which of their own answers is holding the report back.
 */
function PendingSections({
  count,
  vagueness,
}: {
  count: number;
  vagueness: VaguenessReport;
}) {
  const { t } = useLanguage();
  const blocking = vagueness.findings.filter((finding) => finding.severity !== 'ok');

  return (
    <Panel className="flex flex-col gap-gb-lg">
      <h2 className="text-gb-md font-semibold text-fg">
        {t('{n} more sections unlock as you add detail', { n: count })}
      </h2>

      {blocking.length > 0 ? (
        <ul className="flex flex-col gap-gb-md">
          {blocking.map((finding) => (
            <li key={finding.field} className="flex flex-col gap-gb-xxs">
              <p className="text-gb-sm font-medium text-fg">{t(finding.label)}</p>
              <p className="text-gb-xs text-fg-tertiary">
                {finding.reasons.map((reason) => t(VAGUENESS_REASON_LABEL[reason])).join(' · ')}
              </p>
            </li>
          ))}
        </ul>
      ) : null}

      <Link
        href="/ai-strategy/reflection"
        className="self-start text-gb-sm font-semibold text-fg-brand hover:underline"
      >
        {t('Update your reflections')}
      </Link>
    </Panel>
  );
}

function EmptyPortrait() {
  const { t } = useLanguage();
  return (
    <Panel className="flex flex-col gap-gb-md">
      <h2 className="text-gb-md font-semibold text-fg">{t('Your portrait is not ready yet')}</h2>
      <p className="text-gb-sm text-fg-tertiary">
        {t(
          'Add your personal summary and achievements, and this page fills in with what we can evidence.',
        )}
      </p>
      <Link
        href="/ai-strategy/reflection"
        className="self-start text-gb-sm font-semibold text-fg-brand hover:underline"
      >
        {t('Start your reflections')}
      </Link>
    </Panel>
  );
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}
