'use client';

import Link from 'next/link';
import { Badge, Container, Panel } from '@/shared/ui';
import { useT } from '@/lib/i18n';
import {
  programmeVerificationConfidence,
  type RecommendationReason,
  type MatchWarning,
  type RecommendationResponse,
  type RecommendationResult,
} from '../domain';

const REASON_COPY: Record<RecommendationReason['code'], string> = {
  PROGRAMME_FOUND: 'A relevant programme was found in the catalogue',
  SUBJECT_MATCH: 'The programme matches your subject preference',
  DESTINATION_MATCH: 'The country matches your destination preference',
  STUDY_LEVEL_MATCH: 'The study level matches your preference',
  BUDGET_COMPATIBLE: 'Published tuition fits within your maximum annual budget',
  CAMPUS_MATCH: 'The campus information matches your preference',
  SUBJECT_SIGNAL_FOUND: 'The university information contains a relevant subject signal',
};

const WARNING_COPY: Record<MatchWarning['code'], string> = {
  PROGRAMME_NOT_VERIFIED: 'Programme availability needs verification',
  PROGRAMME_DATA_MISSING: 'Programme information for this subject is not available',
  NO_MATCHING_PROGRAMME_FOUND: 'No matching programme was found in the current catalogue',
  TUITION_DATA_MISSING: 'Tuition information is missing',
  COST_NEEDS_VERIFICATION: 'Tuition currency or annual period needs verification',
  SCHOLARSHIP_DEPENDENT_BUDGET: 'Your budget depends on scholarships, so affordability needs verification',
  STUDY_LEVEL_NOT_CONFIRMED: 'The programme study level should be confirmed',
  MATCHING_STUDY_LEVEL_NOT_FOUND: 'No programme matching both your subject and study level was found in the current catalogue',
  CONFLICTING_DATA: 'Some published data conflicts and needs checking',
  STALE_SOURCE: 'The programme source may be out of date',
  SOURCE_FRESHNESS_UNKNOWN: 'The programme source date is unavailable',
};

function programmeVerificationLabel(status: string | null, t: ReturnType<typeof useT>): string {
  switch (programmeVerificationConfidence(status)) {
    case 'trusted':
      return t('Verified programme');
    case 'review':
      return t('Programme review pending');
    case 'unknown':
      return t('Programme verification unavailable');
  }
}

function programmeVerificationVariant(status: string | null): 'brand-subtle' | 'neutral' {
  return programmeVerificationConfidence(status) === 'trusted' ? 'brand-subtle' : 'neutral';
}

function reasonText(reason: RecommendationReason, t: ReturnType<typeof useT>): string {
  if (reason.code === 'PROGRAMME_FOUND' && reason.value) return `${t(REASON_COPY[reason.code])}: ${reason.value}`;
  if (reason.code === 'SUBJECT_MATCH' && reason.value) return `${t(REASON_COPY[reason.code])}: ${reason.value}`;
  return t(REASON_COPY[reason.code]);
}

function warningText(warning: MatchWarning, t: ReturnType<typeof useT>): string {
  if (warning.code === 'PROGRAMME_NOT_VERIFIED' && warning.value) return `${t(WARNING_COPY[warning.code])}: ${warning.value}`;
  return t(WARNING_COPY[warning.code]);
}

function dataQualityLabel(quality: RecommendationResult['dataQuality'], t: ReturnType<typeof useT>): string {
  if (quality === 'high') return t('More complete data');
  if (quality === 'medium') return t('Some data available');
  return t('More data needed');
}

export function UniversityMatchResults({
  recommendation,
  demo = false,
}: {
  recommendation: RecommendationResponse;
  demo?: boolean;
}) {
  const t = useT();

  return (
    <Container className="flex flex-col gap-gb-4xl py-gb-6xl">
      <div className="flex flex-col gap-gb-lg">
        <Link href="/universities" className="text-gb-sm font-medium text-fg-brand hover:underline">{t('Back to university search')}</Link>
        {demo ? <Badge variant="brand-subtle">{t('Deterministic demo · fixed fixture data')}</Badge> : null}
        <h1 className="font-display text-gb-display-xs font-semibold text-fg md:text-gb-display-sm">{t('Recommended for you')}</h1>
        <p className="max-w-gb-width-xl text-gb-md text-fg-tertiary">
          {demo
            ? t('This public demo uses fixed profile, university and programme data to show deterministic recommendations.')
            : t('These recommendations use your preferences and the university and programme data currently available.')}
        </p>
      </div>

      {recommendation.status === 'incomplete_profile' ? <IncompleteProfileState t={t} /> : null}
      {recommendation.status === 'error' ? <ErrorState t={t} /> : null}
      {recommendation.status === 'empty' ? <EmptyState t={t} /> : null}
      {recommendation.status === 'success' ? (
        <section aria-labelledby="university-recommendations-heading" className="flex flex-col gap-gb-2xl">
          <div className="flex flex-col gap-gb-xs">
            <h2 id="university-recommendations-heading" className="text-gb-xl font-semibold text-fg">{t('Universities worth exploring')}</h2>
            <p className="text-gb-sm text-fg-tertiary">
              {t('Each result is explained with positive reasons and separate data warnings. These are not admission predictions.')}
            </p>
          </div>
          <ol className="grid gap-gb-2xl lg:grid-cols-2">
            {recommendation.results.map((result) => <UniversityRecommendationCard key={result.universityId} result={result} t={t} />)}
          </ol>
          <p className="max-w-gb-width-xl text-gb-sm text-fg-muted">
            {t("These recommendations are based on your preferences and currently available university data. They are not predictions of admission outcomes. Always verify programme requirements, tuition, and deadlines on the university's official website.")}
          </p>
        </section>
      ) : null}
    </Container>
  );
}

