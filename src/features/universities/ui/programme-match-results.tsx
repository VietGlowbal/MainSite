import Link from 'next/link';
import { Badge, Container, Panel } from '@/shared/ui';
import type { AdmissionTierV1, RankedProgrammeMatch } from '../domain/matching';

function tierLabel(tier: AdmissionTierV1 | null, status: RankedProgrammeMatch['admission']['assessmentStatus']): string {
  if (tier === 'strong_chance') return 'Strong Chance';
  if (tier === 'target') return 'Target';
  if (tier === 'reach') return 'Reach';
  return status === 'partial' ? 'Partial assessment' : 'Insufficient admission data';
}

function tierVariant(tier: AdmissionTierV1 | null): 'safe' | 'recommend' | 'reach' | 'neutral' {
  if (tier === 'strong_chance') return 'safe';
  if (tier === 'target') return 'recommend';
  if (tier === 'reach') return 'reach';
  return 'neutral';
}

function percentage(value: number | null): string {
  return value === null ? 'Unavailable' : `${Math.round(value)}%`;
}

export function ProgrammeMatchResults({ matches, demo = false }: { matches: RankedProgrammeMatch[]; demo?: boolean }) {
  const recommendable = matches.filter((match) => match.eligibility.status !== 'not_eligible');
  const ineligible = matches.filter((match) => match.eligibility.status === 'not_eligible');
  return (
    <Container className="flex flex-col gap-gb-4xl py-gb-6xl">
      <div className="flex flex-col gap-gb-lg">
        <Link href="/universities" className="text-gb-sm font-medium text-fg-brand hover:underline">Back to university search</Link>
        {demo ? <Badge variant="brand-subtle">Deterministic demo · fixed fixture data</Badge> : null}
        <h1 className="font-display text-gb-display-xs font-semibold text-fg md:text-gb-display-sm">Your programme matches</h1>
        <p className="max-w-gb-width-xl text-gb-md text-fg-tertiary">{demo ? 'This public demo uses a fixed student profile and catalogue fixture to show deterministic scoring, verified evidence, known gaps and unknown evidence states.' : 'Programme recommendations use your onboarding profile and the evidence available today. Admission realism is not an admission probability.'}</p>
      </div>

      {recommendable.length === 0 ? (
        <Panel className="flex flex-col gap-gb-md">
          <h2 className="text-gb-lg font-semibold text-fg">No catalogue matches yet</h2>
          <p className="text-gb-md text-fg-tertiary">Add your target subject and destination preferences in your profile, then return here.</p>
          <Link href="/profile/preferences" className="text-gb-sm font-medium text-fg-brand hover:underline">Update preferences</Link>
        </Panel>
      ) : (
        <section aria-labelledby="recommendations-heading" className="flex flex-col gap-gb-2xl">
          <div className="flex flex-col gap-gb-xs">
            <h2 id="recommendations-heading" className="text-gb-xl font-semibold text-fg">Recommended programmes</h2>
            <p className="text-gb-sm text-fg-tertiary">Eligible programmes appear first, followed by programmes whose eligibility needs more evidence.</p>
          </div>
          <ol className="grid gap-gb-2xl lg:grid-cols-2">
            {recommendable.map((match) => <MatchCard key={match.programmeId} match={match} />)}
          </ol>
        </section>
      )}

      {ineligible.length > 0 ? (
        <section aria-labelledby="ineligible-heading" className="flex flex-col gap-gb-2xl">
          <div className="flex flex-col gap-gb-xs">
            <h2 id="ineligible-heading" className="text-gb-xl font-semibold text-fg">Known eligibility gaps</h2>
            <p className="text-gb-sm text-fg-tertiary">These are separated from normal recommendations because available verified evidence shows a mandatory requirement is not met.</p>
          </div>
          <ol className="grid gap-gb-2xl lg:grid-cols-2">
            {ineligible.map((match) => <MatchCard key={match.programmeId} match={match} />)}
          </ol>
        </section>
      ) : null}
    </Container>
  );
}

function MatchCard({ match }: { match: RankedProgrammeMatch }) {
  const tier = tierLabel(match.admission.tier, match.admission.assessmentStatus);
  return (
    <Panel as="li" className="flex flex-col gap-gb-2xl">
      <div className="flex flex-wrap items-start justify-between gap-gb-lg">
        <div className="flex min-w-0 flex-col gap-gb-xs">
          <h3 className="text-gb-lg font-semibold text-fg">{match.programmeName}</h3>
          <p className="text-gb-sm text-fg-tertiary">{[match.degreeLevel, match.country].filter(Boolean).join(' · ') || 'Programme details need verification'}</p>
        </div>
        <Badge variant={tierVariant(match.admission.tier)}>{tier}</Badge>
      </div>
      <dl className="grid grid-cols-2 gap-gb-lg text-gb-sm">
        <Metric label="Eligibility" value={match.eligibility.status === 'eligible' ? 'Eligible' : match.eligibility.status === 'not_eligible' ? 'Not eligible' : 'Needs verification'} />
        <Metric label="Preference match" value={percentage(match.preference.score)} />
        <Metric label="Admission realism" value={percentage(match.admission.score)} />
        <Metric label="Evidence coverage" value={`${Math.round(match.admission.coverage * 100)}%`} />
      </dl>
      {match.whyMatch.length > 0 ? <ReasonList heading="Why you match" entries={match.whyMatch} /> : null}
      {match.admissionStrengths.length > 0 ? <ReasonList heading="Admission strengths" entries={match.admissionStrengths} /> : null}
      {match.watchOuts.length > 0 ? <ReasonList heading="Watch out for" entries={match.watchOuts} /> : null}
      {match.missingEvidence.length > 0 ? <ReasonList heading="Missing evidence" entries={[...new Set(match.missingEvidence)].slice(0, 3)} muted /> : null}
    </Panel>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="flex flex-col gap-gb-xxs"><dt className="text-fg-tertiary">{label}</dt><dd className="font-semibold text-fg">{value}</dd></div>;
}

function ReasonList({ heading, entries, muted = false }: { heading: string; entries: string[]; muted?: boolean | undefined }) {
  return <div className="flex flex-col gap-gb-xs"><h4 className="text-gb-sm font-semibold text-fg">{heading}</h4><ul className={`list-disc space-y-gb-xxs pl-gb-2xl text-gb-sm ${muted ? 'text-fg-muted' : 'text-fg-secondary'}`}>{entries.slice(0, 3).map((entry) => <li key={entry}>{entry}</li>)}</ul></div>;
}
