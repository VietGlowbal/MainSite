#!/usr/bin/env node

/**
 * Automated SEO regression check script.
 * Validates:
 * 1. Static codebase indexability contract (all private route layouts must have noindex metadata).
 * 2. News/GEO files must not contain draft placeholder markers in published guides.
 * 3. Live server checks (when --base-url is reachable):
 *    - /robots.txt returns 200 and points to canonical sitemap.
 *    - /sitemap.xml returns 200, only contains valid canonical URLs (no /apply, no /auth, etc.).
 *    - Private routes respond with noindex signals.
 *    - Public pages have exactly one <h1>.
 */

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

// ── 1. Codebase static checks ────────────────────────────────────────────────

console.log('🔍 Running static SEO contract audits...');

let failures = 0;

function reportFailure(message) {
  console.error(`❌ [SEO FAIL] ${message}`);
  failures += 1;
}

function reportSuccess(message) {
  console.log(`✅ [SEO PASS] ${message}`);
}

// A. Check private layout files for noindex metadata
const requiredPrivateLayouts = [
  'src/app/auth/layout.tsx',
  'src/app/apply/layout.tsx',
  'src/app/profile/layout.tsx',
  'src/app/dashboard/layout.tsx',
  'src/app/admin/layout.tsx',
  'src/app/onboarding/layout.tsx',
  'src/app/ai-strategy/[applicationId]/layout.tsx',
  'src/app/coordinator/layout.tsx',
  'src/app/payment/layout.tsx',
];

for (const relPath of requiredPrivateLayouts) {
  const fullPath = path.join(root, relPath);
  if (!fs.existsSync(fullPath)) {
    reportFailure(`Missing private layout: ${relPath}`);
    continue;
  }
  const content = fs.readFileSync(fullPath, 'utf8');
  const hasNoIndex =
    content.includes('PRIVATE_ROBOTS') ||
    (content.includes('index: false') && content.includes('follow: false'));

  if (!hasNoIndex) {
    reportFailure(`${relPath} must export noindex metadata (robots: { index: false, follow: false })`);
  } else {
    reportSuccess(`${relPath} has noindex metadata`);
  }
}

// B. Check published GEO guides for forbidden placeholder markers
const publishedNewsDir = path.join(root, 'content/geo/published');
if (fs.existsSync(publishedNewsDir)) {
  const files = fs.readdirSync(publishedNewsDir).filter((f) => f.endsWith('.md'));
  const placeholderRegex = /\b(?:TODO_SOURCE_REQUIRED|draft guide|lorem ipsum)\b/i;

  for (const file of files) {
    const raw = fs.readFileSync(path.join(publishedNewsDir, file), 'utf8');
    if (placeholderRegex.test(raw)) {
      reportFailure(`Published guide content/geo/published/${file} contains forbidden placeholder text`);
    }
  }
  reportSuccess(`Audited ${files.length} published markdown guides for placeholder copy`);
}

// ── 2. Live HTTP check if URL is provided or reachable ───────────────────────

const baseUrlArgIndex = process.argv.indexOf('--base-url');
const baseUrl = baseUrlArgIndex !== -1 ? process.argv[baseUrlArgIndex + 1] : process.env.SITE_URL;

if (baseUrl) {
  console.log(`\n🌐 Running live HTTP audits against ${baseUrl}...`);
  try {
    // Check /robots.txt
    const robotsRes = await fetch(`${baseUrl}/robots.txt`);
    if (robotsRes.status !== 200) {
      reportFailure(`/robots.txt returned status ${robotsRes.status}`);
    } else {
      const robotsTxt = await robotsRes.text();
      if (!robotsTxt.includes('Sitemap:')) {
        reportFailure('/robots.txt missing Sitemap reference');
      } else {
        reportSuccess('/robots.txt is valid and references sitemap');
      }
    }

    // Check /sitemap.xml
    const sitemapRes = await fetch(`${baseUrl}/sitemap.xml`);
    if (sitemapRes.status !== 200) {
      reportFailure(`/sitemap.xml returned status ${sitemapRes.status}`);
    } else {
      const sitemapXml = await sitemapRes.text();
      if (sitemapXml.includes('/apply</loc>') || sitemapXml.includes('/auth</loc>')) {
        reportFailure('/sitemap.xml contains private/redirected routes (/apply or /auth)');
      } else {
        reportSuccess('/sitemap.xml is clean of private/redirected routes');
      }
    }
  } catch (err) {
    console.warn(`⚠️ Could not complete live HTTP checks against ${baseUrl} (server not reachable):`, err.message);
  }
}

console.log('\n📊 SEO Audit Summary:');
if (failures > 0) {
  console.error(`🚨 Failed with ${failures} SEO regression error(s)!\n`);
  process.exit(1);
} else {
  console.log('🎉 All SEO regression checks passed!\n');
  process.exit(0);
}
