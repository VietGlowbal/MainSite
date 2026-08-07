#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { access, mkdir, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import sharp from 'sharp';

const DEFAULT_INPUT = join(
  homedir(),
  'Downloads',
  'glowbal',
  'Link ảnh các đại học - For Liên.csv',
);
const DEFAULT_BUCKET = 'university-images';
const DEFAULT_CONCURRENCY = 6;
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_RETRIES = 2;
const DEFAULT_CAMPUS_WIDTH = 1520;
const DEFAULT_CAMPUS_HEIGHT = 800;
const DEFAULT_LOGO_SIZE = 512;
const DEFAULT_WEBP_QUALITY = 80;
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const HOST_MIN_INTERVAL_MS = 250;
const hostNextRequestAt = new Map();

const ASSET_DEFINITIONS = [
  { key: 'image', label: 'ảnh chính' },
  { key: 'image_backup', label: 'ảnh dự phòng' },
  { key: 'logo', label: 'logo' },
];

function printHelp() {
  console.log(`
Tải ảnh đại học từ CSV và tạo manifest để map sang Supabase Storage.

Cách dùng:
  npm run download:university-images -- [options]

Options:
  --input <path>             CSV đầu vào
  --output <path>            Thư mục đầu ra (mặc định: cạnh file CSV)
  --bucket <name>            Bucket Supabase (mặc định: ${DEFAULT_BUCKET})
  --supabase-url <url>       Project URL; mặc định đọc NEXT_PUBLIC_SUPABASE_URL
  --public-base-url <url>    Ghi đè base URL public của bucket
  --concurrency <n>          Số download song song (mặc định: ${DEFAULT_CONCURRENCY})
  --timeout-ms <n>           Timeout mỗi lần tải (mặc định: ${DEFAULT_TIMEOUT_MS})
  --retries <n>              Số lần thử lại sau lần đầu (mặc định: ${DEFAULT_RETRIES})
  --campus-width <px>        Rộng ảnh campus sau chuẩn hóa (mặc định: ${DEFAULT_CAMPUS_WIDTH})
  --campus-height <px>       Cao ảnh campus sau chuẩn hóa (mặc định: ${DEFAULT_CAMPUS_HEIGHT})
  --logo-size <px>           Khung vuông logo raster (mặc định: ${DEFAULT_LOGO_SIZE})
  --quality <1-100>          Chất lượng WebP (mặc định: ${DEFAULT_WEBP_QUALITY})
  --no-optimize              Giữ nguyên bytes/định dạng ảnh nguồn
  --limit <n>                Chỉ xử lý n trường đầu tiên
  --force                    Tải lại kể cả khi file đã tồn tại
  --dry-run                  Chỉ kiểm tra CSV và in kế hoạch
  --help                     Hiện trợ giúp

Ví dụ:
  npm run download:university-images
  npm run download:university-images -- --bucket university-images --force
`);
}

