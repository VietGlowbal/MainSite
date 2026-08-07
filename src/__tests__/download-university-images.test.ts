// @vitest-environment node

import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import sharp from 'sharp';
import { afterEach, describe, expect, test } from 'vitest';

const execFileAsync = promisify(execFile);
const temporaryDirectories: string[] = [];
const scriptPath = resolve(process.cwd(), 'scripts/download-university-images.mjs');
const publicBaseUrl = 'https://example.supabase.co/storage/v1/object/public/university-images';

async function makeWorkspace() {
  const directory = await mkdtemp(join(tmpdir(), 'glowbal-university-images-'));
  temporaryDirectories.push(directory);
  return directory;
}

async function runDownloader(input: string, output: string) {
  return execFileAsync(
    process.execPath,
    [
      scriptPath,
      '--input',
      input,
      '--output',
      output,
      '--public-base-url',
      publicBaseUrl,
      '--concurrency',
      '1',
    ],
    { cwd: process.cwd() },
  );
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe('download-university-images', () => {
  test('rasterizes SVG logos to a Next Image-safe 512px WebP', async () => {
    const workspace = await makeWorkspace();
    const input = join(workspace, 'universities.csv');
    const output = join(workspace, 'output');
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40"><rect width="80" height="40" fill="#e51b46"/></svg>',
    ).toString('base64');
    await writeFile(
      input,
      `id,name,local_name,country,image_url,logo_url\n1,Test University,,Testland,,"data:image/svg+xml;base64,${svg}"\n`,
      'utf8',
    );

    await runDownloader(input, output);

    const logoPath = join(output, 'universities', '00001-test-university', 'logo.webp');
    const metadata = await sharp(await readFile(logoPath)).metadata();
    const sql = await readFile(join(output, 'update-university-image-urls.sql'), 'utf8');
    expect(metadata.format).toBe('webp');
    expect(metadata.width).toBe(512);
    expect(metadata.height).toBe(512);
    expect(sql).toContain('/logo.webp');
    expect(sql).not.toContain('/logo.svg');
  });

  test('writes valid no-op SQL when no asset URL is usable', async () => {
    const workspace = await makeWorkspace();
    const input = join(workspace, 'universities.csv');
    const output = join(workspace, 'output');
    await writeFile(
      input,
      'id,name,local_name,country,image_url,logo_url\n1,No Assets University,,Testland,,\n',
      'utf8',
    );

    await runDownloader(input, output);

    const sql = await readFile(join(output, 'update-university-image-urls.sql'), 'utf8');
    expect(sql).toContain('select null::text as id');
    expect(sql).toContain('where false');
    expect(sql).not.toMatch(/\(\s*values\s*\)/);
  });
});
