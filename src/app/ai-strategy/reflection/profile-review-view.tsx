'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { ProfileReviewData } from '@/features/apply/api';
import {
  destinationFlag,
  destinationLabel,
  destinationIdsFromStored,
  studyLevelLabel,
  subjectById,
  type StudyLevel,
} from '@/features/apply/domain';
import { useT } from '@/lib/i18n';
import { Button, Panel, PanelHeader } from '@/shared/ui';
import { ReflectionBreadcrumb } from '@/features/apply/ui';

/**
 * Step 1 — "Before we start, check your information."
 *
 * Replaces the old twelve-question "about" wizard. Every value here already
 * has a canonical column GlowBal collected during onboarding or on
 * `/profile/*` — this page never asks the student to re-type any of it, only
 * to confirm it is still right. Edit actions link out to the existing
 * `/profile/*` editor that owns each fact (never a second copy of the same
 * form), carrying `?return=` back to this exact page so "Save" returns the
 * student to where they left off.
 */

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="flex flex-col gap-gb-xxs">
      <p className="text-gb-xs text-fg-tertiary">{label}</p>
      <p className="text-gb-sm text-fg">{value}</p>
    </div>
  );
}

function Section({
  title,
  editHref,
  editLabel,
  children,
}: {
  title: string;
  editHref: string;
  editLabel: string;
  children: React.ReactNode;
}) {
  return (
    <Panel as="section" className="flex flex-col gap-gb-xl">
      <PanelHeader
        title={title}
        action={
          <Button href={editHref} variant="secondary" size="sm">
            {editLabel}
          </Button>
        }
      />
      <div className="grid gap-gb-lg sm:grid-cols-2">{children}</div>
    </Panel>
  );
}

function withReturn(path: string, returnTo: string): string {
  return `${path}?return=${encodeURIComponent(returnTo)}`;
}

function studyLevelDisplay(level: StudyLevel | null, t: (s: string) => string): string | undefined {
  return level ? t(studyLevelLabel(level)) : undefined;
}

