/**
 * GLOWBAL — university imagery resolver.
 *
 * Each university card needs *two* pictures:
 *   1. A "campus" hero image — used as the wide background photo. We use
 *      a photo of the **city/location** (e.g. Cambridge, Massachusetts
 *      for Harvard) rather than the campus itself. Reasoning: a logo
 *      sitting on top of a campus photo of the *same* university looks
 *      visually noisy and redundant; a city photo gives the card real
 *      sense of place and works much better with a logo overlay.
 *   2. A "logo" image — small circular badge that overlaps the cover.
 *      Universities almost always have an official logo on Wikidata.
 *
 * Resolution chain (each step is a fallback for the previous one):
 *
 *   LOGO
 *     a. Curated Commons file map for top-tier universities
 *     b. Wikidata P154 (logo image) → Commons thumbnail
 *     c. Wikidata P158 (seal / insignia) → Commons thumbnail
 *     d. Clearbit logo from a known domain
 *
 *   CAMPUS / CITY
 *     a. Curated `name → city` map → Wikipedia summary of that city
 *     b. Wikidata P131 (located in administrative entity) → city page
 *     c. Wikidata P159 (HQ location) → that entity's image / city page
 *     d. Wikipedia article's own original image (last resort — usually
 *        the campus, which is the previous behaviour)
 *
 * Everything is cached in-process and respects `next.revalidate` so the
 * route stays fast on warm requests.
 */

type ResolvedImagery = {
  campus: string | null;
  logo: string | null;
};

const CONCURRENCY = 6;
const CACHE = new Map<string, ResolvedImagery>();

const WIKI_REST = 'https://en.wikipedia.org/api/rest_v1/page/summary/';
const WIKI_API = 'https://en.wikipedia.org/w/api.php';
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';

const REVALIDATE = 60 * 60 * 24 * 7; // 7 days

const UA_HEADER = { 'Api-User-Agent': 'glowbal-edu-platform/1.0' };

// ── Aliases — when the university's display name doesn't match its
// Wikipedia article title exactly. ──────────────────────────────────────
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
 * Strip trailing parenthetical acronyms / qualifiers — the database
 * stores names like "National University of Singapore (NUS)" and
 * "University College London (UCL)" so a direct hint-map lookup misses
 * unless we normalise. Returns the cleaned name *and* the original.
 */
