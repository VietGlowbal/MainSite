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
import { extractText, getDocumentProxy } from 'unpdf';

const STORAGE_BUCKET = 'student-documents';
const MAX_CHARS = 12000;

export async function extractDocumentText(
  admin: SupabaseClient,
  storageKey: string,
  mimeType: string | null,
): Promise<string | null> {
  try {
    const { data, error } = await admin.storage.from(STORAGE_BUCKET).download(storageKey);
    if (error || !data) return null;

    const bytes = new Uint8Array(await data.arrayBuffer());
    const key = storageKey.toLowerCase();
    const mt = (mimeType ?? '').toLowerCase();

    // PDF — the common case for CVs and statements.
    if (mt.includes('pdf') || key.endsWith('.pdf')) {
      const pdf = await getDocumentProxy(bytes);
      const { text } = await extractText(pdf, { mergePages: true });
      const merged = (Array.isArray(text) ? text.join('\n') : text)?.trim() ?? '';
      return merged.length > 0 ? merged.slice(0, MAX_CHARS) : null;
    }

    // Plain text / markdown.
    if (mt.startsWith('text/') || /\.(txt|md|markdown|csv)$/.test(key)) {
      const text = new TextDecoder().decode(bytes).trim();
      return text.length > 0 ? text.slice(0, MAX_CHARS) : null;
    }

    // Unsupported binary format (e.g. .docx) — caller handles null.
    return null;
  } catch (err) {
    console.error('[document-text] extraction failed for', storageKey, err);
    return null;
  }
}
