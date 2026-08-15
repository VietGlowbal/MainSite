#!/usr/bin/env node

/**
 * Local rendered-language audit. Run against a locally started Next server:
 *   node scripts/audit-local-i18n.mjs --base-url http://localhost:3000
 *
 * The browser starts with the requested language preference and, for the
 * Vietnamese pass, aborts /api/translate. This makes every untranslated value
 * visible instead of letting machine translation hide dictionary gaps. Private
 * routes that redirect to /auth are reported as redirect shells, not counted as
 * authenticated-page coverage.
 */
import { chromium } from '@playwright/test';

const baseUrl = (process.argv.find((arg) => arg.startsWith('--base-url=')) ?? '--base-url=http://localhost:3000').slice(11).replace(/\/$/, '');
const requestedLanguage = (process.argv.find((arg) => arg.startsWith('--lang=')) ?? '--lang=vi').slice(7);
const languages = requestedLanguage === 'both' ? ['vi', 'en'] : [requestedLanguage === 'en' ? 'en' : 'vi'];
const baseRoutes = [
  '/', '/about', '/how-it-works', '/news', '/guides', '/universities',
  '/scholarships', '/advisors', '/mentors',
  '/plus', '/terms', '/privacy', '/auth', '/apply', '/profile', '/profile/academic', '/dashboard',
  '/dashboard/bookings', '/onboarding', '/onboarding/documents', '/my-universities',
  '/my-universities/program', '/ai-strategy', '/ai-strategy/matching', '/feedback', '/coordinator',
  '/achievers', '/coming-soon',
];

const hasVietnamese = /[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/u;
const hasLatinWord = /\b[A-Za-z]{3,}\b/u;
const protectedLine = /^(GLOWBAL|GlowBal|©|https?:|[\d\W_]+$)/u;
const knownProper = new Set([
  'Lil Chi', 'James', 'James Lapslie', 'Nguyen Khanh Linh', 'Trang Nguyen', 'Linh Khanh',
  'Massachusetts Institute of Technology (MIT)', 'Imperial College London', 'University of Oxford',
  'Harvard University', 'National University of Singapore (NUS)',
  'London School of Economics and Political Science (LSE)', 'University of Toronto', 'VinUniversity',
  // Crest alt text on the Home roster cards — institution names, never
  // translated. See features/marketing/ui/university-crests.ts.
  'Hanoi University of Science and Technology', 'Foreign Trade University',
  'United States', 'United Kingdom', 'Australia', 'Canada', 'China', 'Germany', 'Hong Kong', 'Japan',
  'South Korea', 'France', 'Italy', 'Netherlands', 'Singapore', 'Czech Republic', 'Hungary', 'Ireland',
  'New Zealand', 'Vietnam', 'English, Vietnamese',
]);

function classifyResidual(value, source) {
  if (/\.(?:mp4|webm|vtt|png|jpg|jpeg|svg)$/u.test(value)) return 'asset';
  if (/^(?:USD|VND|GBP|EUR|CNY)(?:\s|$)|^\d[\d,.]*(?:\s|$)|^\d{1,2}[–-]\d{1,2}%|^\d{1,2}\s(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/u.test(value)) return 'code-or-metric';
  if (/^https?:|^[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}$/u.test(value)) return 'url-or-email';
  if (knownProper.has(value)) return 'proper-or-brand';
  if (source === 'attribute') return 'field-or-accessibility';
  if (/\b(?:draft|applicant|undergraduate|master|scholarship|university|course|degree|session|writer|listener|review)\b/iu.test(value)) return 'dynamic-editorial-or-profile';
  return 'unclassified';
}

const browser = await chromium.launch({ headless: true });
const allAudits = [];
// Discover representative IDs from the local fixture-backed pages instead of
// guessing /advisors/1 or crawling every university record.
const discovered = new Set();
const discoveryContext = await browser.newContext();
const discoveryPage = await discoveryContext.newPage();
for (const seed of ['/advisors', '/universities']) {
  try {
    await discoveryPage.goto(`${baseUrl}${seed}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    const hrefs = await discoveryPage.locator('a[href]').evaluateAll((links) => links.map((link) => link.getAttribute('href')).filter(Boolean));
    for (const href of hrefs) {
      if (/^\/advisors\/[^/?#]+$/.test(href) || /^\/universities\/[^/?#]+$/.test(href)) discovered.add(href);
    }
  } catch {
    /* The route matrix below still records a seed failure. */
  }
}
await discoveryContext.close();
const representativeDynamicRoutes = [
  ...[...discovered].filter((href) => href.startsWith('/advisors/')).slice(0, 2),
  ...[...discovered].filter((href) => href.startsWith('/universities/')).slice(0, 2),
];
const routes = [...new Set([...baseRoutes, ...representativeDynamicRoutes])];
for (const language of languages) {
  const context = await browser.newContext();
  await context.addInitScript((lang) => {
    try { localStorage.setItem('glowbal-language', lang); } catch { /* blocked storage */ }
  }, language);
  const page = await context.newPage();
  const apiRequests = [];
  await page.route('**/api/translate', async (route) => {
    apiRequests.push({ url: route.request().url(), method: route.request().method(), blocked: true });
    await route.abort('blockedbyclient');
  });
  const results = [];
  for (const route of routes) {
    const url = `${baseUrl}${route}`;
    const started = Date.now();
    try {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      // Allow client-fetched cards and the MutationObserver-backed dictionary
      // pass to settle before capturing visible text and attributes.
      await page.waitForTimeout(2_500);
      const finalUrl = page.url();
      const visible = await page.locator('body').innerText();
      const lines = visible.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      const textResiduals = [...new Set(lines.filter((line) => hasLatinWord.test(line) && !hasVietnamese.test(line) && !protectedLine.test(line) && line.length <= 500))]
        .map((value) => ({ value, source: 'visible-text', classification: classifyResidual(value, 'visible-text') }));
      const attributeResiduals = await page.locator('[aria-label],[placeholder],[title],[alt]').evaluateAll((elements) => elements.flatMap((element) => {
        const values = [];
        for (const attribute of ['aria-label', 'placeholder', 'title', 'alt']) {
          const value = element.getAttribute(attribute)?.trim();
          if (value) values.push({ value, attribute, tag: element.tagName.toLowerCase() });
        }
        return values;
      }));
      const residuals = [
        ...textResiduals,
        ...attributeResiduals
          .filter(({ value }) => hasLatinWord.test(value) && !hasVietnamese.test(value) && !protectedLine.test(value) && value.length <= 500)
          .map(({ value, attribute, tag }) => ({ value, source: 'attribute', attribute, tag, classification: classifyResidual(value, 'attribute') })),
      ];
      results.push({
        route,
        status: response?.status() ?? null,
        finalUrl,
        redirected: new URL(finalUrl).pathname !== route,
        shellOnly: new URL(finalUrl).pathname === '/auth' && route !== '/auth',
        durationMs: Date.now() - started,
        htmlLang: await page.locator('html').getAttribute('lang'),
        localeStorage: await page.evaluate(() => localStorage.getItem('glowbal-language')),
        residuals,
        title: await page.title(),
      });
    } catch (error) {
      results.push({ route, status: null, finalUrl: page.url(), durationMs: Date.now() - started, error: String(error) });
    }
  }
  allAudits.push({ language, routes: results, blockedTranslateRequests: apiRequests });
  await context.close();
}

await browser.close();
console.log(JSON.stringify({ baseUrl, languages, localeStorageKey: 'glowbal-language', routes, audits: allAudits }, null, 2));