export function ProfileReviewView({
  data,
  applicationId,
  returnTo,
  applicationLabel,
}: {
  data: ProfileReviewData;
  applicationId?: string | undefined;
  returnTo?: string | undefined;
  /** e.g. "Cambridge · Computer Science" — drives the in-page breadcrumb. */
  applicationLabel?: string | undefined;
}) {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // "✓ {section} updated" — set when this page is reached right after
  // saving a profile editor opened from here (see `withReturn` callers on
  // `/profile/*`, which append `?updated=`). Cleared from the URL once read
  // so refreshing the page does not keep showing a stale confirmation.
  const [justUpdated, setJustUpdated] = useState(searchParams.get('updated'));
  useEffect(() => {
    if (!searchParams.get('updated')) return;
    const params = new URLSearchParams(searchParams);
    params.delete('updated');
    const query = params.toString();
    router.replace(query ? `/ai-strategy/reflection?${query}` : '/ai-strategy/reflection', { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selfHref = '/ai-strategy/reflection';
  const backHere = returnTo ? withReturn(selfHref, returnTo) : selfHref;

  const subjectLabels = data.targetSubjects.map((id) => t(subjectById(id)?.label ?? id));
  const countryIds = destinationIdsFromStored(data.preferredCountries);
  const countryLabels = countryIds.map((id) => `${destinationFlag(id)} ${destinationLabel(id)}`);

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/reflection', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileReviewed: true,
          ...(applicationId ? { applicationId } : {}),
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.message ?? t('We could not save that. Please try again.'));
        setSubmitting(false);
        return;
      }
      const nextPath = returnTo
        ? withReturn('/ai-strategy/reflection/achievements', returnTo)
        : '/ai-strategy/reflection/achievements';
      router.push(nextPath);
    } catch {
      setError(t('We could not save that. Please try again.'));
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-gb-2xl">
      {applicationLabel ? (
        <ReflectionBreadcrumb
          items={[{ label: applicationLabel }, { label: t('Profile') }]}
        />
      ) : null}

      <div className="flex flex-col gap-gb-xs">
        <h1 className="font-display text-gb-display-sm font-semibold tracking-gb-display-tight text-fg">
          {t('Before we start, check your information')}
        </h1>
        <p className="text-gb-sm text-fg-tertiary">
          {t(
            'We’ve brought across the information you’ve already given GlowBal. Check that everything is still correct before we analyse this application.',
          )}
        </p>
      </div>

      {justUpdated ? (
        <div className="flex items-center gap-gb-sm rounded-gb-lg border border-tier-safe bg-tier-safe/10 px-gb-lg py-gb-md text-gb-sm font-medium text-on-tier-safe">
          <span aria-hidden="true">✓</span>
          {t('{section} updated', { section: justUpdated })}
          <button
            type="button"
            onClick={() => setJustUpdated(null)}
            className="ml-auto text-fg-tertiary hover:text-fg-secondary"
            aria-label={t('Dismiss')}
          >
            ×
          </button>
        </div>
      ) : null}

      <Section
        title={t('Study plans')}
        editHref={withReturn('/profile/preferences', backHere)}
        editLabel={t('Edit')}
      >
        <Fact label={t('Intended study level')} value={studyLevelDisplay(data.studyLevel, t)} />
        <Fact
          label={t('Subject interests')}
          value={subjectLabels.length > 0 ? subjectLabels.join(', ') : undefined}
        />
        <Fact
          label={t('Preferred destinations')}
          value={
            countryLabels.length > 0
              ? countryLabels.join(', ')
              : data.countryPreferenceFlexible
                ? t('Open to suggestions')
                : undefined
          }
        />
        <Fact label={t('Target intake')} value={data.targetIntake} />
      </Section>

      <Section
        title={t('Academic information')}
        editHref={withReturn('/profile/academic', backHere)}
        editLabel={t('Edit')}
      >
        {data.curriculumGrades.length > 0 ? (
          data.curriculumGrades.map((row) => (
            <Fact key={row.curriculum} label={row.curriculum} value={row.grade || undefined} />
          ))
        ) : (
          <p className="text-gb-sm text-fg-tertiary sm:col-span-2">
            {t('No curriculum or grades on file yet.')}
          </p>
        )}
        {data.gpaValue != null ? (
          <Fact
            label={t('Comparable GPA')}
            value={`${data.gpaValue}${data.gpaScale ? ` (${data.gpaScale})` : ''}`}
          />
        ) : null}
      </Section>

      <Section
        title={t('Test scores')}
        editHref={withReturn('/profile/english', backHere)}
        editLabel={t('Edit')}
      >
        {data.englishTests.length === 0 && data.standardizedTests.length === 0 ? (
          <p className="text-gb-sm text-fg-tertiary sm:col-span-2">
            {t('No test scores on file yet.')}
          </p>
        ) : (
          <>
            {data.englishTests.map((test) => (
              <Fact
                key={test.id}
                label={test.testType}
                value={test.overallScore != null ? String(test.overallScore) : undefined}
              />
            ))}
            {data.standardizedTests.map((test) => (
              <Fact key={test.id} label={test.testType} value={test.score ?? undefined} />
            ))}
          </>
        )}
      </Section>

      <Section
        title={t('Practical information')}
        editHref={withReturn('/profile/preferences', backHere)}
        editLabel={t('Edit')}
      >
        <Fact label={t('Annual tuition budget')} value={data.budgetRange} />
        <Fact label={t('Funding source')} value={data.fundingSource} />
        <Fact label={t('Study preferences')} value={data.campusPreferences} />
      </Section>

      {error ? <p className="text-gb-sm text-fg-error">{error}</p> : null}

      <div className="flex justify-end">
        <Button size="lg" disabled={submitting} onClick={() => void handleConfirm()}>
          {submitting ? t('Saving…') : t('Yes, this information is correct')}
        </Button>
      </div>
    </div>
  );
}
