#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const DEFAULT_CSV = 'tmp/university_image.xlsx - For Liên.csv';
const EXCLUDED_IDS = new Set([19, 99, 105, 6]);
const IMAGE_FIELDS = ['image_url', 'backup_image_url', 'logo_url'];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
}

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

function normalize(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed || trimmed.toLowerCase() === 'null' || trimmed === '—' || trimmed === '-') {
    return null;
  }
  return trimmed;
}

function isBlank(value) {
  return value == null || String(value).trim() === '';
}

function readCsv(content) {
  const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/);

  // The file has the column header followed by a photo-label row. Data starts
  // on the third line. The backup photo is column 6 in the source export.
  return lines.slice(2)
    .filter((line) => line.trim())
    .map(parseCsvLine)
    .filter((columns) => /^\d+$/.test(columns[0] ?? ''))
    .map((columns) => ({
      id: Number(columns[0]),
      name: normalize(columns[1]),
      country: normalize(columns[3]),
      image_url: normalize(columns[4]),
      backup_image_url: normalize(columns[5]),
      logo_url: normalize(columns[6]),
    }));
}

async function main() {
  const csvPath = resolve(process.cwd(), process.argv[2] || DEFAULT_CSV);
  const rows = readCsv(await readFile(csvPath, 'utf8'));
  const ids = rows.map((row) => row.id);
  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: existing, error: loadError } = await supabase
    .from('universities')
    .select('id, name, country, image_url, backup_image_url, logo_url')
    .in('id', ids);

  if (loadError) {
    if (/backup_image_url|column/i.test(loadError.message)) {
      throw new Error(
        'Column backup_image_url is missing. Run supabase-university-images.sql first.',
      );
    }
    throw loadError;
  }

  const byId = new Map((existing ?? []).map((row) => [Number(row.id), row]));
  const stats = {
    csvRows: rows.length,
    excluded: 0,
    missingDbRow: 0,
    nameMismatch: 0,
    updatedRows: 0,
    updatedFields: 0,
    preservedFields: 0,
    warnings: [],
  };

  for (const row of rows) {
    if (EXCLUDED_IDS.has(row.id)) {
      stats.excluded += 1;
      continue;
    }

    const current = byId.get(row.id);
    if (!current) {
      stats.missingDbRow += 1;
      continue;
    }

    if (current.name !== row.name || current.country !== row.country) {
      stats.nameMismatch += 1;
      stats.warnings.push(`ID ${row.id}: CSV name/country does not match DB`);
      continue;
    }

    const patch = {};
    for (const field of IMAGE_FIELDS) {
      const incoming = row[field];
      if (!incoming) continue;

      // POSTECH's export has its campus image copied into logo_url. Keep the
      // existing logo untouched until a real logo URL is supplied.
      if (field === 'logo_url' && incoming === row.image_url) {
        stats.warnings.push(`ID ${row.id}: ignored logo_url identical to image_url`);
        continue;
      }

      if (isBlank(current[field])) {
        patch[field] = incoming;
      } else {
        stats.preservedFields += 1;
      }
    }

    if (Object.keys(patch).length === 0) continue;

    const { error: updateError } = await supabase
      .from('universities')
      .update(patch)
      .eq('id', row.id);

    if (updateError) throw new Error(`ID ${row.id}: ${updateError.message}`);

    stats.updatedRows += 1;
    stats.updatedFields += Object.keys(patch).length;
  }

  const { data: verified, error: verifyError } = await supabase
    .from('universities')
    .select('id, image_url, backup_image_url, logo_url')
    .in('id', ids);

  if (verifyError) throw verifyError;

  const excludedChanged = (verified ?? []).filter((row) => {
    if (!EXCLUDED_IDS.has(Number(row.id))) return false;
    const before = byId.get(Number(row.id));
    return IMAGE_FIELDS.some((field) => (before?.[field] ?? null) !== (row[field] ?? null));
  });
  if (excludedChanged.length > 0) {
    throw new Error('Verification failed: an excluded university changed.');
  }

  console.log(JSON.stringify({
    ...stats,
    verifiedRows: verified?.length ?? 0,
    excludedIds: [...EXCLUDED_IDS],
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