function parseCli(argv) {
  const { values } = parseArgs({
    args: argv,
    strict: true,
    allowPositionals: false,
    options: {
      input: { type: 'string' },
      output: { type: 'string' },
      bucket: { type: 'string' },
      'supabase-url': { type: 'string' },
      'public-base-url': { type: 'string' },
      concurrency: { type: 'string' },
      'timeout-ms': { type: 'string' },
      retries: { type: 'string' },
      'campus-width': { type: 'string' },
      'campus-height': { type: 'string' },
      'logo-size': { type: 'string' },
      quality: { type: 'string' },
      'no-optimize': { type: 'boolean', default: false },
      limit: { type: 'string' },
      force: { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });

  if (values.help) return { help: true };

  const inputPath = resolve(values.input ?? DEFAULT_INPUT);
  const outputPath = resolve(
    values.output ?? join(dirname(inputPath), 'university-images'),
  );
  const bucket = (values.bucket ?? process.env.UNIVERSITY_IMAGES_BUCKET ?? DEFAULT_BUCKET).trim();
  const supabaseUrl = (
    values['supabase-url'] ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.SUPABASE_URL ??
    ''
  ).replace(/\/+$/, '');
  const publicBaseUrl = (
    values['public-base-url'] ??
    (supabaseUrl
      ? `${supabaseUrl}/storage/v1/object/public/${encodeURIComponent(bucket)}`
      : '')
  ).replace(/\/+$/, '');

  return {
    help: false,
    inputPath,
    outputPath,
    bucket,
    publicBaseUrl,
    concurrency: positiveInteger(values.concurrency, DEFAULT_CONCURRENCY, 'concurrency'),
    timeoutMs: positiveInteger(values['timeout-ms'], DEFAULT_TIMEOUT_MS, 'timeout-ms'),
    retries: nonNegativeInteger(values.retries, DEFAULT_RETRIES, 'retries'),
    campusWidth: positiveInteger(values['campus-width'], DEFAULT_CAMPUS_WIDTH, 'campus-width'),
    campusHeight: positiveInteger(values['campus-height'], DEFAULT_CAMPUS_HEIGHT, 'campus-height'),
    logoSize: positiveInteger(values['logo-size'], DEFAULT_LOGO_SIZE, 'logo-size'),
    quality: boundedInteger(values.quality, DEFAULT_WEBP_QUALITY, 'quality', 1, 100),
    optimize: !values['no-optimize'],
    limit: values.limit ? positiveInteger(values.limit, null, 'limit') : null,
    force: values.force,
    dryRun: values['dry-run'],
  };
}

function boundedInteger(value, fallback, name, min, max) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`--${name} phải là số nguyên từ ${min} đến ${max}.`);
  }
  return parsed;
}

function positiveInteger(value, fallback, name) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`--${name} phải là số nguyên dương.`);
  }
  return parsed;
}

function nonNegativeInteger(value, fallback, name) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`--${name} phải là số nguyên không âm.`);
  }
  return parsed;
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];

    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"' && field.length === 0) {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[index + 1] === '\n') index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (quoted) throw new Error('CSV không hợp lệ: thiếu dấu ngoặc kép đóng.');
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function findHeaderIndex(headers, expected) {
  return headers.findIndex((header) => header.trim().toLowerCase() === expected);
}

export function readUniversities(csvRows) {
  if (csvRows.length < 2) throw new Error('CSV không có đủ header và dữ liệu.');

  const headers = csvRows[0].map((value) => value.trim());
  const idIndex = findHeaderIndex(headers, 'id');
  const nameIndex = findHeaderIndex(headers, 'name');
  const localNameIndex = findHeaderIndex(headers, 'local_name');
  const countryIndex = findHeaderIndex(headers, 'country');
  const imageIndex = findHeaderIndex(headers, 'image_url');
  const logoIndex = findHeaderIndex(headers, 'logo_url');

  if ([idIndex, nameIndex, imageIndex, logoIndex].some((index) => index < 0)) {
    throw new Error('CSV phải có các cột id, name, image_url và logo_url.');
  }

  const labelRow = csvRows[1] ?? [];
  let backupIndex = labelRow.findIndex(
    (value) => value.trim().toLowerCase() === 'backup photo',
  );
  if (backupIndex < 0) {
    backupIndex = headers.findIndex(
      (value, index) => !value && index > imageIndex && index < logoIndex,
    );
  }

  const universities = [];
  for (let index = 1; index < csvRows.length; index += 1) {
    const values = csvRows[index];
    const id = (values[idIndex] ?? '').trim();
    const name = (values[nameIndex] ?? '').trim();
    if (!id || !name) continue;

    universities.push({
      csvRow: index + 1,
      id,
      name,
      localName: localNameIndex >= 0 ? (values[localNameIndex] ?? '').trim() : '',
      country: countryIndex >= 0 ? (values[countryIndex] ?? '').trim() : '',
      sources: {
        image: cleanSourceUrl(values[imageIndex]),
        image_backup: backupIndex >= 0 ? cleanSourceUrl(values[backupIndex]) : '',
        logo: cleanSourceUrl(values[logoIndex]),
      },
    });
  }

  if (universities.length === 0) {
    throw new Error('Không tìm thấy row đại học hợp lệ trong CSV.');
  }

  return universities;
}

