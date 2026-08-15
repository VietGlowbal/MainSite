'use client';

import { useCallback, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { UploadItem } from '@/shared/hooks';

/**
 * The document library behind the achievements page's "Recently uploaded"
 * panel — list, rename, remove, reprocess, and a signed URL for preview.
 *
 * ─── WHY THIS IS SEPARATE FROM `useDocumentUpload` ───────────────────────────
 *
 * That hook's job stops the moment a file lands in `uploaded_documents`; its
 * `items` list only ever holds what was uploaded THIS session, because that is
 * all a fresh page load can know about without a fetch. This hook picks up
 * from there: it starts from whatever the server already found (`initial`,
 * read in `page.tsx`) and merges newly uploaded items in as they complete, so
 * a returning student sees every document they have ever uploaded, not just
 * the one they just added.
 */

export type EvidenceDocument = {
  id: string;
  fileName: string;
  storageKey: string;
  /** Known for a document uploaded this session; unset for one read from the
   *  server, since `uploaded_documents` does not store file size. */
  size?: number | undefined;
  uploadedAt: string;
};

const BUCKET = 'student-documents';

export function useEvidenceDocuments(initial: EvidenceDocument[]) {
  const [documents, setDocuments] = useState<EvidenceDocument[]>(initial);
  const [error, setError] = useState<string | null>(null);

  /** Add freshly uploaded items (from `useDocumentUpload`) to the library. */
  const addUploaded = useCallback((items: UploadItem[]) => {
    const complete = items.filter(
      (item): item is UploadItem & { documentId: string; storageKey: string } =>
        item.status === 'complete' && Boolean(item.documentId) && Boolean(item.storageKey),
    );
    if (complete.length === 0) return;
    setDocuments((prev) => [
      ...prev,
      ...complete.map((item) => ({
        id: item.documentId,
        fileName: item.fileName,
        storageKey: item.storageKey,
        size: item.size,
        uploadedAt: new Date().toISOString(),
      })),
    ]);
  }, []);

  const rename = useCallback(async (id: string, fileName: string): Promise<boolean> => {
    const trimmed = fileName.trim();
    if (!trimmed) return false;
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from('uploaded_documents')
      .update({ file_name: trimmed })
      .eq('id', id);
    if (updateError) {
      console.error('[use-evidence-documents] rename failed:', updateError);
      setError('We could not rename that file. Please try again.');
      return false;
    }
    setDocuments((prev) =>
      prev.map((doc) => (doc.id === id ? { ...doc, fileName: trimmed } : doc)),
    );
    return true;
  }, []);

  /**
   * Removes the document row and its storage object, but NOT anything already
   * extracted from it — those are separate `student_achievements`/
   * `student_activities` rows the moment they exist, per the product rule that
   * deleting a source must never quietly delete what was learned from it.
   */
  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      const target = documents.find((doc) => doc.id === id);
      if (!target) return false;
      const supabase = createClient();
      const { error: deleteError } = await supabase
        .from('uploaded_documents')
        .delete()
        .eq('id', id);
      if (deleteError) {
        console.error('[use-evidence-documents] remove failed:', deleteError);
        setError('We could not remove that file. Please try again.');
        return false;
      }
      await supabase.storage.from(BUCKET).remove([target.storageKey]);
      setDocuments((prev) => prev.filter((doc) => doc.id !== id));
      return true;
    },
    [documents],
  );

  /** A short-lived URL for the preview drawer's `<iframe>`. */
  const signedUrl = useCallback(async (storageKey: string): Promise<string | null> => {
    const supabase = createClient();
    const { data, error: signError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(storageKey, 600);
    if (signError || !data) {
      console.error('[use-evidence-documents] signed URL failed:', signError);
      return null;
    }
    return data.signedUrl;
  }, []);

  return { documents, error, addUploaded, rename, remove, signedUrl };
}
