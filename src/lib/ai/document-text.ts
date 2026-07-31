// ============================================================================
// Document text extraction
// ----------------------------------------------------------------------------
// Pulls an uploaded document (CV / statement) out of Supabase Storage and
// extracts its plain text so the AI can actually read it. PDFs are parsed with
// `unpdf` (a serverless-friendly pdf.js build); text files are decoded directly.
// Returns null for anything we can't read (e.g. a scanned-image PDF or a .docx),
// so callers can prompt the user to upload a text-based file or paste the text.
// ============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import mammoth from 'mammoth';
import { extractText, getDocumentProxy } from 'unpdf';

const STORAGE_BUCKET = 'student-documents';
const MAX_CHARS = 15000;

export type ExtractedPdfPage = {
  page: number;
  text: string;
  source: 'text_layer' | 'ocr' | 'unreadable';
};

export type OcrPageExtractor = (
  pdfBytes: Uint8Array,
  pageNumbers: number[],
) => Promise<ReadonlyMap<number, string>>;

function hasReadableText(text: string): boolean {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length < 10 || (normalized.match(/[\p{L}\p{N}]+/gu) ?? []).length < 2) {
    return false;
  }
  return (normalized.match(/\uFFFD/g) ?? []).length / normalized.length < 0.2;
}

/**
 * Reads each PDF page independently so a future OCR provider only receives
 * pages whose embedded text layer is empty or unusable.
 */
export async function extractPdfWithOcrFallback(
  bytes: Uint8Array,
  ocr?: OcrPageExtractor,
): Promise<{
  pages: ExtractedPdfPage[];
  totalPages: number;
  ocrPageNumbers: number[];
  coverage: number;
  charactersExtracted: number;
}> {
  const pdf = await getDocumentProxy(bytes);
  const extracted = await extractText(pdf, { mergePages: false });
  const pages: ExtractedPdfPage[] = Array.from(
    { length: extracted.totalPages },
    (_, index) => {
      const text = (extracted.text[index] ?? '').replace(/\s+\n/g, '\n').trim();
      return {
        page: index + 1,
        text,
        source: hasReadableText(text) ? 'text_layer' : 'unreadable',
      };
    },
  );

  const unreadable = pages.filter(({ source }) => source === 'unreadable').map(({ page }) => page);
  if (ocr && unreadable.length > 0) {
    const replacements = await ocr(bytes, unreadable);
    for (const page of pages) {
      const replacement = replacements.get(page.page)?.trim();
      if (page.source === 'unreadable' && replacement && hasReadableText(replacement)) {
        page.text = replacement;
        page.source = 'ocr';
      }
    }
  }

  const ocrPageNumbers = pages
    .filter(({ source }) => source === 'unreadable')
    .map(({ page }) => page);
  const readableCount = pages.length - ocrPageNumbers.length;

  return {
    pages,
    totalPages: pages.length,
    ocrPageNumbers,
    coverage: pages.length > 0 ? readableCount / pages.length : 0,
    charactersExtracted: pages.reduce((total, page) => total + page.text.length, 0),
  };
}

export async function extractDocumentBytes(
  bytes: Uint8Array,
  mimeType: string | null,
  fileName: string,
): Promise<string | null> {
  const key = fileName.toLowerCase();
  const mt = (mimeType ?? '').toLowerCase();
  let text = '';

  if (mt.includes('pdf') || key.endsWith('.pdf')) {
    const extracted = await extractPdfWithOcrFallback(bytes);
    text = extracted.pages.map((page) => page.text).filter(Boolean).join('\n');
  } else if (mt.includes('wordprocessingml.document') || key.endsWith('.docx')) {
    text = (await mammoth.extractRawText({ buffer: Buffer.from(bytes) })).value;
  } else if (mt.startsWith('text/') || /\.(txt|md|markdown|csv)$/.test(key)) {
    text = new TextDecoder().decode(bytes);
  } else {
    return null;
  }

  const normalized = text.trim();
  return normalized ? normalized.slice(0, MAX_CHARS) : null;
}

export async function extractDocumentText(
  admin: SupabaseClient,
  storageKey: string,
  mimeType: string | null,
): Promise<string | null> {
  try {
    const { data, error } = await admin.storage.from(STORAGE_BUCKET).download(storageKey);
    if (error || !data) return null;

    const bytes = new Uint8Array(await data.arrayBuffer());
    return extractDocumentBytes(bytes, mimeType, storageKey);
  } catch (err) {
    console.error('[document-text] extraction failed for', storageKey, err);
    return null;
  }
}