function cleanSourceUrl(value) {
  const source = String(value ?? '').trim();
  return ['', 'null', 'n/a', 'na', '-'].includes(source.toLowerCase()) ? '' : source;
}

export function slugify(value) {
  const slug = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  return slug || 'university';
}

function idSegment(id) {
  if (/^\d+$/.test(id)) return id.padStart(5, '0');
  return slugify(id);
}

function assetStem(university, assetKey) {
  const folder = `universities/${idSegment(university.id)}-${slugify(university.name)}`;
  const fileStem = assetKey === 'image_backup' ? 'image-backup' : assetKey;
  return `${folder}/${fileStem}`;
}

function contentTypeExtension(contentType) {
  const normalized = contentType.split(';', 1)[0].trim().toLowerCase();
  return {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
    'image/avif': 'avif',
    'image/bmp': 'bmp',
    'image/tiff': 'tiff',
    'image/x-icon': 'ico',
    'image/vnd.microsoft.icon': 'ico',
  }[normalized];
}

function magicExtension(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpg';
  }
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) {
    return 'png';
  }
  if (buffer.length >= 6 && ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'))) {
    return 'gif';
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'webp';
  }
  if (buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from([0, 0, 1, 0]))) {
    return 'ico';
  }
  if (buffer.length >= 2 && buffer.subarray(0, 2).toString('ascii') === 'BM') return 'bmp';
  if (
    buffer.length >= 4 &&
    ['49492a00', '4d4d002a'].includes(buffer.subarray(0, 4).toString('hex'))
  ) {
    return 'tiff';
  }
  if (buffer.length >= 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = buffer.subarray(8, 12).toString('ascii');
    if (['avif', 'avis'].includes(brand)) return 'avif';
  }

  const prefix = buffer.subarray(0, 1024).toString('utf8').trimStart().toLowerCase();
  if (prefix.startsWith('<svg') || (prefix.startsWith('<?xml') && prefix.includes('<svg'))) {
    return 'svg';
  }
  return null;
}

function safeUrlExtension(url) {
  try {
    const candidate = extname(new URL(url).pathname).slice(1).toLowerCase();
    if (!['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'avif', 'bmp', 'tif', 'tiff', 'ico'].includes(candidate)) {
      return null;
    }
    if (candidate === 'jpeg') return 'jpg';
    if (candidate === 'tif') return 'tiff';
    return candidate;
  } catch {
    return null;
  }
}

async function findExistingFile(outputPath, stem) {
  const directory = join(outputPath, dirname(stem));
  const prefix = `${basename(stem)}.`;
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const match = entries.find((entry) => entry.isFile() && entry.name.startsWith(prefix));
    return match ? join(directory, match.name) : null;
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function sleep(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

async function waitForHostSlot(url) {
  let host;
  try {
    host = new URL(url).host.toLowerCase();
  } catch {
    return;
  }

  const now = Date.now();
  const scheduledAt = Math.max(now, hostNextRequestAt.get(host) ?? now);
  hostNextRequestAt.set(host, scheduledAt + HOST_MIN_INTERVAL_MS);
  if (scheduledAt > now) await sleep(scheduledAt - now);
}

function retryAfterMilliseconds(value) {
  if (!value) return 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? 0 : Math.max(0, date - Date.now());
}

async function fetchImage(url, { timeoutMs, retries }) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      await waitForHostSlot(url);
      const referer = (() => {
        try {
          return `${new URL(url).origin}/`;
        } catch {
          return undefined;
        }
      })();
      const response = await fetch(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          ...(referer ? { Referer: referer } : {}),
          'User-Agent': 'GlowbalUniversityImageImporter/1.0 (https://glowbal-education.com)',
        },
      });
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`);
        error.retryAfterMs = retryAfterMilliseconds(response.headers.get('retry-after'));
        error.retryable = response.status === 429 || response.status >= 500;
        throw error;
      }

      const declaredLength = Number(response.headers.get('content-length') ?? 0);
      if (declaredLength > MAX_IMAGE_BYTES) {
        throw new Error(`file lớn hơn ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)} MB`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length === 0) throw new Error('response rỗng');
      if (buffer.length > MAX_IMAGE_BYTES) {
        throw new Error(`file lớn hơn ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)} MB`);
      }

      const contentType = response.headers.get('content-type') ?? '';
      const extension =
        magicExtension(buffer) ?? contentTypeExtension(contentType) ?? safeUrlExtension(response.url);
      if (!extension || (!contentType.startsWith('image/') && !magicExtension(buffer))) {
        throw new Error(`response không phải ảnh (${contentType || 'unknown content-type'})`);
      }

      return {
        buffer,
        extension,
        contentType: contentType.split(';', 1)[0] || `image/${extension}`,
        finalUrl: response.url,
      };
    } catch (error) {
      lastError = error;
      if (attempt < retries && error.retryable !== false) {
        const backoff = error.message === 'HTTP 429' ? 2_000 * 2 ** attempt : 500 * 2 ** attempt;
        await sleep(Math.max(backoff, error.retryAfterMs ?? 0));
      } else if (error.retryable === false) {
        break;
      }
    }
  }
  throw lastError;
}

function toPosix(path) {
  return path.replaceAll('\\', '/');
}

function publicUrlFor(publicBaseUrl, storagePath) {
  if (!publicBaseUrl) return '';
  return `${publicBaseUrl}/${storagePath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')}`;
}

