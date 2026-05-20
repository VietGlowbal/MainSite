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
  'KAIST': 'Daejeon',

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

  // ── Middle East ────────────────────────────────
  'Khalifa University': 'Abu Dhabi',
  'New York University Abu Dhabi': 'Abu Dhabi',
  'Qatar University': 'Doha',
  'Hamad bin Khalifa University': 'Doha',
};

// ── Curated logo map ───────────────────────────────────────────────────
//
// Direct Wikimedia Commons file names for top universities — these are
// the canonical brand logos as published by the institutions themselves.
// Avoids depending on Wikidata having P154 set (it's surprisingly
// inconsistent for older articles).
const LOGO_HINTS: Record<string, string> = {
  'Harvard University': 'Harvard_University_coat_of_arms.svg',
  'Massachusetts Institute of Technology': 'MIT_logo.svg',
  'Stanford University': 'Stanford_Cardinal_logo.svg',
  'Princeton University': 'Princeton_seal.svg',
  'Yale University': 'Yale_University_Shield_1.svg',
  'Columbia University': 'Columbia_coat_of_arms_without_motto_ribbon.svg',
  'Cornell University': 'Cornell_University_seal.svg',
  'Brown University': 'Brown_University_coat_of_arms.svg',
  'University of Pennsylvania': 'University_of_Pennsylvania_shield_with_banner.svg',
  'University of Chicago': 'University_of_Chicago_shield.svg',
  'Johns Hopkins University': 'Johns_Hopkins_University_seal.svg',
  'New York University': 'NYU_logo.svg',
  'California Institute of Technology': 'Seal_of_the_California_Institute_of_Technology.svg',
  'University of California, Berkeley': 'Seal_of_University_of_California,_Berkeley.svg',
  'University of California, Los Angeles': 'The_University_of_California_UCLA.svg',
  'University of Michigan': 'University_of_Michigan_logo.svg',
  'Carnegie Mellon University': 'Carnegie_Mellon_University_seal.svg',
  'Duke University': 'Duke_University_seal.svg',

  'University of Oxford': 'Oxford-University-Circlet.svg',
  'University of Cambridge': 'University_of_Cambridge_coat_of_arms_official.svg',
  'Imperial College London': 'Imperial_College_London_crest.svg',
  'University College London': 'University_College_London_logo.svg',
  'London School of Economics': 'London_School_of_Economics_coat_of_arms.svg',
  "King's College London": "King's_College_London_logo.svg",
  'University of Edinburgh': 'University_of_Edinburgh_ceremonial_roundel.svg',
  'University of Manchester': 'University_of_Manchester.svg',
  'University of Warwick': 'University_of_Warwick_coat_of_arms.svg',
  'University of Leeds': 'University_of_Leeds_logo.svg',
  'University of Birmingham': 'University_of_Birmingham_coat_of_arms.svg',
  'University of Bath': 'University_of_Bath_coat_of_arms.svg',

  'University of Toronto': 'Utoronto_coa.svg',
  'McGill University': 'McGill_University_CoA.svg',
  'University of British Columbia': 'The_University_of_British_Columbia-Logo.svg',

  'University of Melbourne': 'University_of_Melbourne_logo.svg',
  'University of Sydney': 'University_of_Sydney_coat_of_arms.svg',
  'Australian National University': 'ANU_logo.svg',

  'National University of Singapore': 'NUS_coat_of_arms.svg',
  'Nanyang Technological University': 'Nanyang_Technological_University.svg',
  'University of Tokyo': 'University_of_Tokyo_logo.svg',
  'Kyoto University': 'Kyoto_University_emblem.svg',
  'ETH Zurich': 'ETH_Zürich_Logo_black.svg',
  EPFL: 'Logo_EPFL.svg',
  'Delft University of Technology': 'Delft_University_of_Technology_logo.svg',
  'Sciences Po': 'Sciences_Po.svg',
  'Trinity College Dublin': 'Trinity_College_Dublin_Arms.svg',
  'Royal College of Art': 'Royal_College_of_Art_logo.svg',
};

// ── Domain hints for Clearbit fallback ─────────────────────────────────
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
  EPFL: 'epfl.ch',
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
  return DOMAIN_HINTS[name] ?? DOMAIN_HINTS[ALIASES[name] ?? ''] ?? null;
}

function clearbitLogoUrl(domain: string): string {
  return `https://logo.clearbit.com/${domain}`;
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
  // 1. Curated Commons file
  const curatedFile = LOGO_HINTS[displayName] ?? LOGO_HINTS[ALIASES[displayName] ?? ''];
  if (curatedFile) {
    const url = await commonsImageUrl(curatedFile, 320);
    if (url) return url;
  }

  // 2. Wikidata logo / seal claims
  if (wikidataClaims) {
    for (const prop of ['P154', 'P158', 'P8972']) {
      const file = readFirstImageClaim(wikidataClaims, prop);
      if (file) {
        const url = await commonsImageUrl(file, 320);
        if (url) return url;
      }
    }
  }

  // 3. Clearbit by domain
  const domain = guessDomain(displayName);
  if (domain) return clearbitLogoUrl(domain);

  return null;
}

// ── City / location resolution ─────────────────────────────────────────

async function resolveCityImage(
  displayName: string,
  wikidataClaims: Record<string, unknown> | null,
): Promise<string | null> {
  // 1. Curated city map → Wikipedia summary of the city
  const curatedCity = CITY_HINTS[displayName] ?? CITY_HINTS[ALIASES[displayName] ?? ''];
  if (curatedCity) {
    const summary = await fetchWikiSummary(curatedCity);
    const cityImage = summary?.original ?? summary?.thumb;
    if (cityImage) return cityImage;
  }

  // 2. Wikidata P131 (located in admin entity) → enwiki article → image
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
    resolveCityImage(displayName, claims),
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
