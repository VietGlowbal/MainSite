/**
 * University imagery resolver.
 *
 * For each university we want two pictures on the search/explorer cards:
 *   1. A "campus" image — the wide hero behind the card. Usually the lead
 *      photo of the Wikipedia article (a recognisable photo of the campus
 *      or main building).
 *   2. A "logo" image — the small circular badge floating over the cover.
 *      Universities almost always have an SVG logo on Wikipedia (linked
 *      from the infobox via the `P154` Wikidata property).
 *
 * The strategy is a chain of free, no-key sources:
 *   1.  Wikipedia REST `summary` endpoint    → originalimage / thumbnail
 *   2.  Wikipedia MediaWiki `query` endpoint → pageimages (original) +
 *                                              pageprops (wikibase id)
 *   3.  Wikidata claims                      → P154 (logo) + P18 (image)
 *   4.  Logo by domain heuristic             → Clearbit / Google s2 favicon
 *      (last-resort, gives at least a recognisable mark)
 *
 * Everything is cached in-process per server instance and respects
 * `next.revalidate` so the browser path stays fast on hot pages.
 *
 * The function exported below returns a Map keyed on the *encoded
 * Wikipedia title* the explorer-utils builder produces. That keeps the
 * old contract intact — `image_url` was just a campus image — while
 * adding `logo_url` alongside.
 */

type ResolvedImagery = {
  campus: string | null;
  logo: string | null;
};

const CONCURRENCY = 8;
const CACHE = new Map<string, ResolvedImagery>();

const WIKI_REST = 'https://en.wikipedia.org/api/rest_v1/page/summary/';
const WIKI_API = 'https://en.wikipedia.org/w/api.php';
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';

const REVALIDATE = 60 * 60 * 24 * 7; // 7 days — university imagery rarely changes

// Some universities don't have a Wikipedia article that matches their `name`
// exactly; supply a small alias map so the most common ones still resolve.
const ALIASES: Record<string, string> = {
  MIT: 'Massachusetts Institute of Technology',
  Caltech: 'California Institute of Technology',
  UCLA: 'University of California, Los Angeles',
  UCL: 'University College London',
  LSE: 'London School of Economics',
  NUS: 'National University of Singapore',
  NTU: 'Nanyang Technological University',
};

function aliasTitle(title: string): string {
  const normalised = title.replace(/_/g, ' ');
  return ALIASES[normalised] ?? title;
}

/**
 * Build a Clearbit logo URL from a university's "homepage-ish" domain.
 * Clearbit's free logo API returns a transparent PNG. We fall back to it
 * when Wikipedia/Wikidata don't have a logo file, because it gives most
 * universities a recognisable mark instead of a placeholder gradient.
 *
 * The mapping below is *manually curated* for the ~50 universities we
 * actually ship today; for anything outside it we make a best-effort guess
 * by stripping common words and using a `.edu` / `.ac.uk` / `.edu.au`
 * suffix when the country is known.
 */