async function existingFileMetadata(filePath, outputPath, publicBaseUrl) {
  const data = await readFile(filePath);
  const storagePath = toPosix(relative(outputPath, filePath));
  const extension = extname(filePath).slice(1).toLowerCase();
  const dimensions = await readDimensions(data);
  return {
    status: 'existing',
    error: '',
    sourceFinalUrl: '',
    localPath: storagePath,
    storagePath,
    publicUrl: publicUrlFor(publicBaseUrl, storagePath),
    contentType: contentTypeForExtension(extension),
    optimized: extension === 'webp' || extension === 'svg' ? 'yes' : 'unknown',
    sourceBytes: '',
    sourceWidth: '',
    sourceHeight: '',
    outputWidth: dimensions.width,
    outputHeight: dimensions.height,
    bytes: data.length,
    sha256: createHash('sha256').update(data).digest('hex'),
  };
}

async function readDimensions(buffer) {
  try {
    const metadata = await sharp(buffer, { animated: true }).metadata();
    return { width: metadata.width ?? '', height: metadata.height ?? '' };
  } catch {
    return { width: '', height: '' };
  }
}

async function normalizeImage(image, assetKey, options) {
  const sourceDimensions = await readDimensions(image.buffer);
  const source = {
    sourceBytes: image.buffer.length,
    sourceWidth: sourceDimensions.width,
    sourceHeight: sourceDimensions.height,
  };

  if (!options.optimize || (assetKey === 'logo' && image.extension === 'svg')) {
    return {
      ...image,
      ...source,
      optimized: options.optimize ? 'vector-preserved' : 'no',
      outputWidth: sourceDimensions.width,
      outputHeight: sourceDimensions.height,
    };
  }

  const pipeline = sharp(image.buffer, { animated: true }).rotate();
  const resized =
    assetKey === 'logo'
      ? pipeline.resize(options.logoSize, options.logoSize, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
      : pipeline.resize(options.campusWidth, options.campusHeight, {
          fit: 'cover',
          position: 'centre',
        });
  const { data, info } = await resized
    .webp({ quality: options.quality, alphaQuality: 90, effort: 4, smartSubsample: true })
    .toBuffer({ resolveWithObject: true });

  return {
    ...image,
    ...source,
    buffer: data,
    extension: 'webp',
    contentType: 'image/webp',
    optimized: 'yes',
    outputWidth: info.width,
    outputHeight: info.height,
  };
}

async function removeOtherAssetVariants(outputPath, stem, targetPath) {
  const directory = join(outputPath, dirname(stem));
  const prefix = `${basename(stem)}.`;
  const entries = await readdir(directory, { withFileTypes: true });
  await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.startsWith(prefix))
      .map((entry) => join(directory, entry.name))
      .filter((filePath) => resolve(filePath) !== resolve(targetPath))
      .map((filePath) => unlink(filePath)),
  );
}

