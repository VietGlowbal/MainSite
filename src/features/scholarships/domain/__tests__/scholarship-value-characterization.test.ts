import { execFile as execFileCallback } from 'node:child_process';
import { copyFile, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execFile = promisify(execFileCallback);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
const cleanerSource = path.join(repoRoot, 'scripts', 'clean-scholarships.mjs');

type CleanedRecord = {
  name: string;
  coverage: string | null;
  funding_type: string[];
  amount_min: number | null;
  amount_max: number | null;
  amount_currency: string | null;
  deadline_date: string | null;
  [key: string]: unknown;
};

const headers = [
  'Name',
  'Link',
  'Slots',
  'Ranking',
  'Funding type',
  'Eligibility',
  'Applies to',
  'Scholarship value',
  'Conditions',
  'Timing',
  'Insight',
];

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function csv(rows: string[][]): string {
  return [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\n') + '\n';
}

async function cleanFixture(rows: string[][]): Promise<CleanedRecord[]> {
  const tempRoot = await mkdtemp(path.join(tmpdir(), 'glowbal-scholarship-t0-'));
  const tempScripts = path.join(tempRoot, 'scripts');
  const tempData = path.join(tempRoot, 'data');
  const input = path.join(tempRoot, 'input.csv');

  try {
    await mkdir(tempScripts);
    await mkdir(tempData);
    await copyFile(cleanerSource, path.join(tempScripts, 'clean-scholarships.mjs'));
    await writeFile(input, csv(rows), 'utf8');

    await execFile(process.execPath, [path.join(tempScripts, 'clean-scholarships.mjs'), input], {
      cwd: tempRoot,
      encoding: 'utf8',
    });

    return JSON.parse(
      await readFile(path.join(tempData, 'scholarships.json'), 'utf8'),
    ) as CleanedRecord[];
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

function row(name: string, funding: string, value: string): string[] {
  return [
    name,
    `https://example.test/${name.toLowerCase().replaceAll(' ', '-')}`,
    '',
    '',
    funding,
    'International students',
    '',
    value,
    '',
    '',
    '',
  ];
}

describe('scholarship cleaner value characterization', () => {
  it('freezes current parsing for benefit, amount, range, currency, and duration cases', async () => {
    const records = await cleanFixture([
      row('50 percent tuition', 'Merit-based', '50% tuition'),
      row('100 percent tuition', '100% tuition', '100% tuition'),
      row('full tuition', 'Merit-based', 'Full tuition'),
      row('full ride', 'Full ride', 'Full ride'),
      row('fully funded', 'Fully funded', 'Fully funded'),
      row('tuition plus living', 'Merit-based', 'Full tuition + living allowance'),
      row('tuition plus accommodation', 'Merit-based', 'Full tuition + accommodation'),
      row('monthly stipend', 'Merit-based', 'Full tuition + $2,000/month stipend'),
      row('fixed amount', 'Merit-based', '$20,000'),
      row('amount range', 'Merit-based', '$10,000–$20,000'),
      row('annual times years', 'Merit-based', '£30,000/year × 3 years'),
      row('monthly times months', 'Merit-based', '$5,000/month × 12 months'),
      row('unknown currency', 'Merit-based', 'RMB 20,000'),
    ]);
    const byName = new Map(records.map((record) => [record.name, record]));

    expect(byName.get('50 percent tuition')).toMatchObject({
      coverage: '50% tuition',
      amount_min: null,
      amount_max: null,
      amount_currency: null,
    });

    // T1 regression: a funding string containing 100% must not be classified
    // as full-ride. The old cleaner did this before benefit normalization.
    expect(byName.get('100 percent tuition')?.funding_type).not.toContain('full-ride');
    expect(byName.get('100 percent tuition')?.coverage).toBe('100% tuition');

    expect(byName.get('full tuition')).toMatchObject({
      coverage: 'Full tuition',
      amount_min: null,
      amount_max: null,
    });
    expect(byName.get('full ride')?.funding_type).toContain('full-ride');
    expect(byName.get('fully funded')?.funding_type).not.toContain('full-ride');

    expect(byName.get('tuition plus living')).toMatchObject({
      coverage: 'Full tuition + living allowance',
      amount_min: null,
      amount_max: null,
    });
    expect(byName.get('tuition plus accommodation')).toMatchObject({
      coverage: 'Full tuition + accommodation',
      amount_min: null,
      amount_max: null,
    });

    expect(byName.get('monthly stipend')).toMatchObject({
      coverage: 'Full tuition + $2,000/month stipend',
      amount_min: 2_000,
      amount_max: null,
      amount_currency: 'USD',
    });

    expect(byName.get('fixed amount')).toMatchObject({
      amount_min: 20_000,
      amount_max: null,
      amount_currency: 'USD',
    });
    expect(byName.get('amount range')).toMatchObject({
      amount_min: 10_000,
      amount_max: 20_000,
      amount_currency: 'USD',
    });

    const annual = byName.get('annual times years')!;
    expect(annual).toMatchObject({
      amount_min: 30_000,
      amount_max: null,
      amount_currency: 'GBP',
    });

    const monthly = byName.get('monthly times months')!;
    expect(monthly).toMatchObject({
      amount_min: 5_000,
      amount_max: null,
      amount_currency: 'USD',
    });

    // Current bug: annual/monthly semantics and duration are discarded.
    expect(annual).not.toHaveProperty('duration');
    expect(annual).not.toHaveProperty('period');
    expect(monthly).not.toHaveProperty('duration');
    expect(monthly).not.toHaveProperty('period');

    // Current behavior: unsupported currency text is not monetized.
    expect(byName.get('unknown currency')).toMatchObject({
      amount_min: null,
      amount_max: null,
      amount_currency: null,
    });
  });
});