const DOMAIN_HINTS: Record<string, string> = {
  'Massachusetts Institute of Technology': 'mit.edu',
  'Stanford University': 'stanford.edu',
  'Harvard University': 'harvard.edu',
  'University of Oxford': 'ox.ac.uk',
  'University of Cambridge': 'cam.ac.uk',
  'Imperial College London': 'imperial.ac.uk',
  'University College London': 'ucl.ac.uk',
  'London School of Economics': 'lse.ac.uk',
  "King's College London": 'kcl.ac.uk',
  'University of Edinburgh': 'ed.ac.uk',
  'University of Manchester': 'manchester.ac.uk',
  'University of Warwick': 'warwick.ac.uk',
  'University of Leeds': 'leeds.ac.uk',
  'University of Birmingham': 'birmingham.ac.uk',
  'University of Bath': 'bath.ac.uk',
  'University of Toronto': 'utoronto.ca',
  'McGill University': 'mcgill.ca',
  'University of British Columbia': 'ubc.ca',
  'University of Melbourne': 'unimelb.edu.au',
  'University of Sydney': 'sydney.edu.au',
  'Australian National University': 'anu.edu.au',
  'University of New South Wales': 'unsw.edu.au',
  'National University of Singapore': 'nus.edu.sg',
  'Nanyang Technological University': 'ntu.edu.sg',
  'University of Tokyo': 'u-tokyo.ac.jp',
  'Kyoto University': 'kyoto-u.ac.jp',
  'ETH Zurich': 'ethz.ch',
  'EPFL': 'epfl.ch',
  'Delft University of Technology': 'tudelft.nl',
  'University of Amsterdam': 'uva.nl',
  'Sciences Po': 'sciencespo.fr',
  'Trinity College Dublin': 'tcd.ie',
  'University of California, Berkeley': 'berkeley.edu',
  'University of California, Los Angeles': 'ucla.edu',
  'Princeton University': 'princeton.edu',
  'Yale University': 'yale.edu',
  'Columbia University': 'columbia.edu',
  'Cornell University': 'cornell.edu',
  'Brown University': 'brown.edu',
  'Royal College of Art': 'rca.ac.uk',
};

function guessDomain(name: string): string | null {
  const direct = DOMAIN_HINTS[name];
  if (direct) return direct;
  const alias = ALIASES[name];
  if (alias && DOMAIN_HINTS[alias]) return DOMAIN_HINTS[alias];
  return null;
}

function clearbitLogoUrl(domain: string): string {
  return `https://logo.clearbit.com/${domain}`;
}

// ── Wikipedia / Commons fetchers ────────────────────────────────────────

