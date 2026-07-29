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

export async function extractDocumentBytes(
  bytes: Uint8Array,
  mimeType: string | null,
  fileName: string,
): Promise<string | null> {
  const key = fileName.toLowerCase();
  const mt = (mimeType ?? '').toLowerCase();
  let text = '';

  if (mt.includes('pdf') || key.endsWith('.pdf')) {
    const pdf = await getDocumentProxy(bytes);
    const extracted = await extractText(pdf, { mergePages: true });
    text = Array.isArray(extracted.text) ? extracted.text.join('\n') : extracted.text;
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
