'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  EDUCATION_LEVEL_META,
  destinationFlag,
  destinationLabel,
  formatBudgetRange,
  fundingSourceLabel,
  isCompleteBudget,
  reflectionStep,
  subjectById,
  type CandidateReadiness,
  type FundingSourceId,
  type ReflectionValues,
} from '@/features/apply/domain';
import type { EvidenceDocument } from '@/features/apply/hooks';
import { localizeIntakeCopy, ReflectionShell } from '@/features/apply/ui';
import { useT } from '@/lib/i18n';
import { Button, Checkbox, Modal, Panel, PanelHeader } from '@/shared/ui';

/**
 * Review & Confirm — the checkpoint the spec calls "the student is not
 * simply clicking Finish, they are approving the exact version of themselves
 * GlowBal will analyse."
 *
 * ─── EDIT LINKS GO TO THE STEP, NOT A QUESTION ───────────────────────────────
 *
 * Deep-linking straight to the one field that needs fixing was explicitly
 * descoped (owner decision): every Edit action here routes to the step-1 or
 * step-2 form, carrying the same `return` this page itself was opened with.
 * That is not a dead end — `Next`/`Finish` on those forms already funnel back
 * through onboarding routing, and the analysis gate now refuses to run past a
 * student who has not confirmed, so an edit always lands back here before it
 * can reach report generation.
 */

function editHref(step: 'about' | 'evidence', returnTo: string | undefined) {
  const path = reflectionStep(step).path;
  return returnTo ? `${path}?return=${encodeURIComponent(returnTo)}` : path;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="flex flex-col gap-gb-xxs">
      <p className="text-gb-xs text-fg-tertiary">{label}</p>
      <p className="text-gb-sm text-fg">{value}</p>
    </div>
  );
}

function ReviewSection({
  title,
  editLabel,
  editHref: href,
  children,
}: {
  title: string;
  editLabel: string;
  editHref: string;
  children: React.ReactNode;
}) {
  return (
    <Panel as="section" className="flex flex-col gap-gb-xl">
      <PanelHeader
        title={title}
        action={
          <Button href={href} variant="secondary" size="sm">
            {editLabel}
          </Button>
        }
      />
      <div className="grid gap-gb-lg sm:grid-cols-2">{children}</div>
    </Panel>
  );
}

