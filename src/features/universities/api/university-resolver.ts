import { createAdminClient } from '@/lib/supabase/admin';
import {
  normaliseUniversityName,
  pickBestMatch,
  registrableDomain,
  type UniversityCandidate,
  type UniversityMatch,
} from '../domain/match-university';
import { officialWebsite } from '../domain/websites';

/**
 * Turning "a course page said this university's name" into a row id.
 *
 * An application imported from a pasted URL has never had a `university_id`:
 * the insert only sets one when the student came through the course-search
 * modal, which is the minority path. Everything the directory knows — crest,
 * hero image, rankings, tuition, entry requirements — hangs off that id, so
 * until it is filled the workspace can only ever show what one page said.
 *
 * Two steps, in order:
 *
 *   1. MATCH an existing row. See ../domain/match-university for the hierarchy
 *      of evidence and why it refuses to guess.
 *
 *   2. CREATE a sparse row when nothing matches, from what the course page
 *      itself stated.
 *
 * ─── WHAT A CREATED ROW IS ALLOWED TO CONTAIN ─────────────────────────────
 *
 * Identity only: name, country, type, domain. Never `qs_rank`, `accept_rate`,
 * `tuition_usd` or `admission_difficulty`.
 *
 * This is not caution for its own sake. `computeUniversitySelectivity` reads
 * exactly those columns to place a student in reach / recommend / safe, and it
 * is written to degrade gracefully — with all of them null it returns a neutral
 * 58 and the tier comes out "recommended". A model asked to recall a ranking it
 * did not read off the page will answer anyway, and a hallucinated `qs_rank: 12`
 * does not fail loudly; it silently tells a student their safety school is a
 * reach. A missing number produces a vaguer answer. A wrong number produces a
 * confident wrong one.
 *
 * So the model's job here is transcription, not recall: it may report what the
 * page says the institution is called and where it is, and nothing else. The
 * rows land tagged `source = 'auto_course_parse'` for the review queue that
 * supabase-university-source.sql already indexes, and the image cron fills in
 * their imagery afterwards.
 */

/** Provenance marker. Distinct from the discovery cron's plain 'auto'. */
export const AUTO_PARSE_SOURCE = 'auto_course_parse';

export type ResolveInput = {
  /** The university name the extractor read off the course page. */
  name?: string | null;
  /** The course URL. The strongest matching signal we have. */
  courseUrl?: string | null;
  /** Country as stated on the page. */
  country?: string | null;
  /** "public" / "private", when the page says so. */
  type?: string | null;
  /** The institution's name in its own language, when the page carries one. */
  localName?: string | null;
};

export type ResolveOptions = {
  /**
   * Whether a missing directory entry may be created. Defaults to true for
   * the parse worker. Reconciliation previews and match-only runs pass false,
   * which guarantees that candidate lookup is the only database operation.
   */
  createIfMissing?: boolean | undefined;
};

export type ResolveOutcome =
  | { status: 'matched'; universityId: number; match: UniversityMatch }
  | { status: 'created'; universityId: number; name: string }
  | { status: 'unmatched'; name: string }
  | { status: 'skipped'; reason: 'no-name' | 'insert-failed' | 'lookup-failed' };

/**
 * Candidate rows worth comparing against.
 *
 * Deliberately not the whole table. Two cheap, selective queries — one on the
 * stored domain, one on a name prefix — beat loading several thousand rows to
 * score them in memory, and the matcher only ever needs the plausible few.
 *
 * `primary_domain` is selected defensively: supabase-university-domain.sql adds
 * it, and this codebase has a standing habit of shipping code before its
 * migration is applied (see settleApplication in the parse worker for the same
 * problem). A missing column makes Postgres reject the whole select, so the
 * first failure retries without it rather than losing every candidate.
 */
async function fetchCandidates(input: ResolveInput): Promise<UniversityCandidate[] | null> {
  const supabase = createAdminClient();
  const domain = input.courseUrl ? registrableDomain(input.courseUrl) : null;

  async function select(withDomain: boolean) {
    const columns = withDomain ? 'id, name, country, primary_domain' : 'id, name, country';
    let query = supabase.from('universities').select(columns);

    // The name's most distinctive word, so the prefix filter stays selective.
    // "University" and friends are stripped by the normaliser, so what is left
    // is the part that actually identifies the place.
    const distinctive = firstDistinctiveWord(input.name);

    if (withDomain && domain) {
      query = distinctive
        ? query.or(`primary_domain.ilike.%${domain},name.ilike.%${distinctive}%`)
        : query.ilike('primary_domain', `%${domain}`);
    } else if (distinctive) {
      query = query.ilike('name', `%${distinctive}%`);
    } else {
      return { data: [] as unknown[], error: null };
    }

    return query.limit(50);
  }

  let { data, error } = await select(true);
  if (error) {
    ({ data, error } = await select(false));
  }
  if (error) {
    console.error('[university-resolver] candidate lookup failed:', error);
    return null;
  }

  return (data ?? []) as unknown as UniversityCandidate[];
}