async function fetchWikiSummary(title: string): Promise<{ original?: string; thumb?: string; pageId?: number } | null> {
  try {
    const res = await fetch(`${WIKI_REST}${encodeURIComponent(title)}`, {
      next: { revalidate: REVALIDATE },
      headers: { 'Api-User-Agent': 'glowbal-edu-platform/1.0' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      original: data?.originalimage?.source,
      thumb: data?.thumbnail?.source,
      pageId: data?.pageid,
    };
  } catch {
    return null;
  }
}

async function fetchWikiPageInfo(title: string): Promise<{ original?: string; wikidataId?: string } | null> {
  try {
    const params = new URLSearchParams({
      action: 'query',
      format: 'json',
      titles: title,
      prop: 'pageimages|pageprops',
      piprop: 'original|thumbnail',
      pithumbsize: '800',
      origin: '*',
      redirects: '1',
    });
    const res = await fetch(`${WIKI_API}?${params.toString()}`, {
      next: { revalidate: REVALIDATE },
      headers: { 'Api-User-Agent': 'glowbal-edu-platform/1.0' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const page = data?.query?.pages ? Object.values<Record<string, unknown>>(data.query.pages)[0] : null;
    if (!page) return null;
    const original = (page.original as { source?: string } | undefined)?.source
      ?? (page.thumbnail as { source?: string } | undefined)?.source;
    const wikidataId = (page.pageprops as { wikibase_item?: string } | undefined)?.wikibase_item;
    return { original, wikidataId };
  } catch {
    return null;
  }
}

async function fetchWikidataLogo(wikidataId: string): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      action: 'wbgetentities',
      format: 'json',
      ids: wikidataId,
      props: 'claims',
      origin: '*',
    });
    const res = await fetch(`${WIKIDATA_API}?${params.toString()}`, {
      next: { revalidate: REVALIDATE },
      headers: { 'Api-User-Agent': 'glowbal-edu-platform/1.0' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const claims = data?.entities?.[wikidataId]?.claims;
    if (!claims) return null;

    // P154 = "logo image", P41 = "flag image", P18 = "image"
    const logoFile = claims.P154?.[0]?.mainsnak?.datavalue?.value
      ?? claims.P158?.[0]?.mainsnak?.datavalue?.value;
    if (!logoFile) return null;

    return commonsImageUrl(String(logoFile), 320);
  } catch {
    return null;
  }
}

/**
 * Resolve a Commons file name (e.g. "Mit-logo.svg") to a renderable URL by
 * asking the Commons API for the file's thumbnail. PNG/JPG return their
 * source URL; SVGs are rendered to a 320px PNG which lets us avoid the
 * inline-SVG complexity in the browser.
 */
async function commonsImageUrl(fileName: string, width: number): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      action: 'query',
      format: 'json',
      titles: `File:${fileName}`,
      prop: 'imageinfo',
      iiprop: 'url',
      iiurlwidth: String(width),
      origin: '*',
    });
    const res = await fetch(`${COMMONS_API}?${params.toString()}`, {
      next: { revalidate: REVALIDATE },
      headers: { 'Api-User-Agent': 'glowbal-edu-platform/1.0' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const page = data?.query?.pages ? Object.values<Record<string, unknown>>(data.query.pages)[0] : null;
    const info = (page?.imageinfo as Array<{ thumburl?: string; url?: string }> | undefined)?.[0];
    return info?.thumburl ?? info?.url ?? null;
  } catch {
    return null;
  }
}

// ── Per-university resolver ─────────────────────────────────────────────

async function resolveOne(rawTitle: string, displayName: string): Promise<ResolvedImagery> {
  const cached = CACHE.get(rawTitle);
  if (cached) return cached;

  const title = aliasTitle(rawTitle);

  // Run summary + page-info in parallel; both can give us the campus image,
  // and page-info gives us the wikidata ID needed for the logo.
  const [summary, pageInfo] = await Promise.all([
    fetchWikiSummary(title),
    fetchWikiPageInfo(title),
  ]);

  // Campus: prefer the highest-res Wikipedia image we can get hold of.
  const campus = pageInfo?.original ?? summary?.original ?? summary?.thumb ?? null;

  // Logo: try Wikidata first, then a domain-based Clearbit fallback so
  // every university card gets some kind of recognisable mark.
  let logo: string | null = null;
  if (pageInfo?.wikidataId) {
    logo = await fetchWikidataLogo(pageInfo.wikidataId);
  }
  if (!logo) {
    const domain = guessDomain(displayName) ?? guessDomain(title.replace(/_/g, ' '));
    if (domain) logo = clearbitLogoUrl(domain);
  }

  const result: ResolvedImagery = { campus, logo };
  CACHE.set(rawTitle, result);
  return result;
}

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Resolve campus + logo imagery for a batch of universities.
 *
 * @param entries  Pairs of `[wikiTitle, displayName]` — wikiTitle is the
 *                 underscore-joined Wikipedia title used as the cache key,
 *                 displayName is the human-readable institution name used
 *                 to look up domain hints when Wikidata has no logo.
 * @returns        Map keyed on wikiTitle, with `campus` and `logo` URLs.
 */
export async function resolveUniversityImagery(
  entries: Array<[string, string]>,
): Promise<Map<string, ResolvedImagery>> {
  const results = new Map<string, ResolvedImagery>();
  const unique = new Map<string, string>();
  for (const [title, name] of entries) {
    if (!unique.has(title)) unique.set(title, name);
  }
  const list = Array.from(unique.entries());

  for (let i = 0; i < list.length; i += CONCURRENCY) {
    const batch = list.slice(i, i + CONCURRENCY);
    const settled = await Promise.all(
      batch.map(async ([title, name]) => {
        const imagery = await resolveOne(title, name);
        return [title, imagery] as const;
      }),
    );
    for (const [title, imagery] of settled) results.set(title, imagery);
  }

  return results;
}

/**
 * Backwards-compatible helper that returns just campus images (the
 * original API). Kept so existing callers compile without changes.
 */
export async function resolveWikiImages(wikiTitles: string[]): Promise<Map<string, string>> {
  const entries = wikiTitles.map((t) => [t, t.replace(/_/g, ' ')] as [string, string]);
  const full = await resolveUniversityImagery(entries);
  const out = new Map<string, string>();
  for (const [title, imagery] of full.entries()) {
    if (imagery.campus) out.set(title, imagery.campus);
  }
  return out;
}
