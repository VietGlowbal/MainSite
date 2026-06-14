// ============================================================================
// scripts/clean-scholarships.mjs
// ----------------------------------------------------------------------------
// Stage 1 of the scholarships ETL: turn the messy source CSV into a clean,
// deduped, typed JSON file (`data/scholarships.json`) that the loader
// (`scripts/seed-scholarships.mjs`) reads. This step touches NO database — it
// is a pure, deterministic text transform so it can run in CI / be diffed in PRs.
//
// Usage:
//   node scripts/clean-scholarships.mjs [path/to/input.csv]
//   npm run clean:scholarships            (defaults to data/scholarships.raw.csv)
//
// What it does, in order:
//   1. Repairs mojibake (UTF-8 bytes mis-decoded as Windows-1252) if present.
//   2. Parses CSV (RFC-4180: quoted fields, escaped "", embedded newlines).
//   3. Maps Vietnamese headers -> canonical keys; trims/blanks fields.
//   4. Drops empty rows; dedupes by normalized name+url.
//   5. Normalizes funding_type into a token array, parses money / slots /
//      deadline, detects scope + candidate universities, detects language.
//   6. Writes data/scholarships.json and prints a summary (+ a loud warning if
//      the source still looks garbled, i.e. was saved with a lossy encoding).
//
// IMPORTANT: the loader resolves `applies_to_candidates` -> university IDs
// against the live DB, so this script only splits/cleans the school names; it
// does not guess IDs.
// ============================================================================

import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const INPUT = process.argv[2] || path.join(ROOT, 'data', 'scholarships.raw.csv');
const OUTPUT = path.join(ROOT, 'data', 'scholarships.json');

// Keep in sync with FUNDING_TYPES in src/lib/scholarships.ts.
const FUNDING_TYPES = [
  'merit', 'need', 'leadership', 'research', 'sport', 'diversity',
  'regional', 'field-specific', 'full-ride', 'partial', 'travel', 'other',
];
const SCOPES = ['university', 'country', 'consortium', 'provider'];

// ── 1. Mojibake repair ──────────────────────────────────────────────────────
// Reverse a UTF-8 -> Windows-1252 mis-decode. Structural CSV bytes (commas,
// quotes, newlines) are ASCII (<0x80) and pass through untouched, so it's safe
// to run on the whole file before parsing.
const CP1252_REV = new Map([
  [0x20ac, 0x80], [0x201a, 0x82], [0x0192, 0x83], [0x201e, 0x84], [0x2026, 0x85],
  [0x2020, 0x86], [0x2021, 0x87], [0x02c6, 0x88], [0x2030, 0x89], [0x0160, 0x8a],
  [0x2039, 0x8b], [0x0152, 0x8c], [0x017d, 0x8e], [0x2018, 0x91], [0x2019, 0x92],
  [0x201c, 0x93], [0x201d, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97],
  [0x02dc, 0x98], [0x2122, 0x99], [0x0161, 0x9a], [0x203a, 0x9b], [0x0153, 0x9c],
  [0x017e, 0x9e], [0x0178, 0x9f],
]);

// True mojibake signatures only. We deliberately do NOT match `Ã`/`Â` followed
// by an ASCII letter, because "Âu" (Châu Âu = Europe), "Ân", "Ã"… are valid
// Vietnamese. Real mojibake has Ã/Â followed by a Latin-1 symbol/accented byte
// (Ã£, Ã©, Ãª, Â£, Â°, Â , …), or the unmistakable á»/áº/Æ°/Ä‘/â‚¬/â€ sequences.
const MOJIBAKE_RE = /[ÃÂ][ -ÿ]|á[º»]|Æ°|Ä‘|â€/;

function looksMojibaked(s) {
  return MOJIBAKE_RE.test(s);
}