/**
 * The most identifying word of the normalised name, for the prefix filter.
 *
 * Longest rather than first: "University of Toronto" normalises to
 * "university toronto", and the first token is the word every row shares.
 *
 * The fallback matters more than it looks. Requiring a long, non-generic word
 * and giving up otherwise means a name that is *only* generic or short — "MIT",
 * "UCL", "Trinity College" — fetches no candidates at all, and no candidates is
 * indistinguishable from "not in the directory". That path ends in a duplicate
 * row for a university we already have, so it falls back to the longest token
 * of any kind before conceding.
 */
function firstDistinctiveWord(name: string | null | undefined): string | null {
  if (!name) return null;
  const all = normaliseUniversityName(name).split(' ').filter(Boolean);
  if (all.length === 0) return null;

  const longest = (words: string[]) =>
    words.reduce((best, word) => (word.length > best.length ? word : best));

  const distinctive = all.filter(
    (word) => word.length >= 4 && word !== 'university' && word !== 'college' && word !== 'institute',
  );

  return distinctive.length > 0 ? longest(distinctive) : longest(all);
}

/**
 * Create the row, or return an existing id if a concurrent parse won the race.
 *
 * Two students pasting two courses from the same new university at the same
 * time is not hypothetical — the worker drains jobs in a batch. Rather than
 * relying on a unique constraint the table may not have, a miss on insert
 * re-reads by normalised name.
 */
async function createUniversity(
  input: ResolveInput,
  name: string,
): Promise<{ id: number } | null> {
  const supabase = createAdminClient();
  const domain = input.courseUrl ? registrableDomain(input.courseUrl) : null;

  const row: Record<string, unknown> = {
    name,
    // NOT NULL on the table, and a blank string would pollute the country
    // filter chips. "Unknown" is at least filterable and obviously pending.
    country: input.country?.trim() || 'Unknown',
    source: AUTO_PARSE_SOURCE,
  };
  if (input.type) row['type'] = input.type;
  if (input.localName && input.localName !== name) row['local_name'] = input.localName;
  if (domain) row['primary_domain'] = domain;

  const { data, error } = await supabase
    .from('universities')
    .insert(row)
    .select('id')
    .single();

  if (!error && data) return { id: data.id as number };

  // `source` and `primary_domain` both come from migrations that may not have
  // been applied. Retry with only the columns the base schema guarantees, so a
  // pending migration degrades to a plainer row rather than to no row.
  const { data: retry, error: retryError } = await supabase
    .from('universities')
    .insert({ name, country: row['country'] })
    .select('id')
    .single();

  if (!retryError && retry) return { id: retry.id as number };

  // Lost a race, most likely. Re-read before giving up.
  const { data: existing } = await supabase
    .from('universities')
    .select('id, name')
    .ilike('name', name)
    .limit(1);

  const found = existing?.[0];
  if (found) return { id: found.id as number };

  console.error('[university-resolver] insert failed:', retryError ?? error);
  return null;
}

/**
 * Resolve — and if necessary create — the university for a parsed course page.
 *
 * Never throws: this runs inside the parse worker, and a directory lookup
 * failing is not a reason to fail a parse that otherwise succeeded. The
 * application keeps its `university_name` either way; the id is an upgrade.
 */
export async function resolveUniversity(
  input: ResolveInput,
  options: ResolveOptions = {},
): Promise<ResolveOutcome> {
  const name = input.name?.trim();
  if (!name || normaliseUniversityName(name).length === 0) {
    return { status: 'skipped', reason: 'no-name' };
  }

  const candidates = await fetchCandidates(input);
  if (candidates === null) return { status: 'skipped', reason: 'lookup-failed' };

  const match = pickBestMatch(candidates, {
    name,
    courseUrl: input.courseUrl ?? null,
    country: input.country ?? null,
    knownDomainFor: officialWebsite,
  });

  if (match) return { status: 'matched', universityId: match.id, match };

  if (options.createIfMissing === false) {
    return { status: 'unmatched', name };
  }

  const created = await createUniversity(input, name);
  if (!created) return { status: 'skipped', reason: 'insert-failed' };

  return { status: 'created', universityId: created.id, name };
}