function IncompleteProfileState({ t }: { t: ReturnType<typeof useT> }) {
  return (
    <Panel className="flex flex-col gap-gb-md">
      <h2 className="text-gb-lg font-semibold text-fg">{t('Tell us what you want to study')}</h2>
      <p className="text-gb-md text-fg-tertiary">{t('Add a subject, destination, study level, budget, or campus preference to get recommendations based on your profile.')}</p>
      <Link href="/profile/preferences" className="text-gb-sm font-medium text-fg-brand hover:underline">{t('Update preferences')}</Link>
    </Panel>
  );
}

function EmptyState({ t }: { t: ReturnType<typeof useT> }) {
  return (
    <Panel className="flex flex-col gap-gb-md">
      <h2 className="text-gb-lg font-semibold text-fg">{t('No universities to show yet')}</h2>
      <p className="text-gb-md text-fg-tertiary">{t('We could not find university data to compare with the preferences in your profile. Try updating them or explore the full directory.')}</p>
      <Link href="/universities" className="text-gb-sm font-medium text-fg-brand hover:underline">{t('Explore universities')}</Link>
    </Panel>
  );
}

function ErrorState({ t }: { t: ReturnType<typeof useT> }) {
  return (
    <Panel className="flex flex-col gap-gb-md">
      <h2 className="text-gb-lg font-semibold text-fg">{t('Recommendations are temporarily unavailable')}</h2>
      <p className="text-gb-md text-fg-tertiary">{t('There was a problem loading university data. Please try again later or continue with the university directory.')}</p>
      <Link href="/universities" className="text-gb-sm font-medium text-fg-brand hover:underline">{t('Open university directory')}</Link>
    </Panel>
  );
}

function UniversityRecommendationCard({ result, t }: { result: RecommendationResult; t: ReturnType<typeof useT> }) {
  return (
    <Panel as="li" className="flex flex-col gap-gb-2xl">
      <div className="flex flex-wrap items-start justify-between gap-gb-lg">
        <div className="flex min-w-0 flex-col gap-gb-xs">
          <h3 className="text-gb-lg font-semibold text-fg">
            <Link href={`/universities/${result.universityId}`} className="hover:text-fg-brand hover:underline">
              {result.universityName}
            </Link>
          </h3>
          <p className="text-gb-sm text-fg-tertiary">{result.country ?? t('Country not available')}</p>
        </div>
        <Badge variant={result.dataQuality === 'high' ? 'brand-subtle' : 'neutral'}>{dataQualityLabel(result.dataQuality, t)}</Badge>
      </div>

      {result.reasons.length > 0 ? <ReasonList heading={t('Why this university appears')} entries={result.reasons.map((reason) => reasonText(reason, t))} /> : null}
      {result.warnings.length > 0 ? <ReasonList heading={t('Things to check')} entries={result.warnings.map((warning) => warningText(warning, t))} muted /> : null}

      {result.programmeMatches.length > 0 ? (
        <div className="flex flex-col gap-gb-xs">
          <h4 className="text-gb-sm font-semibold text-fg">{t('Related programmes')}</h4>
          <ul className="space-y-gb-xxs text-gb-sm text-fg-secondary">
            {result.programmeMatches.map((programme) => (
              <li key={programme.programmeId} className="flex flex-wrap items-center gap-gb-xs">
                <span>
                  {programme.officialUrl ? (
                    <a href={programme.officialUrl} target="_blank" rel="noreferrer" className="hover:text-fg-brand hover:underline">
                      {programme.programmeName}
                    </a>
                  ) : programme.programmeName}
                  {programme.degreeLevel ? ` · ${programme.degreeLevel}` : ''}
                </span>
                <Badge variant={programmeVerificationVariant(programme.verificationStatus)}>
                  {programmeVerificationLabel(programme.verificationStatus, t)}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Link href={`/universities/${result.universityId}`} className="text-gb-sm font-medium text-fg-brand hover:underline">
        {t('View university details')}
      </Link>
    </Panel>
  );
}

function ReasonList({ heading, entries, muted = false }: { heading: string; entries: string[]; muted?: boolean }) {
  return (
    <div className="flex flex-col gap-gb-xs">
      <h4 className="text-gb-sm font-semibold text-fg">{heading}</h4>
      <ul className={`list-disc space-y-gb-xxs pl-gb-2xl text-gb-sm ${muted ? 'text-fg-muted' : 'text-fg-secondary'}`}>
        {entries.slice(0, 4).map((entry) => <li key={entry}>{entry}</li>)}
      </ul>
    </div>
  );
}
