import { nowIso, paths, readSources, writeJsonFile } from './lib';

async function checkSource(url: string) {
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; GlowbalGEO/1.0)' },
    });
    const html = await response.text();
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch?.[1]?.trim() ?? '';
    return { status: response.status, finalUrl: response.url, ok: response.ok, title, checkedAt: nowIso() };
  } catch (error) {
    return { status: 0, finalUrl: url, ok: false, title: '', checkedAt: nowIso(), error: error instanceof Error ? error.message : String(error) };
  }
}

async function main() {
  const targetSlug = process.argv[2];
  const sources = readSources().filter((source) => !targetSlug || source.relatedSlug === targetSlug);
  const results: Array<Record<string, unknown>> = [];
  for (const source of sources) {
    const result = await checkSource(source.url);
    results.push({ id: source.id, sourceTitle: source.title, url: source.url, relatedSlug: source.relatedSlug, sourceType: source.sourceType, ...result });
  }
  writeJsonFile(`${paths.reportsDir}/sources-report.json`, results);
  console.log(JSON.stringify({ checked: results.length, report: 'content/geo/reports/sources-report.json', results }, null, 2));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exit(1); });