function contentTypeForExtension(extension) {
  return {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    avif: 'image/avif',
    bmp: 'image/bmp',
    tiff: 'image/tiff',
    ico: 'image/x-icon',
  }[extension] ?? '';
}

async function downloadAsset(task, options) {
  const { university, assetKey, sourceUrl } = task;
  const stem = assetStem(university, assetKey);

  if (!options.force) {
    const existing = await findExistingFile(options.outputPath, stem);
    if (existing) {
      return {
        ...task,
        ...(await existingFileMetadata(existing, options.outputPath, options.publicBaseUrl)),
      };
    }
  }

  try {
    const fetchedImage = await fetchImage(sourceUrl, options);
    const image = await normalizeImage(fetchedImage, assetKey, options);
    const storagePath = `${stem}.${image.extension}`;
    const targetPath = join(options.outputPath, storagePath);
    await mkdir(dirname(targetPath), { recursive: true });

    const tempPath = `${targetPath}.tmp-${process.pid}-${Math.random().toString(16).slice(2)}`;
    await writeFile(tempPath, image.buffer);
    await rename(tempPath, targetPath);
    if (options.force) {
      await removeOtherAssetVariants(options.outputPath, stem, targetPath);
    }

    return {
      ...task,
      status: 'downloaded',
      error: '',
      sourceFinalUrl: image.finalUrl,
      localPath: storagePath,
      storagePath,
      publicUrl: publicUrlFor(options.publicBaseUrl, storagePath),
      contentType: image.contentType,
      optimized: image.optimized,
      sourceBytes: image.sourceBytes,
      sourceWidth: image.sourceWidth,
      sourceHeight: image.sourceHeight,
      outputWidth: image.outputWidth,
      outputHeight: image.outputHeight,
      bytes: image.buffer.length,
      sha256: createHash('sha256').update(image.buffer).digest('hex'),
    };
  } catch (error) {
    return {
      ...task,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
      sourceFinalUrl: '',
      localPath: '',
      storagePath: '',
      publicUrl: '',
      contentType: '',
      optimized: '',
      sourceBytes: '',
      sourceWidth: '',
      sourceHeight: '',
      outputWidth: '',
      outputHeight: '',
      bytes: '',
      sha256: '',
    };
  }
}