function nameWithoutParens(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

/**
 * Resolve a hint from a map by trying both the exact name and the
 * paren-stripped variant. Used by every hint lookup to avoid duplicating
 * the fallback logic everywhere.
 */
function lookupHint<T>(map: Record<string, T>, name: string): T | undefined {
  return map[name] ?? map[nameWithoutParens(name)] ?? map[ALIASES[name] ?? ''] ?? map[ALIASES[nameWithoutParens(name)] ?? ''];
}

// ── Curated city map ────────────────────────────────────────────────────
//
// The cover image on every card is a photo of the *city/location*, not
// the university itself. This map is the most reliable way to pick a
// photogenic, recognisable city photo — Wikidata's locator chains are
// imperfect for things like "Cambridge, Massachusetts" vs "Cambridge".
//
// Format: <university name> → <Wikipedia article title for the city>.
// Article titles include disambiguation (e.g. ", Massachusetts") to land
// on the right page. Fallback resolution still runs if the title isn't
// here.
const CITY_HINTS: Record<string, string> = {
  // ── United States ──────────────────────────────
  'Massachusetts Institute of Technology': 'Cambridge, Massachusetts',
  'Harvard University': 'Cambridge, Massachusetts',
  'Harvard Business School': 'Boston',
  'Stanford University': 'Stanford, California',
  'Princeton University': 'Princeton, New Jersey',
  'Yale University': 'New Haven, Connecticut',
  'Columbia University': 'New York City',
  'Cornell University': 'Ithaca, New York',
  'Brown University': 'Providence, Rhode Island',
  'University of Pennsylvania': 'Philadelphia',
  'Johns Hopkins University': 'Baltimore',
  'University of Chicago': 'Chicago',
  'Northwestern University': 'Evanston, Illinois',
  'New York University': 'New York City',
  'California Institute of Technology': 'Pasadena, California',
  'University of California, Berkeley': 'Berkeley, California',
  'University of California, Los Angeles': 'Los Angeles',
  'University of California, San Diego': 'San Diego',
  'University of Michigan': 'Ann Arbor, Michigan',
  'University of Washington': 'Seattle',
  'Carnegie Mellon University': 'Pittsburgh',
  'Duke University': 'Durham, North Carolina',
  'Georgia Institute of Technology': 'Atlanta',

  // ── United Kingdom ─────────────────────────────
  'University of Oxford': 'Oxford',
  'University of Cambridge': 'Cambridge',
  'Imperial College London': 'London',
  'University College London': 'London',
  'London School of Economics': 'London',
  "King's College London": 'London',
  'University of Edinburgh': 'Edinburgh',
  'University of Manchester': 'Manchester',
  'University of Warwick': 'Coventry',
  'University of Leeds': 'Leeds',
  'University of Birmingham': 'Birmingham',
  'University of Bath': 'Bath, Somerset',
  'University of Bristol': 'Bristol',
  'University of Glasgow': 'Glasgow',
  'University of St Andrews': 'St Andrews',
  'University of Sheffield': 'Sheffield',
  'University of Nottingham': 'Nottingham',
  'University of Southampton': 'Southampton',
  'Royal College of Art': 'London',
  'Queen Mary University of London': 'London',

  // ── Canada ─────────────────────────────────────
  'University of Toronto': 'Toronto',
  'McGill University': 'Montreal',
  'University of British Columbia': 'Vancouver',
  'University of Alberta': 'Edmonton',
  'University of Waterloo': 'Waterloo, Ontario',
  'McMaster University': 'Hamilton, Ontario',

  // ── Australia / NZ ─────────────────────────────
  'University of Melbourne': 'Melbourne',
  'University of Sydney': 'Sydney',
  'Australian National University': 'Canberra',
  'University of New South Wales': 'Sydney',
  'University of Queensland': 'Brisbane',
  'Monash University': 'Melbourne',
  'University of Auckland': 'Auckland',

  // ── Asia-Pacific ───────────────────────────────
  'National University of Singapore': 'Singapore',
  'Nanyang Technological University': 'Singapore',
  'University of Tokyo': 'Tokyo',
  'Kyoto University': 'Kyoto',
  'Osaka University': 'Osaka',
  'Tsinghua University': 'Beijing',
  'Peking University': 'Beijing',
  'University of Hong Kong': 'Hong Kong',
  'Hong Kong University of Science and Technology': 'Hong Kong',
  'Chinese University of Hong Kong': 'Hong Kong',
  'Seoul National University': 'Seoul',
  KAIST: 'Daejeon',
  'POSTECH': 'Pohang',
  'Korea Advanced Institute of Science and Technology': 'Daejeon',
  'Tokyo Institute of Technology': 'Tokyo',
  'Indian Institute of Science': 'Bengaluru',
  'Indian Institute of Technology Bombay': 'Mumbai',
  'Indian Institute of Technology Delhi': 'New Delhi',

  // ── Europe ─────────────────────────────────────
  'ETH Zurich': 'Zurich',
  EPFL: 'Lausanne',
  'Delft University of Technology': 'Delft',
  'University of Amsterdam': 'Amsterdam',
  'Technical University of Munich': 'Munich',
  'Ludwig Maximilian University of Munich': 'Munich',
  'Heidelberg University': 'Heidelberg',
  'KU Leuven': 'Leuven',
  'Sciences Po': 'Paris',
  'Sorbonne University': 'Paris',
  'PSL University': 'Paris',
  'Université Paris-Saclay': 'Paris',
  'Paris-Saclay University': 'Paris',
  'École Polytechnique': 'Palaiseau',
  'Trinity College Dublin': 'Dublin',
  'KTH Royal Institute of Technology': 'Stockholm',
  'Lund University': 'Lund',
  'University of Copenhagen': 'Copenhagen',
  'University of Helsinki': 'Helsinki',
  'University of Oslo': 'Oslo',
  'University of Vienna': 'Vienna',
  'University of Barcelona': 'Barcelona',
  'Pompeu Fabra University': 'Barcelona',
  Politecnico: 'Milan',
  'Polytechnic University of Milan': 'Milan',
  'Bocconi University': 'Milan',
  'Erasmus University Rotterdam': 'Rotterdam',
  'University of Geneva': 'Geneva',
  'Charles University': 'Prague',
  'University of Warsaw': 'Warsaw',
  'University of Zurich': 'Zurich',

  // ── Middle East ────────────────────────────────
  'Khalifa University': 'Abu Dhabi',
  'New York University Abu Dhabi': 'Abu Dhabi',
  'Qatar University': 'Doha',
  'Hamad bin Khalifa University': 'Doha',
};

// ── Domain hints for Clearbit fallback ─────────────────────────────────
//
// Clearbit's free /logo endpoint returns a transparent PNG given any
// domain. It's surprisingly reliable across the higher-ed sector. We
// keep an explicit map for big-name universities so the lookup is fast
// and deterministic, and fall back to a generic guess when needed.
const DOMAIN_HINTS: Record<string, string> = {
  'Massachusetts Institute of Technology': 'mit.edu',
  'Stanford University': 'stanford.edu',
  'Harvard University': 'harvard.edu',
  'Harvard Business School': 'hbs.edu',
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
  EPFL: 'epfl.ch',
  'Delft University of Technology': 'tudelft.nl',
  'University of Amsterdam': 'uva.nl',
  'Sciences Po': 'sciencespo.fr',
  'Université Paris-Saclay': 'universite-paris-saclay.fr',
  'Paris-Saclay University': 'universite-paris-saclay.fr',
  'Trinity College Dublin': 'tcd.ie',
  'University of California, Berkeley': 'berkeley.edu',
  'University of California, Los Angeles': 'ucla.edu',
  'University of California, San Diego': 'ucsd.edu',
  'Princeton University': 'princeton.edu',
  'Yale University': 'yale.edu',
  'Columbia University': 'columbia.edu',
  'Cornell University': 'cornell.edu',
  'Brown University': 'brown.edu',
  'University of Pennsylvania': 'upenn.edu',
  'Johns Hopkins University': 'jhu.edu',
  'University of Chicago': 'uchicago.edu',
  'Northwestern University': 'northwestern.edu',
  'New York University': 'nyu.edu',
  'California Institute of Technology': 'caltech.edu',
  'University of Michigan': 'umich.edu',
  'University of Washington': 'uw.edu',
  'Carnegie Mellon University': 'cmu.edu',
  'Duke University': 'duke.edu',
  'Georgia Institute of Technology': 'gatech.edu',
  'Royal College of Art': 'rca.ac.uk',
  'University of Bristol': 'bristol.ac.uk',
  'University of Glasgow': 'gla.ac.uk',
  'University of St Andrews': 'st-andrews.ac.uk',
  'University of Sheffield': 'sheffield.ac.uk',
  'University of Nottingham': 'nottingham.ac.uk',
  'University of Southampton': 'southampton.ac.uk',
  'Queen Mary University of London': 'qmul.ac.uk',
  'University of Auckland': 'auckland.ac.nz',
  'Monash University': 'monash.edu',
  'University of Queensland': 'uq.edu.au',
  'Tsinghua University': 'tsinghua.edu.cn',
  'Peking University': 'pku.edu.cn',
  'University of Hong Kong': 'hku.hk',
  'Hong Kong University of Science and Technology': 'hkust.hk',
  'Chinese University of Hong Kong': 'cuhk.edu.hk',
  'Seoul National University': 'snu.ac.kr',
  KAIST: 'kaist.ac.kr',
  'Korea Advanced Institute of Science and Technology': 'kaist.ac.kr',
  'Indian Institute of Science': 'iisc.ac.in',
  'Bocconi University': 'unibocconi.it',
  'Polytechnic University of Milan': 'polimi.it',
  Politecnico: 'polimi.it',
  'Technical University of Munich': 'tum.de',
  'Ludwig Maximilian University of Munich': 'lmu.de',
  'Heidelberg University': 'uni-heidelberg.de',
  'KU Leuven': 'kuleuven.be',
  'Sorbonne University': 'sorbonne-universite.fr',
  'PSL University': 'psl.eu',
  'École Polytechnique': 'polytechnique.edu',
  'KTH Royal Institute of Technology': 'kth.se',
  'Lund University': 'lunduniversity.lu.se',
  'University of Copenhagen': 'ku.dk',
  'University of Helsinki': 'helsinki.fi',
  'University of Vienna': 'univie.ac.at',
};

function guessDomain(name: string): string | null {
  return lookupHint(DOMAIN_HINTS, name) ?? null;
}

function faviconLogoUrl(domain: string): string {
  // Google's free `s2/favicons` endpoint returns a 256px image of the
  // domain's favicon — for universities that's almost always the
  // institution's wordmark/crest. We used to use `logo.clearbit.com`
  // but Clearbit shut down their public API on Dec 1 2025, so we
  // picked the most reliable no-auth alternative.
  return `https://www.google.com/s2/favicons?sz=128&domain=${domain}`;
}

// ── Wikipedia / Commons fetchers ───────────────────────────────────────

async function fetchWikiSummary(title: string): Promise<{ original?: string; thumb?: string } | null> {
  try {
    const res = await fetch(`${WIKI_REST}${encodeURIComponent(title)}`, {
      next: { revalidate: REVALIDATE },
      headers: UA_HEADER,
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      original: data?.originalimage?.source,
      thumb: data?.thumbnail?.source,
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
      pithumbsize: '1200',
      origin: '*',
      redirects: '1',
    });
    const res = await fetch(`${WIKI_API}?${params.toString()}`, {
      next: { revalidate: REVALIDATE },
      headers: UA_HEADER,
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

async function fetchWikidataClaims(wikidataId: string): Promise<Record<string, unknown> | null> {
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
      headers: UA_HEADER,
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.entities?.[wikidataId]?.claims ?? null;
  } catch {
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readFirstImageClaim(claims: any, prop: string): string | null {
  const claim = claims?.[prop]?.[0]?.mainsnak?.datavalue?.value;
  return typeof claim === 'string' ? claim : null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readFirstEntityIdClaim(claims: any, prop: string): string | null {
  const value = claims?.[prop]?.[0]?.mainsnak?.datavalue?.value;
  if (value && typeof value === 'object' && 'id' in value) {
    return (value as { id: string }).id;
  }
  return null;
}

/**
 * Resolve a Commons file name to a thumbnailed URL. SVGs render as PNG
 * (via Commons), PNG/JPG come back as the original.
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
      redirects: '1',
    });
    const res = await fetch(`${COMMONS_API}?${params.toString()}`, {
      next: { revalidate: REVALIDATE },
      headers: UA_HEADER,
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

// Look up a Wikidata entity's English page title — used for chasing
// "located in" pointers down to a renderable Wikipedia article.
async function fetchEntitySitelink(entityId: string): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      action: 'wbgetentities',
      format: 'json',
      ids: entityId,
      props: 'sitelinks',
      sitefilter: 'enwiki',
      origin: '*',
    });
    const res = await fetch(`${WIKIDATA_API}?${params.toString()}`, {
      next: { revalidate: REVALIDATE },
      headers: UA_HEADER,
    });
    if (!res.ok) return null;
    const data = await res.json();
    const sitelink = data?.entities?.[entityId]?.sitelinks?.enwiki?.title;
    return typeof sitelink === 'string' ? sitelink : null;
  } catch {
    return null;
  }
}

// ── Logo resolution ────────────────────────────────────────────────────

async function resolveLogo(
  displayName: string,
  wikidataClaims: Record<string, unknown> | null,
): Promise<string | null> {
  // 1. Wikidata logo / seal claims, resolved through Commons. This is
  //    the highest-quality source — institutions self-publish their
  //    canonical brand mark here.
  if (wikidataClaims) {
    for (const prop of ['P154', 'P158', 'P8972']) {
      const file = readFirstImageClaim(wikidataClaims, prop);
      if (file) {
        const url = await commonsImageUrl(file, 320);
        if (url) return url;
      }
    }
  }

  // 2. Google's `s2/favicons` endpoint as a last-resort fallback. For
  //    universities the favicon is almost always the institution's
  //    wordmark or crest, which renders fine in the 48px circle on the
  //    card. Free, no API key, served by Google's CDN.
  const domain = guessDomain(displayName);
  if (domain) return faviconLogoUrl(domain);

  return null;
}

// Override resolveCityImage so it also uses lookupHint (handles
// "(NUS)" / "(UCL)" / "(Caltech)" suffixes consistently).
async function resolveCityImageV2(
  displayName: string,
  wikidataClaims: Record<string, unknown> | null,
): Promise<string | null> {
  // 1. Curated city map → Wikipedia summary of the city
  const curatedCity = lookupHint(CITY_HINTS, displayName);
  if (curatedCity) {
    const summary = await fetchWikiSummary(curatedCity);
    const cityImage = summary?.original ?? summary?.thumb;
    if (cityImage) return cityImage;
  }

  // 2. Wikidata "located in" / HQ / coordinates → linked enwiki page
  if (wikidataClaims) {
    for (const prop of ['P131', 'P159', 'P276']) {
      const entityId = readFirstEntityIdClaim(wikidataClaims, prop);
      if (!entityId) continue;
      const sitelink = await fetchEntitySitelink(entityId);
      if (!sitelink) continue;
      const summary = await fetchWikiSummary(sitelink);
      const img = summary?.original ?? summary?.thumb;
      if (img) return img;
    }
  }

  return null;
}

// ── Per-university resolver ────────────────────────────────────────────

async function resolveOne(rawTitle: string, displayName: string): Promise<ResolvedImagery> {
  const cached = CACHE.get(rawTitle);
  if (cached) return cached;

  const title = aliasTitle(rawTitle);
  const pageInfo = await fetchWikiPageInfo(title);

  const claims = pageInfo?.wikidataId ? await fetchWikidataClaims(pageInfo.wikidataId) : null;

  // Logo + city in parallel
  const [logo, cityImage] = await Promise.all([
    resolveLogo(displayName, claims),
    resolveCityImageV2(displayName, claims),
  ]);

  // Campus = preferred city image, falling back to the Wikipedia article's
  // own lead image (which is usually the campus).
  const campus = cityImage ?? pageInfo?.original ?? null;

  const result: ResolvedImagery = { campus, logo };
  CACHE.set(rawTitle, result);
  return result;
}

// ── Public API ─────────────────────────────────────────────────────────

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