export function ReviewConfirmView({
  reflection,
  documents,
  readiness,
  returnTo,
  applicationId,
}: {
  reflection: ReflectionValues;
  documents: EvidenceDocument[];
  readiness: CandidateReadiness;
  returnTo?: string | undefined;
  applicationId?: string | undefined;
}) {
  const t = useT();
  const router = useRouter();
  const [acknowledged, setAcknowledged] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const aboutHref = editHref('about', returnTo);
  const evidenceHref = editHref('evidence', returnTo);

  const educationLabel =
    reflection.highestEducation === 'Other'
      ? reflection.otherEducation
      : reflection.highestEducation
        ? `${t(reflection.highestEducation)} (${t(EDUCATION_LEVEL_META[reflection.highestEducation].hint)})`
        : undefined;

  const subjectLabels = reflection.majors.map((id) => t(subjectById(id)?.label ?? id));
  const countryLabels = reflection.countries.map(
    (id) => `${destinationFlag(id)} ${destinationLabel(id)}`,
  );

  const primarySubject = reflection.primaryMotivationSubject;
  const motivationEntries = Object.entries(reflection.subjectMotivations ?? {});
  const primaryMotivation =
    (primarySubject && reflection.subjectMotivations?.[primarySubject]) ?? reflection.studyMotivation;
  const moreMotivations = motivationEntries.length > 1 ? motivationEntries.length - 1 : 0;

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/candidate-information/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(applicationId ? { applicationId } : {}),
      });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        setError(body?.message ?? t('We could not confirm your information. Please try again.'));
        setSubmitting(false);
        setModalOpen(false);
        return;
      }

      router.push(returnTo || '/ai-strategy/report');
    } catch {
      setError(t('We could not confirm your information. Please try again.'));
      setSubmitting(false);
      setModalOpen(false);
    }
  }

  return (
    <ReflectionShell step="evidence" caption={t('Review & Confirm')}>
      <div className="flex flex-col gap-gb-2xl">
        <div className="flex flex-col gap-gb-xs">
          <h1 className="font-display text-gb-display-sm font-semibold tracking-gb-display-tight text-fg">
            {t('Review & Confirm')}
          </h1>
          <p className="text-gb-sm text-fg-tertiary">
            {t(
              'Check everything below carefully — once confirmed, this information is locked and used to generate your reports.',
            )}
          </p>
        </div>

        {readiness.ready ? (
          <div className="rounded-gb-xl border border-tier-safe bg-tier-safe/10 px-gb-xl py-gb-lg">
            <p className="flex items-center gap-gb-sm text-gb-sm font-semibold text-on-tier-safe">
              <span aria-hidden="true">✓</span> {t('You’re ready to confirm')}
            </p>
            <p className="mt-gb-xxs text-gb-sm text-fg-secondary">
              {t('Every required question has been answered and reviewed.')}
            </p>
          </div>
        ) : (
          <div className="rounded-gb-xl border border-line-error bg-surface-error px-gb-xl py-gb-lg">
            <p className="text-gb-sm font-semibold text-fg-error">
              {t('A few things need your attention before you can confirm')}
            </p>
            <ul className="mt-gb-md flex flex-col gap-gb-sm">
              {readiness.blockingIssues.map((issue) => (
                <li key={issue.key} className="flex flex-wrap items-center justify-between gap-gb-md">
                  <span className="text-gb-sm text-fg-secondary">{t(issue.message)}</span>
                  <Button href={aboutHref} variant="secondary" size="sm">
                    {t('Fix this')}
                  </Button>
                </li>
              ))}
              {readiness.achievementsNeedingReview > 0 ? (
                <li className="flex flex-wrap items-center justify-between gap-gb-md">
                  <span className="text-gb-sm text-fg-secondary">
                    {t('{count} extracted achievements still need review.', {
                      count: readiness.achievementsNeedingReview,
                    })}
                  </span>
                  <Button href={evidenceHref} variant="secondary" size="sm">
                    {t('Review')}
                  </Button>
                </li>
              ) : null}
              {readiness.activitiesNeedingReview > 0 ? (
                <li className="flex flex-wrap items-center justify-between gap-gb-md">
                  <span className="text-gb-sm text-fg-secondary">
                    {t('{count} extracted activities still need review.', {
                      count: readiness.activitiesNeedingReview,
                    })}
                  </span>
                  <Button href={evidenceHref} variant="secondary" size="sm">
                    {t('Review')}
                  </Button>
                </li>
              ) : null}
            </ul>
          </div>
        )}

        <ReviewSection title={t('Personal information')} editLabel={t('Edit')} editHref={aboutHref}>
          <Field label={t('Highest level of education')} value={educationLabel} />
          <Field label={t('Nationality')} value={reflection.nationality} />
        </ReviewSection>

        <ReviewSection title={t('Academic profile')} editLabel={t('Edit')} editHref={aboutHref}>
          <Field label={t('GPA / equivalent')} value={reflection.gpa} />
          <Field label={t('IELTS / English test')} value={reflection.ielts} />
          <Field label={t('SAT / other test scores')} value={reflection.englishTestScore} />
        </ReviewSection>

        <ReviewSection title={t('Study preferences')} editLabel={t('Edit')} editHref={aboutHref}>
          <Field
            label={t('Subjects')}
            value={subjectLabels.length > 0 ? subjectLabels.join(', ') : undefined}
          />
          <Field
            label={t('Countries')}
            value={
              countryLabels.length > 0
                ? countryLabels.join(', ')
                : reflection.countryPreferenceFlexible
                  ? t('Open to suggestions')
                  : undefined
            }
          />
          <Field
            label={t('Study level')}
            value={reflection.intendedLevel ? t(reflection.intendedLevel) : undefined}
          />
          <Field
            label={t('Preferred intake')}
            value={reflection.intake ? localizeIntakeCopy(reflection.intake, t).label : undefined}
          />
        </ReviewSection>

        <ReviewSection title={t('Aspirations')} editLabel={t('Edit')} editHref={aboutHref}>
          <Field label={t('After graduation')} value={reflection.careerGoal} />
          {primaryMotivation ? (
            <Field
              label={
                primarySubject
                  ? t('Why {subject}', { subject: t(subjectById(primarySubject)?.label ?? primarySubject) })
                  : t('Subject motivation')
              }
              value={primaryMotivation}
            />
          ) : null}
          {moreMotivations > 0 ? (
            <p className="text-gb-xs text-fg-tertiary sm:col-span-2">
              {t('{count} more subject motivations on file.', { count: moreMotivations })}
            </p>
          ) : null}
        </ReviewSection>

        <ReviewSection title={t('Financial plan')} editLabel={t('Edit')} editHref={aboutHref}>
          <Field
            label={t('Funding')}
            value={
              reflection.fundingSource
                ? t(fundingSourceLabel(reflection.fundingSource as FundingSourceId))
                : undefined
            }
          />
          <Field
            label={t('Annual tuition budget')}
            value={
              isCompleteBudget(reflection.tuitionBudget)
                ? formatBudgetRange(reflection.tuitionBudget)
                : undefined
            }
          />
        </ReviewSection>

        <ReviewSection
          title={t('Achievements & activities')}
          editLabel={t('Edit')}
          editHref={evidenceHref}
        >
          <Field
            label={t('Academic achievements')}
            value={t('{count} on file', { count: reflection.achievements.length })}
          />
          <Field
            label={t('Extracurricular activities')}
            value={t('{count} on file', { count: reflection.activities.length })}
          />
        </ReviewSection>

        <ReviewSection
          title={t('Supporting documents')}
          editLabel={t('Edit')}
          editHref={evidenceHref}
        >
          {documents.length === 0 ? (
            <p className="text-gb-sm text-fg-tertiary sm:col-span-2">{t('No documents were uploaded.')}</p>
          ) : (
            <p className="text-gb-sm text-fg sm:col-span-2">
              {documents.map((document) => document.fileName).join(', ')}
            </p>
          )}
        </ReviewSection>

        <Panel className="flex flex-col gap-gb-xl">
          <Checkbox
            name="acknowledge-confirmation"
            label={t('I confirm that the information above is accurate.')}
            description={t(
              'Once confirmed, this information is locked and cannot be edited without contacting GlowBal Support.',
            )}
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            disabled={!readiness.ready}
          />

          {error ? <p className="text-gb-sm text-fg-error">{error}</p> : null}

          <div className="flex justify-end">
            <Button
              size="lg"
              disabled={!readiness.ready || !acknowledged}
              onClick={() => setModalOpen(true)}
            >
              {t('Confirm & Generate Reports')}
            </Button>
          </div>
        </Panel>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => (submitting ? undefined : setModalOpen(false))}
        label={t('Confirm your information')}
      >
        <div className="flex flex-col gap-gb-xl">
          <h2 className="text-gb-lg font-semibold text-fg">{t('Confirm your information?')}</h2>
          <p className="text-gb-sm text-fg-secondary">
            {t(
              'This locks your candidate information exactly as shown and begins generating your reports. You will not be able to edit it afterwards without contacting GlowBal Support.',
            )}
          </p>
          <div className="flex justify-end gap-gb-md">
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={submitting}>
              {t('Cancel')}
            </Button>
            <Button onClick={() => void handleConfirm()} disabled={submitting}>
              {submitting ? t('Confirming…') : t('Confirm & Generate Reports')}
            </Button>
          </div>
        </div>
      </Modal>
    </ReflectionShell>
  );
}
