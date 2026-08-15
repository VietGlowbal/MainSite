import Link from 'next/link';
import { Badge, Container, Panel } from '@/shared/ui';
import type { RankedUniversityMatch, UniversityMatchTierV1 } from '../domain';

function tierLabel(tier: UniversityMatchTierV1): string {
  if (tier === 'strong_chance') return 'Strong Chance';
  if (tier === 'target') return 'Target';
  return 'Reach';
}

function tierVariant(tier: UniversityMatchTierV1): 'safe' | 'recommend' | 'reach' {
  if (tier === 'strong_chance') return 'safe';
  if (tier === 'target') return 'recommend';
  return 'reach';
}

function percentage(value: number | null): string {
  return value === null ? 'Unavailable' : `${Math.round(value)}%`;
}

export function UniversityMatchResults({
  matches,
  demo = false,
}: {
  matches: RankedUniversityMatch[];
  demo?: boolean;
}) {
  return (
    <Container className="flex flex-col gap-gb-4xl py-gb-6xl">
      <div className="flex flex-col gap-gb-lg">
        <Link href="/universities" className="text-gb-sm font-medium text-fg-brand hover:underline">Back to university search</Link>
        {demo ? <Badge variant="brand-subtle">Deterministic demo · fixed fixture data</Badge> : null}
        <h1 className="font-display text-gb-display-xs font-semibold text-fg md:text-gb-display-sm">Your university matches</h1>
        <p className="max-w-gb-width-xl text-gb-md text-fg-tertiary">
          {demo
            ? 'This public demo uses a fixed student profile and university strengths to show deterministic university tiers.'
            : 'University recommendations compare your profile with the university strengths and fit signals available today.'}
        </p>
      </div>

      {matches.length === 0 ? (
        <Panel className="flex flex-col gap-gb-md">
          <h2 className="text-gb-lg font-semibold text-fg">No university matches yet</h2>
          <p className="text-gb-md text-fg-tertiary">Add your target subject and destination preferences in your profile, then return here.</p>
          <Link href="/profile/preferences" className="text-gb-sm font-medium text-fg-brand hover:underline">Update preferences</Link>
        </Panel>
      ) : (
        <section aria-labelledby="university-recommendations-heading" className="flex flex-col gap-gb-2xl">
          <div className="flex flex-col gap-gb-xs">
            <h2 id="university-recommendations-heading" className="text-gb-xl font-semibold text-fg">Recommended universities</h2>
            <p className="text-gb-sm text-fg-tertiary">Universities are ranked by profile fit, with Strong Chance, Target and Reach tiers.</p>
          </div>
          <ol className="grid gap-gb-2xl lg:grid-cols-2">
            {matches.map((match) => <UniversityMatchCard key={match.universityId} match={match} />)}
          </ol>
        </section>
      )}
    </Container>
  );
}

function UniversityMatchCard({ match }: { match: RankedUniversityMatch }) {
  const subjectScore = match.breakdown?.subjects.score ?? null;
  const countryScore = match.breakdown?.country.score ?? null;
  return (
    <Panel as="li" className="flex flex-col gap-gb-2xl">
      <div className="flex flex-wrap items-start justify-between gap-gb-lg">
        <div className="flex min-w-0 flex-col gap-gb-xs">
          <h3 className="text-gb-lg font-semibold text-fg">
            <Link href={`/universities/${match.universityId}`} className="hover:text-fg-brand hover:underline">
              {match.universityName}
            </Link>
          </h3>
          <p className="text-gb-sm text-fg-tertiary">{match.country}</p>
        </div>
        <Badge variant={tierVariant(match.tier)}>{tierLabel(match.tier)}</Badge>
      </div>
      <dl className="grid grid-cols-3 gap-gb-lg text-gb-sm">
        <Metric label="University fit" value={percentage(match.score)} />
        <Metric label="Strength alignment" value={percentage(subjectScore)} />
        <Metric label="Destination fit" value={percentage(countryScore)} />
      </dl>
      {match.whyMatch.length > 0 ? <ReasonList heading="Why this university matches" entries={match.whyMatch} /> : null}
      {match.watchOuts.length > 0 ? <ReasonList heading="Watch out for" entries={match.watchOuts} muted /> : null}
    </Panel>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="flex flex-col gap-gb-xxs"><dt className="text-fg-tertiary">{label}</dt><dd className="font-semibold text-fg">{value}</dd></div>;
}

function ReasonList({ heading, entries, muted = false }: { heading: string; entries: string[]; muted?: boolean }) {
  return <div className="flex flex-col gap-gb-xs"><h4 className="text-gb-sm font-semibold text-fg">{heading}</h4><ul className={`list-disc space-y-gb-xxs pl-gb-2xl text-gb-sm ${muted ? 'text-fg-muted' : 'text-fg-secondary'}`}>{entries.slice(0, 3).map((entry) => <li key={entry}>{entry}</li>)}</ul></div>;
}
