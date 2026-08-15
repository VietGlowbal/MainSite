/**
 * Matching a course page to a row in `universities`.
 *
 * WHY THIS EXISTS. An application created from a pasted course URL carries a
 * university *name* — whatever the extractor read off the page — but no
 * `university_id`. Everything the directory knows (crest, hero image, rankings,
 * tuition, entry requirements) hangs off that id, so without it the workspace
 * can only ever show what one page said. Resolving the id is what turns a
 * pasted link into a university we know things about.
 *
 * WHY IT IS DELIBERATELY CONSERVATIVE. A wrong match is much worse than no
 * match. `computeUniversitySelectivity` reads `qs_rank` and `accept_rate` to
 * decide reach / recommend / safe, so attaching the wrong row does not merely
 * show the wrong crest — it gives the student confidently wrong advice about
 * their chances. Where this is unsure it returns null and lets the caller
 * create a fresh row instead.
 *
 * Everything here is pure: no database, no network. The repository in
 * ../api/university-resolver supplies the candidates.
 */

/* ─────────────────────────────────────────────────────────────────────────
   Names
   ───────────────────────────────────────────────────────────────────────── */

/**
 * Vietnamese needs handling that Unicode normalisation alone does not give.
 *
 * NFD decomposes most accented Latin letters into a base plus a combining mark,
 * which a diacritic strip then removes. `đ`/`Đ` (U+0111 / U+0110) is not a
 * composition — it is its own letter with a bar through it — so NFD leaves it
 * untouched and it survives the strip. Since the app's whole audience types
 * "Đại học ...", mapping it explicitly is not an edge case here.
 */
const VIETNAMESE_D = /[đĐ]/g;

/** Words that carry no identifying information and differ between sources. */
const NOISE_WORDS = new Set(['the', 'of', 'at', 'and']);

/**
 * A name reduced to something comparable across sources.
 *
 * "The University of Toronto", "University of Toronto" and "UNIVERSITY OF
 * TORONTO" all become "university toronto". The noise words go because the
 * directory and a course page's masthead disagree about them constantly, and
 * they never distinguish two real institutions.
 */
export function normaliseUniversityName(name: string): string {
  return name
    .normalize('NFD')
    // Combining diacritical marks, written as escapes so the range cannot be
    // mangled by an editor that normalises the file itself.
    .replace(/[\u0300-\u036f]/g, '')
    .replace(VIETNAMESE_D, 'd')
    .toLowerCase()
    .replace(/&/g, ' and ')
    // A trailing acronym in brackets — "… of Technology (MIT)" — is a label,
    // not part of the name, and only one side of a comparison tends to have it.
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter((word) => word.length > 0 && !NOISE_WORDS.has(word))
    .join(' ');
}

function tokens(normalised: string): string[] {
  return normalised.split(' ').filter(Boolean);
}

/* ─────────────────────────────────────────────────────────────────────────
   Domains
   ───────────────────────────────────────────────────────────────────────── */

/**
 * Second-level suffixes that are registry-operated, so the registrable name is
 * the *third* label from the right rather than the second.
 *
 * Academic domains are full of these — `ox.ac.uk`, `unimelb.edu.au`,
 * `hust.edu.vn` — and taking the last two labels would collapse every British
 * university to "ac.uk" and match them all to each other. That is the single
 * worst failure this module could have, so the list leans towards the study
 * destinations GlowBal actually serves.
 *
 * Not a full public-suffix list: pulling one in would be a new dependency and
 * ~200KB for a lookup that is only ever asked about university hostnames.
 */
const COMPOUND_SUFFIXES = new Set([
  'ac.uk', 'co.uk', 'org.uk', 'gov.uk',
  'edu.au', 'com.au', 'org.au', 'net.au',
  'ac.nz', 'edu.nz',
  'edu.vn', 'com.vn', 'org.vn', 'ac.vn',
  'edu.sg', 'com.sg', 'org.sg',
  'edu.my', 'com.my',
  'edu.cn', 'com.cn', 'ac.cn', 'org.cn',
  'edu.hk', 'com.hk',
  'ac.jp', 'co.jp', 'or.jp',
  'ac.kr', 'co.kr',
  'ac.th', 'co.th',
  'edu.tw', 'com.tw',
  'edu.ph', 'com.ph',
  'edu.in', 'ac.in', 'co.in',
  'edu.pk', 'ac.za', 'co.za',
  'edu.br', 'com.br',
  'edu.mx', 'com.mx',
  'edu.co', 'com.co',
  'ac.ir', 'ac.il', 'ac.at', 'ac.be', 'ac.id', 'ac.ma',
]);

/**
 * The registrable part of a URL's host: the bit that identifies the
 * institution, with subdomains dropped.
 *
 *   https://future.utoronto.ca/apply    → utoronto.ca
 *   https://www.ox.ac.uk/courses/x      → ox.ac.uk
 *   https://study.unimelb.edu.au/find   → unimelb.edu.au
 *
 * Subdomains are dropped rather than enumerated: universities put course pages
 * on `study.`, `future.`, `apply.`, `admissions.`, `gradstudies.` and a hundred
 * other prefixes, and any allow-list of them would be wrong by next term.
 */