async function mapWithConcurrency(items, concurrency, mapper, onProgress) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      results[index] = await mapper(items[index], index);
      onProgress?.(results[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return results;
}

function csvCell(value) {
  const stringValue = value === null || value === undefined ? '' : String(value);
  if (/[",\r\n]/.test(stringValue)) return `"${stringValue.replaceAll('"', '""')}"`;
  return stringValue;
}

function createCsv(headers, rows) {
  return `\uFEFF${[
    headers.map(csvCell).join(','),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(',')),
  ].join('\r\n')}\r\n`;
}

function resultFor(resultMap, universityId, assetKey) {
  return resultMap.get(`${universityId}:${assetKey}`) ?? null;
}

function isAvailable(result) {
  return result && ['downloaded', 'existing'].includes(result.status);
}

function sqlString(value) {
  if (!value) return 'null';
  return `'${String(value).replaceAll("'", "''")}'`;
}

function createUpdateSql(rows, bucket) {
  const usableRows = rows.filter((row) => row.image_url || row.logo_url);
  const values = usableRows
    .map(
      (row) =>
        `    (${sqlString(row.id)}, ${sqlString(row.image_url)}, ${sqlString(row.logo_url)})`,
    )
    .join(',\n');

  return `-- Generated by scripts/download-university-images.mjs
-- Bucket: ${bucket}
-- Chỉ thay cột có URL tải thành công; URL rỗng không ghi đè dữ liệu hiện tại.

begin;

with image_data(id, image_url, logo_url) as (
  values
${values}
)
update public.universities as university
set
  image_url = coalesce(image_data.image_url, university.image_url),
  logo_url = coalesce(image_data.logo_url, university.logo_url),
  images_resolved_at = now()
from image_data
where university.id::text = image_data.id;

commit;
`;
}

async function writeReports(universities, results, options) {
  const resultMap = new Map(
    results.map((result) => [`${result.university.id}:${result.assetKey}`, result]),
  );

  const manifestHeaders = [
    'csv_row',
    'id',
    'name',
    'local_name',
    'country',
    'asset_type',
    'source_url',
    'source_final_url',
    'status',
    'error',
    'local_path',
    'storage_path',
    'supabase_public_url',
    'content_type',
    'optimized',
    'source_bytes',
    'source_width',
    'source_height',
    'output_width',
    'output_height',
    'bytes',
    'sha256',
  ];
  const manifestRows = results.map((result) => ({
    csv_row: result.university.csvRow,
    id: result.university.id,
    name: result.university.name,
    local_name: result.university.localName,
    country: result.university.country,
    asset_type: result.assetKey,
    source_url: result.sourceUrl,
    source_final_url: result.sourceFinalUrl,
    status: result.status,
    error: result.error,
    local_path: result.localPath,
    storage_path: result.storagePath,
    supabase_public_url: result.publicUrl,
    content_type: result.contentType,
    optimized: result.optimized,
    source_bytes: result.sourceBytes,
    source_width: result.sourceWidth,
    source_height: result.sourceHeight,
    output_width: result.outputWidth,
    output_height: result.outputHeight,
    bytes: result.bytes,
    sha256: result.sha256,
  }));

  const readyHeaders = [
    'id',
    'name',
    'local_name',
    'country',
    'image_selected_from',
    'image_url',
    'logo_url',
    'image_backup_url',
    'image_storage_path',
    'logo_storage_path',
    'image_backup_storage_path',
    'image_status',
    'logo_status',
    'image_backup_status',
  ];
  const readyRows = universities.map((university) => {
    const image = resultFor(resultMap, university.id, 'image');
    const backup = resultFor(resultMap, university.id, 'image_backup');
    const logo = resultFor(resultMap, university.id, 'logo');
    const selectedImage = isAvailable(image) ? image : isAvailable(backup) ? backup : null;
    return {
      id: university.id,
      name: university.name,
      local_name: university.localName,
      country: university.country,
      image_selected_from:
        selectedImage === image ? 'image_url' : selectedImage === backup ? 'backup_photo' : '',
      image_url: selectedImage?.publicUrl ?? '',
      logo_url: isAvailable(logo) ? logo.publicUrl : '',
      image_backup_url: isAvailable(backup) ? backup.publicUrl : '',
      image_storage_path: selectedImage?.storagePath ?? '',
      logo_storage_path: isAvailable(logo) ? logo.storagePath : '',
      image_backup_storage_path: isAvailable(backup) ? backup.storagePath : '',
      image_status: image?.status ?? 'missing_source',
      logo_status: logo?.status ?? 'missing_source',
      image_backup_status: backup?.status ?? 'missing_source',
    };
  });

  await mkdir(options.outputPath, { recursive: true });
  await writeFile(
    join(options.outputPath, 'download-manifest.csv'),
    createCsv(manifestHeaders, manifestRows),
    'utf8',
  );
  await writeFile(
    join(options.outputPath, 'universities-ready-for-supabase.csv'),
    createCsv(readyHeaders, readyRows),
    'utf8',
  );
  await writeFile(
    join(options.outputPath, 'download-manifest.json'),
    `${JSON.stringify(manifestRows, null, 2)}\n`,
    'utf8',
  );

  if (options.publicBaseUrl) {
    await writeFile(
      join(options.outputPath, 'update-university-image-urls.sql'),
      createUpdateSql(readyRows, options.bucket),
      'utf8',
    );
  }

  return readyRows;
}

async function main() {
  const options = parseCli(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  await access(options.inputPath);
  const csvText = await readFile(options.inputPath, 'utf8');
  let universities = readUniversities(parseCsv(csvText));
  if (options.limit) universities = universities.slice(0, options.limit);

  const tasks = universities.flatMap((university) =>
    ASSET_DEFINITIONS.flatMap(({ key }) => {
      const sourceUrl = university.sources[key];
      return sourceUrl ? [{ university, assetKey: key, sourceUrl }] : [];
    }),
  );
  const missingSources = universities.length * ASSET_DEFINITIONS.length - tasks.length;

  console.log(`CSV: ${options.inputPath}`);
  console.log(`Đầu ra: ${options.outputPath}`);
  console.log(
    `${universities.length} trường, ${tasks.length} URL ảnh, ${missingSources} ô nguồn trống.`,
  );
  console.log(`Storage bucket: ${options.bucket}`);
  console.log(
    options.optimize
      ? `Chuẩn hóa: campus ${options.campusWidth}x${options.campusHeight} WebP, logo raster ${options.logoSize}x${options.logoSize} WebP, quality ${options.quality}.`
      : 'Chuẩn hóa ảnh: tắt.',
  );
  console.log(
    options.publicBaseUrl
      ? `Public URL base: ${options.publicBaseUrl}`
      : 'Chưa có Supabase URL: manifest sẽ có storage_path nhưng chưa có public URL/SQL.',
  );

  if (options.dryRun) {
    console.log('\nDry run — 6 path đầu tiên:');
    for (const task of tasks.slice(0, 6)) {
      console.log(`  ${task.university.id} | ${task.assetKey} | ${assetStem(task.university, task.assetKey)}.<ext>`);
    }
    return;
  }

  await mkdir(options.outputPath, { recursive: true });
  let completed = 0;
  const results = await mapWithConcurrency(
    tasks,
    options.concurrency,
    (task) => downloadAsset(task, options),
    (result) => {
      completed += 1;
      const definition = ASSET_DEFINITIONS.find(({ key }) => key === result.assetKey);
      const marker = result.status === 'failed' ? '✗' : result.status === 'existing' ? '↷' : '✓';
      console.log(
        `[${String(completed).padStart(String(tasks.length).length)}/${tasks.length}] ${marker} ` +
          `${result.university.id} ${result.university.name} — ${definition.label}` +
          (result.error ? ` (${result.error})` : ''),
      );
    },
  );

  const readyRows = await writeReports(universities, results, options);
  const downloaded = results.filter((result) => result.status === 'downloaded').length;
  const existing = results.filter((result) => result.status === 'existing').length;
  const failed = results.filter((result) => result.status === 'failed').length;
  const usableImages = readyRows.filter((row) => row.image_storage_path).length;
  const usableLogos = readyRows.filter((row) => row.logo_storage_path).length;

  console.log('\nHoàn tất:');
  console.log(`  ${downloaded} tải mới, ${existing} đã có, ${failed} thất bại.`);
  console.log(`  ${usableImages}/${universities.length} trường có ảnh dùng được.`);
  console.log(`  ${usableLogos}/${universities.length} trường có logo dùng được.`);
  console.log(`  Manifest: ${join(options.outputPath, 'download-manifest.csv')}`);
  console.log(
    `  CSV map: ${join(options.outputPath, 'universities-ready-for-supabase.csv')}`,
  );
  if (options.publicBaseUrl) {
    console.log(`  SQL update: ${join(options.outputPath, 'update-university-image-urls.sql')}`);
  }
  if (failed > 0) console.log('  Có URL lỗi; chạy lại lệnh để retry các file còn thiếu.');
}

main().catch((error) => {
  console.error(`Lỗi: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