function fixMojibakeOnce(s) {
  if (!s || !looksMojibaked(s)) return s;
  const chunks = [];
  for (const ch of s) {
    const cp = ch.codePointAt(0);
    if (cp <= 0xff) chunks.push(Buffer.from([cp]));
    else if (CP1252_REV.has(cp)) chunks.push(Buffer.from([CP1252_REV.get(cp)]));
    else chunks.push(Buffer.from(ch, 'utf8'));
  }
  const decoded = Buffer.concat(chunks).toString('utf8').normalize('NFC');
  // Reject the repair if it introduced replacement chars (a sign the source is
  // already clean UTF-8, or lossily encoded — leave it untouched in that case).
  const before = (s.match(/�/g) || []).length;
  const after = (decoded.match(/�/g) || []).length;
  return after > before ? s : decoded;
}

// Some exports are double-encoded (UTF-8 → cp1252 → UTF-8 → cp1252). Apply the
// repair repeatedly until the text no longer looks mojibaked or stops changing.
// Clean UTF-8 is left untouched (the guard above bails on the first pass).
function fixMojibake(s) {
  let cur = s.replace(/^﻿/, ''); // strip UTF-8 BOM if present
  for (let i = 0; i < 5 && looksMojibaked(cur); i++) {
    const next = fixMojibakeOnce(cur);
    if (next === cur) break;
    cur = next;
  }
  return cur;
}

// ── 2. Minimal RFC-4180 CSV parser ──────────────────────────────────────────
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  // Normalize line endings to \n; a quoted field may still contain \n.
  const s = text.replace(/\r\n?/g, '\n');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n') {
      row.push(field); rows.push(row); row = []; field = '';
    } else {
      field += c;
    }
  }
  // Flush trailing field/row (file may not end with newline).
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

// ── 3. Helpers ───────────────────────────────────────────────────────────────
function stripDiacritics(s) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D');
}

const EXCEL_ERRORS = new Set(["#NAME?","#REF!","#VALUE!","#N/A","#DIV/0!","#NULL!","#NUM!"]);

function trimOrNull(s) {
  if (s == null) return null;
  const t = String(s).replace(/ /g, " ").trim();
  if (!t.length || EXCEL_ERRORS.has(t)) return null;
  return t;
}

