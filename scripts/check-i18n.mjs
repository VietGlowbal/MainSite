#!/usr/bin/env node

/**
 * Static i18n audit. The local Playwright route audit is the source of
 * rendered-route evidence; this check keeps that evidence honest when the
 * machine-translation endpoint is unavailable by comparing source UI literals
 * with the local dictionary.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const root = process.cwd();
const dictionaryFile = path.join(root, 'src/lib/i18n-dictionary.ts');
const sourceRoots = ['src/app', 'src/components', 'src/features', 'src/shared/ui'];
const excludedSegments = new Set(['admin', 'api', 'dev', 'demo-throwaway']);
const privateSegments = new Set(['profile', 'dashboard', 'apply', 'onboarding', 'my-universities', 'ai-strategy']);
// Keep the object-literal scan intentionally narrow: these property names are
// user-facing copy in route metadata/nav configuration, while broad scanning
// would pull in user-authored records and university/program data.
const objectUiProperties = new Set(['label', 'badge', 'title', 'heading', 'cta', 'action', 'button']);
// Values that are intentionally not dictionary entries: proper nouns, brand
// marks, user-entered examples, and fragments whose value is supplied by a
// number/data field at render time.
const protectedStatic = new Set([
  'AI', 'AACC', 'CV', 'VU', 'MA', 'GLOWBAL', 'Glowbal', 'GlowBal', 'Facebook', 'LinkedIn',
  'Vietnam', 'Japan', 'United Kingdom', 'Canada', 'China', 'Germany', 'Hong Kong', 'France',
  'Italy', 'Czech Republic', 'Hungary', 'Ireland', 'New Zealand', 'Input', 'program', 'priority',
  'of', 'with', 'for', 'more', 'bet', 'ter our', 'y', 'No', 'word', 'yet.', 'min', 'min)',
  'Jamie', 'Trang Nguyen', 'Linh Khanh', 'Lil Chi', 'Minh Anh · Melbourne', 'Need-blind',
  'Glowbal AI', '. Click it to activate your account and pick up where you left off.', 'A unique', '/c/', 'KB)',
  'Up to £10,000', 'min · #', 'day', 'Glowbal home', 'GlowBal home', 'VinUni AACC',
  'The GlowBal team at Venture X Demo Day', '— Figma',
  "I don't really have any experience in real work life about Marketing, but I really like creating contents and doing something creative...",
  'University of Birmingham', 'International Excellence Scholarship', 'University of Birmingham · UK', 'James',
  'For example: She taught me Economics for two years and supervised my research project.',
  '/c/&lt;code&gt;', '&ldquo;', '&rdquo;',
]);

function routeFromPageFile(filePath) {
  const normalized = filePath.replaceAll('\\', '/');
  const index = normalized.indexOf('/app/');
  if (index < 0 || !normalized.endsWith('/page.tsx')) return '/';
  const raw = normalized.slice(index + 5, -'/page.tsx'.length);
  const parts = raw.split('/').filter(Boolean).filter((part) => !(part.startsWith('(') && part.endsWith(')')));
  return parts.length ? `/${parts.join('/')}` : '/';
}

function routeSegments(route) {
  return route.split('/').filter(Boolean).map((part) => part.replace(/^\[|\]$/g, '').toLowerCase());
}

function isExcluded(route) {
  const first = routeSegments(route)[0];
  return excludedSegments.has(first);
}

function isPrivate(route) {
  const first = routeSegments(route)[0];
  return privateSegments.has(first);
}

function walk(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (/\.(tsx|ts)$/.test(entry.name) && !/\.test\.[^.]+$/.test(entry.name)) files.push(full);
  }
  return files;
}

function loadDictionary() {
  const source = fs.readFileSync(dictionaryFile, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, { module, exports: module.exports });
  return module.exports.translations ?? {};
}

function staticText(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return null;
}

function hasNoAutoTranslateAncestor(node) {
  for (let current = node.parent; current; current = current.parent) {
    const attributes = ts.isJsxElement(current)
      ? current.openingElement.attributes
      : ts.isJsxSelfClosingElement(current)
        ? current.attributes
        : null;
    if (attributes?.properties?.some((property) =>
      ts.isJsxAttribute(property) && property.name.text === 'data-no-auto-translate',
    )) return true;
  }
  return false;
}

function collectFile(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const route = routeFromPageFile(filePath);
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const occurrences = [];
  const add = (node, value, kind) => {
    const key = value?.replace(/\s+/g, ' ').trim();
    if (!key || !/[\p{L}]/u.test(key) || key.length > 500 || /\{[^}]+\}/.test(key) && kind === 'jsxText') return;
    occurrences.push({
      key,
      route,
      file: path.relative(root, filePath).replaceAll('\\', '/'),
      kind,
      noAuto: Boolean(node && hasNoAutoTranslateAncestor(node)),
      line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
    });
  };

  function visit(node) {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (ts.isIdentifier(callee) && callee.text === 't') add(node.arguments[0], staticText(node.arguments[0]), 't');
    }
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxElement(node)) {
      const opening = ts.isJsxElement(node) ? node.openingElement : node;
      const tag = opening.tagName.getText(sourceFile);
      if (tag === 'T') {
        for (const property of opening.attributes.properties) {
          if (!ts.isJsxAttribute(property) || !['k', 'id'].includes(property.name.text)) continue;
          add(property.initializer, property.initializer && ts.isStringLiteral(property.initializer) ? property.initializer.text : null, 'T');
        }
      }
      for (const property of opening.attributes.properties) {
        if (!ts.isJsxAttribute(property) || !['aria-label', 'placeholder', 'title', 'alt'].includes(property.name.text)) continue;
        add(property.initializer, property.initializer && ts.isStringLiteral(property.initializer) ? property.initializer.text : null, 'attribute');
      }
    }
    if (ts.isJsxText(node)) add(node, node.text, 'jsxText');
    if (ts.isPropertyAssignment(node)) {
      const propertyName = node.name && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name))
        ? node.name.text
        : null;
      const isStaticTeamRole = propertyName === 'role' && filePath.replaceAll('\\', '/').endsWith('src/features/marketing/ui/home-team.tsx');
      if (propertyName && (objectUiProperties.has(propertyName) || isStaticTeamRole)) {
        add(node.initializer, staticText(node.initializer), `object:${propertyName}`);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return occurrences;
}

function isExcludedOccurrence(item) {
  if (isExcluded(item.route)) return true;
  const relative = item.file.replaceAll('\\', '/');
  if (!relative.startsWith('src/app/')) return false;
  const first = relative.split('/')[2]?.toLowerCase();
  return excludedSegments.has(first);
}

function isProtectedStatic(key) {
  return protectedStatic.has(key) || /@|https?:|^\W*\d|%|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b|^rgb\(|^[A-Z]{2}\s\+\d+$/u.test(key);
}

function hasVietnamese(value) {
  return /[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/u.test(value);
}

function isViSourceProtected(key) {
  return /^https?:|^\/|^\W*\d|@|%|^rgb\(|^[\p{P}\d\s]+$/u.test(key)
    || protectedStatic.has(key);
}

function placeholders(value) {
  return [...new Set([...value.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map((match) => match[1]))];
}

function parityIssues(dictionary) {
  return Object.entries(dictionary).flatMap(([key, value]) => {
    const expected = placeholders(key).sort().join('|');
    const actual = placeholders(value).sort().join('|');
    return expected === actual ? [] : [{ key, expected, actual }];
  });
}

function dedupeByRouteAndKey(items) {
  return items.reduce((result, item) => {
    const dedupe = `${item.route}\u0000${item.key}`;
    if (!result.seen.has(dedupe)) {
      result.seen.add(dedupe);
      result.items.push(item);
    }
    return result;
  }, { seen: new Set(), items: [] }).items;
}

function collectRoutes() {
  return walk(path.join(root, 'src/app'))
    .filter((file) => file.endsWith(`${path.sep}page.tsx`))
    .map((file) => ({ route: routeFromPageFile(file), file: path.relative(root, file).replaceAll('\\', '/') }))
    .filter(({ route }) => !isExcluded(route))
    .sort((a, b) => a.route.localeCompare(b.route));
}

function main() {
  const dictionary = loadDictionary();
  const files = sourceRoots.flatMap((sourceRoot) => walk(path.join(root, sourceRoot)));
  const occurrences = files.flatMap(collectFile);
  const scopedOccurrences = dedupeByRouteAndKey(occurrences.filter((item) => !isExcludedOccurrence(item)));
  const dictionaryBacked = scopedOccurrences.filter(({ key }) => dictionary[key] !== undefined);
  const candidates = scopedOccurrences.filter(({ key }) => dictionary[key] === undefined && !hasVietnamese(key));
  const viSource = scopedOccurrences.filter(({ key }) => hasVietnamese(key));
  const viSourceProtected = viSource.filter(({ key }) => isViSourceProtected(key));
  const actionableViSource = viSource.filter(({ key }) => !isViSourceProtected(key));
  const protectedItems = candidates.filter(({ key }) => isProtectedStatic(key));
  const missing = candidates.filter(({ key }) => !isProtectedStatic(key));
  const regexProtectedCount = protectedItems.filter(({ key }) => !protectedStatic.has(key)).length;
  const parity = parityIssues(dictionary);
  const routes = collectRoutes();
  const noAuto = scopedOccurrences.filter(({ noAuto }) => noAuto);
  const noAutoDictionaryBacked = noAuto.filter(({ key }) => dictionary[key] !== undefined);
  const noAutoCandidates = noAuto.filter(({ key }) => dictionary[key] === undefined && !hasVietnamese(key));
  const noAutoMissing = noAutoCandidates.filter(({ key }) => !isProtectedStatic(key));
  const noAutoViSource = noAuto.filter(({ key }) => hasVietnamese(key));
  const noAutoActionableViSource = noAutoViSource.filter(({ key }) => !isViSourceProtected(key));

  const report = {
    generatedAt: new Date().toISOString(),
    routes,
    staticOccurrenceCount: scopedOccurrences.length,
    dictionaryBackedCount: dictionaryBacked.length,
    staticCandidateCount: candidates.length,
    protectedCount: protectedItems.length,
    exactAllowlistCount: protectedStatic.size,
    regexProtectedCount,
    protected: protectedItems,
    missing,
    viSource,
    viSourceProtected,
    actionableViSource,
    noAutoCoverage: {
      staticOccurrenceCount: noAuto.length,
      dictionaryBackedCount: noAutoDictionaryBacked.length,
      candidateCount: noAutoCandidates.length,
      missingCount: noAutoMissing.length,
      viSourceCount: noAutoViSource.length,
      actionableViSourceCount: noAutoActionableViSource.length,
    },
    parity,
  };
  const outputIndex = process.argv.indexOf('--output');
  if (outputIndex >= 0 && process.argv[outputIndex + 1]) fs.writeFileSync(path.resolve(process.argv[outputIndex + 1]), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`i18n routes: ${routes.length}; static occurrences: ${scopedOccurrences.length}; dictionary-backed: ${dictionaryBacked.length}; source candidates: ${candidates.length}; protected: ${protectedItems.length} (exact allowlist ${protectedStatic.size}, narrow patterns ${regexProtectedCount}); missing static keys: ${missing.length}; placeholder mismatches: ${parity.length}`);
  console.log(`VI-source literals: ${viSource.length}; protected VI-source: ${viSourceProtected.length}; actionable VI-only source: ${actionableViSource.length}`);
  console.log(`no-auto coverage: ${noAuto.length} occurrences; dictionary-backed ${noAutoDictionaryBacked.length}; missing ${noAutoMissing.length}; VI-source ${noAutoViSource.length}; actionable VI-only ${noAutoActionableViSource.length}`);
  if (process.argv.includes('--print-protected')) {
    for (const item of protectedItems) console.log(`PROTECTED ${item.route} ${item.file}:${item.line} ${JSON.stringify(item.key)}`);
  }
  const offsetArg = process.argv.find((arg) => arg.startsWith('--offset='));
  const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
  const offset = offsetArg ? Math.max(0, Number(offsetArg.slice('--offset='.length)) || 0) : 0;
  const limit = limitArg ? Math.max(1, Number(limitArg.slice('--limit='.length)) || 100) : (process.argv.includes('--all') ? missing.length : 100);
  for (const item of missing.slice(offset, offset + limit)) console.log(`MISSING ${item.route} ${item.file}:${item.line} ${JSON.stringify(item.key)}`);
  for (const item of actionableViSource.slice(offset, offset + (process.argv.includes('--all') ? actionableViSource.length : limit))) console.log(`VI_SOURCE ${item.route} ${item.file}:${item.line} ${JSON.stringify(item.key)}${item.noAuto ? ' [data-no-auto-translate]' : ''}`);
  for (const issue of parity) console.log(`PLACEHOLDER ${JSON.stringify(issue.key)} expected=${issue.expected} actual=${issue.actual}`);
  if (missing.length || actionableViSource.length || parity.length) process.exitCode = 1;
}

main();