export function registrableDomain(url: string): string | null {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    // Legacy application imports accepted bare hosts such as
    // `www.birmingham.ac.uk`. Treat them as HTTPS URLs for identity matching;
    // malformed text still throws and returns null below.
    try {
      host = new URL(`https://${url}`).hostname.toLowerCase();
    } catch {
      return null;
    }
  }

  // An IP address has no registrable name to speak of.
  if (/^[\d.]+$/.test(host)) return null;

  const labels = host.replace(/^www\./, '').split('.').filter(Boolean);
  if (labels.length < 2) return null;

  const lastTwo = labels.slice(-2).join('.');
  if (COMPOUND_SUFFIXES.has(lastTwo) && labels.length >= 3) {
    return labels.slice(-3).join('.');
  }
  return lastTwo;
}

/** True when two URLs (or a URL and a stored domain) name the same institution. */
export function sameDomain(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const left = registrableDomain(a) ?? registrableDomain(`https://${a}`);
  const right = registrableDomain(b) ?? registrableDomain(`https://${b}`);
  return left != null && left === right;
}

/* ─────────────────────────────────────────────────────────────────────────
   Scoring
   ───────────────────────────────────────────────────────────────────────── */

/** How the match was arrived at. Stored so a bad rule can be found later. */
export type MatchReason = 'domain' | 'exact-name' | 'contained-name';

export type UniversityCandidate = {
  id: number;
  name: string;
  country?: string | null;
  primary_domain?: string | null;
};

export type UniversityMatch = {
  id: number;
  name: string;
  reason: MatchReason;
  /** 0–1. Only ever `domain` = 1; name matches top out lower on purpose. */
  confidence: number;
};

export type MatchQuery = {
  /** The name the extractor read off the course page. */
  name?: string | null;
  /** The course URL — the strongest signal available. */
  courseUrl?: string | null;
  /** The country the page stated, used to break name ties. */
  country?: string | null;
  /**
   * Fallback domain for a candidate whose `primary_domain` is null, from the
   * hand-maintained lookup in ./websites. Passed in rather than imported so
   * this file stays free of the lookup's coverage gaps.
   */
  knownDomainFor?: (name: string) => string | null;
};

/**
 * Token overlap as a share of the shorter name, 0–1.
 *
 * Against the shorter side rather than the union: "University of Toronto" and
 * "University of Toronto Mississauga" share every token of the former, and
 * scoring that as 3/4 would rank it below a worse but shorter candidate. The
 * containment check that consumes this is what stops the two being merged.
 */
function tokenOverlap(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  const shared = a.filter((token) => setB.has(token)).length;
  return shared / Math.min(a.length, b.length);
}

/**
 * The best candidate for this query, or null when none is safe enough.
 *
 * Order matters and is not a tie-break — it is a hierarchy of evidence:
 *
 *  1. DOMAIN. A course page served from `utoronto.ca` is the University of
 *     Toronto's. Nothing a name says can outweigh that, and nothing else here
 *     comes close to it for reliability.
 *
 *  2. EXACT NORMALISED NAME. Same institution written two ways.
 *
 *  3. CONTAINMENT, and only with the country agreeing. "University of Toronto"
 *     inside "University of Toronto Scarborough" is a real relationship, but it
 *     is also how distinct campuses look, so this is the weakest rung and is
 *     reported as such.
 *
 * A candidate that matches nothing above returns null, and the caller creates a
 * new row. Creating a duplicate is recoverable — the review queue catches it.
 * Attaching a student to the wrong university's entry requirements is not.
 */
export function pickBestMatch(
  candidates: UniversityCandidate[],
  query: MatchQuery,
): UniversityMatch | null {
  if (candidates.length === 0) return null;

  // ── 1. Domain ──────────────────────────────────────────────────────────
  const queryDomain = query.courseUrl ? registrableDomain(query.courseUrl) : null;
  if (queryDomain) {
    for (const candidate of candidates) {
      const stored = candidate.primary_domain ?? query.knownDomainFor?.(candidate.name) ?? null;
      if (stored && sameDomain(queryDomain, stored)) {
        return { id: candidate.id, name: candidate.name, reason: 'domain', confidence: 1 };
      }
    }
  }

  if (!query.name) return null;
  const wanted = normaliseUniversityName(query.name);
  if (wanted.length === 0) return null;
  const wantedTokens = tokens(wanted);

  // ── 2. Exact normalised name ───────────────────────────────────────────
  for (const candidate of candidates) {
    if (normaliseUniversityName(candidate.name) === wanted) {
      return { id: candidate.id, name: candidate.name, reason: 'exact-name', confidence: 0.9 };
    }
  }

  // ── 3. Containment, country permitting ─────────────────────────────────
  const wantedCountry = query.country ? normaliseUniversityName(query.country) : null;

  let best: UniversityMatch | null = null;
  for (const candidate of candidates) {
    const other = normaliseUniversityName(candidate.name);
    if (other.length === 0) continue;

    const contains = other.startsWith(`${wanted} `) || wanted.startsWith(`${other} `);
    if (!contains) continue;

    // A country that is present on both sides and disagrees is disqualifying:
    // several institutions share a name across borders.
    if (wantedCountry && candidate.country) {
      if (normaliseUniversityName(candidate.country) !== wantedCountry) continue;
    }

    const overlap = tokenOverlap(wantedTokens, tokens(other));
    // Two tokens is the floor. A single shared word ("university") is not
    // evidence of anything.
    if (wantedTokens.length < 2 || overlap < 1) continue;

    const confidence = wantedCountry && candidate.country ? 0.75 : 0.6;
    if (!best || confidence > best.confidence) {
      best = { id: candidate.id, name: candidate.name, reason: 'contained-name', confidence };
    }
  }

  return best;
}