function normKey(s) {
  return stripDiacritics(String(s || '').toLowerCase())
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function slugify(s) {
  return stripDiacritics(String(s || '').toLowerCase())
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function detectLang(...parts) {
  const text = parts.filter(Boolean).join(' ');
  const hasViet = /[ăâđêôơưàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/i.test(text);
  const hasLatin = /[a-z]{3,}/i.test(stripDiacritics(text));
  if (hasViet && hasLatin) return 'mixed';
  if (hasViet) return 'vi';
  return 'en';
}

// ── 3a. Header detection (keyword -> canonical key) ──────────────────────────
function buildHeaderMap(headerRow) {
  const map = {};
  headerRow.forEach((h, i) => {
    const k = normKey(h);
    if (/^link$/.test(k) || (k.includes('link') && map.source_url == null)) map.source_url ??= i;
    else if (k.includes('slot') || k.includes('acceptance')) map.slots_raw ??= i;
    else if (k.includes('ranking')) map.ranking_note ??= i;
    else if (k.includes('loai hoc bong') || k.includes('merit based') || k.includes('merit')) map.funding_raw ??= i;
    else if (k.includes('doi tuong')) map.eligibility ??= i;
    else if (k.includes('truong ap dung')) map.applies_to_raw ??= i;
    else if (k.includes('thong tin') || k.includes('range tien')) map.value_raw ??= i;
    else if (k.includes('dieu kien')) map.conditions ??= i;
    else if (k.includes('thoi gian')) map.timing_raw ??= i;
    else if (k.includes('insight')) map.insight ??= i;
    else if (k.includes('ten hoc bong') || k === 'ten' || k.includes('name')) map.name ??= i;
  });
  // Positional fallback for the known 11-column layout if keyword match missed.
  const fallback = ['name', 'source_url', 'slots_raw', 'ranking_note', 'funding_raw',
    'eligibility', 'applies_to_raw', 'value_raw', 'conditions', 'timing_raw', 'insight'];
  fallback.forEach((key, i) => { if (map[key] == null && headerRow[i] != null) map[key] = i; });
  return map;
}

// ── 3b. Funding type normalization ───────────────────────────────────────────
const FUNDING_SYNONYMS = [
  [/merit|thanh tich|hoc luc|academic|excellence/, 'merit'],
  [/need|hoan canh|financial|tai chinh|equity|hardship|bursary/, 'need'],
  [/leader/, 'leadership'],
  [/research|nghien cuu|doctoral|phd|studentship/, 'research'],
  [/sport|the thao/, 'sport'],
  [/diversity|lgbt|women|female|nu gioi|inclusion|da dang|minority/, 'diversity'],
  [/regional|vung|khu vuc|asean|country|quoc gia|government|chinh phu/, 'regional'],
  [/development|phat trien/, 'regional'],
  [/full|toan phan|100%|toan bo/, 'full-ride'],
  [/partial|ban phan|mot phan/, 'partial'],
  [/travel|mobility|di chuyen|internship|thuc tap/, 'travel'],
];

function normalizeFunding(raw) {
  if (!raw) return [];
  const base = stripDiacritics(raw.toLowerCase());
  const fragments = base.split(/[&/,;+]|\bva\b|\band\b/).map((f) => f.trim()).filter(Boolean);
  const out = new Set();
  for (const frag of fragments) {
    let matched = false;
    for (const [re, token] of FUNDING_SYNONYMS) {
      if (re.test(frag)) { out.add(token); matched = true; }
    }
    if (!matched) out.add('other');
  }
  // If nothing concrete matched at all, scan the whole string once more.
  if (out.size === 0 || (out.size === 1 && out.has('other'))) {
    for (const [re, token] of FUNDING_SYNONYMS) if (re.test(base)) out.add(token);
  }
  return [...out].filter((t) => FUNDING_TYPES.includes(t));
}

// ── 3c. Scope + candidate-university extraction ──────────────────────────────
const CONSORTIUM_RE = /erasmus mundus|consortium|lien minh|joint (degree|master)/i;
const GOV_PROGRAMS = /fulbright|chevening|manaaki|australia awards|\baas\b|goi-ies|fellows programme|vanier|commonwealth|csfp|eiffel|france excellence|daad|mext|monbukagakusho|jasso|\bgks\b|\bcsc\b|vlir|\bsbw\b|great scholarship|erasmus/i;
// Phrases that describe a country/region rather than a specific school.
const GENERIC_APPLIES = /^(cac truong|any |all |bat ky|various|nhieu truong|the universities|cac co so)/i;

const COUNTRY_HINTS = [
  [/\(anh\)|united kingdom|\buk\b|vuong quoc anh/i, 'United Kingdom'],
  [/\(my\)|\(hoa ky\)|united states|\busa\b|hoa ky/i, 'United States'],
  [/\(uc\)|australia|\buc\b/i, 'Australia'],
  [/\(new zealand\)|new zealand/i, 'New Zealand'],
  [/\(ireland\)|ireland/i, 'Ireland'],
  [/\(canada\)|canada/i, 'Canada'],
  [/\(phap\)|france|\bphap\b/i, 'France'],
  [/\(duc\)|germany|\bduc\b/i, 'Germany'],
  [/\(nhat\)|japan|nhat ban/i, 'Japan'],
  [/\(bi\)|belgium/i, 'Belgium'],
  [/netherlands|ha lan/i, 'Netherlands'],
  [/korea|han quoc/i, 'South Korea'],
  [/china|trung quoc/i, 'China'],
];

function inferCountry(name, appliesTo) {
  const hay = stripDiacritics(`${name} ${appliesTo || ''}`.toLowerCase());
  for (const [re, country] of COUNTRY_HINTS) if (re.test(hay)) return country;
  return null;
}

function splitUniversityCandidates(appliesTo) {
  if (!appliesTo) return [];
  return appliesTo
    .split(/\n|;|·|•|•|^-\s|(?:^|\s)-\s|,(?=\s*(?:The )?(?:University|Trinity|Imperial|Monash))/im)
    .map((s) => s.replace(/^[\s\-•·*]+/, '').trim())
    .filter((s) => s.length > 2)
    .filter((s) => !GENERIC_APPLIES.test(stripDiacritics(s.toLowerCase())))
    // Drop lines that are clearly prose, not a school name.
    .filter((s) => s.length < 90)
    .slice(0, 30);
}

function detectScope(name, appliesTo) {
  const hay = `${name} ${appliesTo || ''}`;
  if (CONSORTIUM_RE.test(hay)) return { scope: 'consortium', candidates: [] };

  const candidates = splitUniversityCandidates(appliesTo);
  const appliesNorm = stripDiacritics((appliesTo || '').toLowerCase());
  const isGeneric = appliesTo ? GENERIC_APPLIES.test(appliesNorm) : true;
  const isGov = GOV_PROGRAMS.test(hay);
  const country = inferCountry(name, appliesTo);

  // Concrete school names listed -> university scope (even gov programs that
  // name eligible schools, e.g. Manaaki / Australia Awards).
  if (candidates.length && !isGeneric) return { scope: 'university', candidates };
  // Government/national programs, or anything we can pin to a country, are
  // country-scoped. Otherwise it's a provider/foundation award with no school.
  if (isGov || country) return { scope: 'country', candidates: [] };
  return { scope: 'provider', candidates: [] };
}

// ── 3d. Money / slots / deadline parsing ─────────────────────────────────────
const CURRENCY_SYMBOL = { '$': 'USD', '£': 'GBP', '€': 'EUR', '₫': 'VND', '¥': 'JPY' };
const CURRENCY_CODE_RE = /\b(USD|GBP|EUR|AUD|NZD|CAD|CHF|VND|JPY|SGD)\b/;

function parseMoney(text) {
  if (!text) return { amount_min: null, amount_max: null, amount_currency: null };
  let currency = null;
  const codeMatch = text.match(CURRENCY_CODE_RE);
  if (codeMatch) currency = codeMatch[1];
  else for (const [sym, code] of Object.entries(CURRENCY_SYMBOL)) if (text.includes(sym)) { currency = code; break; }
  if (!currency) return { amount_min: null, amount_max: null, amount_currency: null };

  // Grab number groups near a currency token. Accept comma/dot/space as
  // thousands separators; bail on decimals to stay conservative.
  const nums = [];
  const re = /([0-9]{1,3}(?:[.,\s][0-9]{3})+|[0-9]{4,})/g;
  let m;
  while ((m = re.exec(text)) && nums.length < 4) {
    const n = Number(m[1].replace(/[.,\s]/g, ''));
    if (Number.isFinite(n) && n >= 100) nums.push(n);
  }
  if (!nums.length) return { amount_min: null, amount_max: null, amount_currency: currency };
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  return { amount_min: min, amount_max: max === min ? null : max, amount_currency: currency };
}

function parseSlots(text) {
  if (!text) return { slots: null, slots_text: null };
  const cleaned = stripDiacritics(text.toLowerCase());
  // A leading/standalone count: "20", "~20", "5 slots", "200 slots", "1 slot".
  const m = cleaned.match(/(?:^|~|khoang\s*)(\d{1,4})\s*(?:slot|suat|\/|$|hoc bong)/);
  if (m) return { slots: Number(m[1]), slots_text: text.trim() };
  const lead = cleaned.match(/^~?(\d{1,4})\b/);
  if (lead) return { slots: Number(lead[1]), slots_text: text.trim() };
  return { slots: null, slots_text: text.trim() };
}

const MONTHS = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7,
  august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

function isoDate(y, mo, d) {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 2024 || y > 2032) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function parseDeadline(text) {
  if (!text) return null;
  const found = [];
  let m;
  // ISO
  const isoRe = /\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/g;
  while ((m = isoRe.exec(text))) { const d = isoDate(+m[1], +m[2], +m[3]); if (d) found.push(d); }
  // dd/mm/yyyy or dd.mm.yyyy
  const dmyRe = /\b(\d{1,2})[/.](\d{1,2})[/.](20\d{2})\b/g;
  while ((m = dmyRe.exec(text))) { const d = isoDate(+m[3], +m[2], +m[1]); if (d) found.push(d); }
  // "12 tháng 3 năm 2026" / "ngày 30/04/2026" handled above; VI month words:
  const viRe = /(\d{1,2})\s*tháng\s*(\d{1,2})\s*(?:năm\s*)?(20\d{2})/gi;
  while ((m = viRe.exec(text))) { const d = isoDate(+m[3], +m[2], +m[1]); if (d) found.push(d); }
  // "12 March 2026"
  const enRe1 = /\b(\d{1,2})\s+([A-Za-z]+)\s+(20\d{2})\b/g;
  while ((m = enRe1.exec(text))) { const mo = MONTHS[m[2].toLowerCase()]; if (mo) { const d = isoDate(+m[3], mo, +m[1]); if (d) found.push(d); } }
  // "March 12, 2026"
  const enRe2 = /\b([A-Za-z]+)\s+(\d{1,2}),?\s+(20\d{2})\b/g;
  while ((m = enRe2.exec(text))) { const mo = MONTHS[m[1].toLowerCase()]; if (mo) { const d = isoDate(+m[3], mo, +m[2]); if (d) found.push(d); } }
  if (!found.length) return null;
  // The deadline is the latest concrete date in the cell (open + close ranges).
  return found.sort().at(-1);
}

// ── 4. Row -> record ─────────────────────────────────────────────────────────
function buildRecord(row, hmap) {
  const get = (key) => (hmap[key] != null ? trimOrNull(row[hmap[key]]) : null);

  const name = get('name');
  if (!name) return null;

  let sourceUrl = get('source_url');
  let droppedUrl = null;
  if (sourceUrl) {
    try {
      const u = new URL(sourceUrl);
      if (!/^https?:$/.test(u.protocol)) throw new Error('non-http');
    } catch {
      droppedUrl = sourceUrl;
      sourceUrl = null;
    }
  }

  const fundingRaw = get('funding_raw');
  const appliesToText = get('applies_to_raw');
  const valueRaw = get('value_raw');
  const slotsRaw = get('slots_raw');
  const timingRaw = get('timing_raw');

  const { scope, candidates } = detectScope(name, appliesToText);
  const funding = normalizeFunding(fundingRaw);
  const money = parseMoney(valueRaw);
  const slots = parseSlots(slotsRaw);
  const country = scope === 'university' ? null : inferCountry(name, appliesToText);

  const eligibility = get('eligibility');
  const conditions = get('conditions');
  const insight = get('insight');

  const sourceKey = createHash('sha1')
    .update(`${normKey(name)}|${sourceUrl || ''}`)
    .digest('hex');

  const raw = {};
  if (droppedUrl) raw.source_url_original = droppedUrl;
  if (fundingRaw && funding.length === 0) raw.funding_type_original = fundingRaw;
  if (fundingRaw && (funding.length > 1 || funding[0] === 'other')) raw.funding_type_original = fundingRaw;

  return {
    source_key: sourceKey,
    name,
    slug: slugify(name),
    scope,
    country,
    provider: null, // curated later; provider name often == scholarship name
    funding_type: funding,
    coverage: valueRaw,
    amount_min: money.amount_min,
    amount_max: money.amount_max,
    amount_currency: money.amount_currency,
    slots: slots.slots,
    slots_text: slots.slots_text,
    eligibility,
    applies_to_text: appliesToText,
    conditions,
    insight,
    deadline_date: parseDeadline(timingRaw),
    deadline_text: timingRaw,
    source_url: sourceUrl,
    source_lang: detectLang(name, eligibility, insight, conditions),
    ranking_note: get('ranking_note'),
    raw,
    // Transport-only: resolved to university IDs by the loader.
    applies_to_candidates: candidates,
  };
}

// ── 5. Lightweight validation (Zod lives in src/lib/scholarships.ts) ─────────
function validate(rec) {
  const errs = [];
  if (!rec.name) errs.push('missing name');
  if (!SCOPES.includes(rec.scope)) errs.push(`bad scope ${rec.scope}`);
  for (const t of rec.funding_type) if (!FUNDING_TYPES.includes(t)) errs.push(`bad funding ${t}`);
  if (rec.source_lang && !['en', 'vi', 'mixed'].includes(rec.source_lang)) errs.push('bad lang');
  return errs;
}

// ── 6. Main ───────────────────────────────────────────────────────────────────
async function main() {
  let text;
  try {
    text = await readFile(INPUT, 'utf8');
  } catch {
    console.error(`✖ Could not read input CSV: ${INPUT}`);
    console.error('  Place your scholarships CSV there, or pass a path:');
    console.error('    node scripts/clean-scholarships.mjs path/to/file.csv');
    process.exit(1);
  }

  const fixed = fixMojibake(text);
  const rows = parseCsv(fixed).filter((r) => r.some((c) => c && c.trim()));
  if (!rows.length) { console.error('✖ No rows parsed.'); process.exit(1); }

  const header = rows[0];
  const hmap = buildHeaderMap(header);
  const dataRows = rows.slice(1);

  let droppedEmpty = 0;
  let droppedDupes = 0;
  const seen = new Set();
  const records = [];

  for (const row of dataRows) {
    const rec = buildRecord(row, hmap);
    if (!rec) { droppedEmpty++; continue; }
    const dedupeKey = `${normKey(rec.name)}|${normKey(rec.source_url || '')}`;
    if (seen.has(dedupeKey)) { droppedDupes++; continue; }
    seen.add(dedupeKey);
    const errs = validate(rec);
    if (errs.length) {
      console.error(`✖ Invalid record "${rec.name}": ${errs.join(', ')}`);
      process.exit(1);
    }
    records.push(rec);
  }

  await writeFile(OUTPUT, `${JSON.stringify(records, null, 2)}\n`, 'utf8');

  // ── Summary ──
  const byScope = records.reduce((acc, r) => ((acc[r.scope] = (acc[r.scope] || 0) + 1), acc), {});
  const withDeadline = records.filter((r) => r.deadline_date).length;
  const uniCandidates = records.reduce((n, r) => n + r.applies_to_candidates.length, 0);
  const garbled = records.filter((r) =>
    looksMojibaked(`${r.name} ${r.eligibility || ''} ${r.insight || ''}`)
    || /�/.test(`${r.name}${r.eligibility || ''}${r.insight || ''}`),
  ).length;

  console.log('Scholarships cleaned:');
  console.log(`  input rows (excl. header): ${dataRows.length}`);
  console.log(`  dropped empty:             ${droppedEmpty}`);
  console.log(`  dropped duplicates:        ${droppedDupes}`);
  console.log(`  written:                   ${records.length}`);
  console.log(`  by scope:                  ${JSON.stringify(byScope)}`);
  console.log(`  deadline_date parsed:      ${withDeadline}/${records.length}`);
  console.log(`  university candidates:     ${uniCandidates} (resolved to IDs by the loader)`);
  console.log(`  → ${path.relative(ROOT, OUTPUT)}`);

  if (garbled > 0) {
    console.warn('\n⚠  ' + `${garbled} record(s) still contain garbled/replacement characters.`);
    console.warn('   Your source CSV was likely saved with a lossy encoding (e.g. opened in');
    console.warn('   Excel and re-saved). Re-export it as UTF-8 and re-run this script.');
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
