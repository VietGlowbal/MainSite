/**
 * Resolve university thumbnail images from Wikipedia's REST API.
 * Uses the page summary endpoint which returns a thumbnail URL.
 * Batches requests in parallel with a concurrency limit.
 */

const CONCURRENCY = 10;
const CACHE = new Map<string, string>();

async function fetchWikiThumbnail(title: string): Promise<string | null> {
  if (CACHE.has(title)) return CACHE.get(title)!;

  try {
    const encoded = encodeURIComponent(title);
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`,
      { next: { revalidate: 86400 } }, // Cache for 24 hours
    );

    if (!res.ok) return null;

    const data = await res.json();
    const url = data?.thumbnail?.source ?? null;

    if (url) {
      // Request a larger thumbnail by modifying the width in the URL
      const largerUrl = url.replace(/\/\d+px-/, '/600px-');
      CACHE.set(title, largerUrl);
      return largerUrl;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Resolve Wikipedia thumbnail images for a batch of university names.
 * Returns a map of wiki title → image URL.
 */
export async function resolveWikiImages(
  wikiTitles: string[],
): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  const unique = [...new Set(wikiTitles)];

  // Process in batches to avoid overwhelming the API
  for (let i = 0; i < unique.length; i += CONCURRENCY) {
    const batch = unique.slice(i, i + CONCURRENCY);
    const promises = batch.map(async (title) => {
      const url = await fetchWikiThumbnail(title);
      if (url) results.set(title, url);
    });
    await Promise.all(promises);
  }

  return results;
}
