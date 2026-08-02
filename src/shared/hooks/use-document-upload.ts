'use client';

import { useCallback, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { DocumentStatus } from '@/shared/ui/document-row';

/**
 * Uploading a student document, once, for everywhere that does it.
 *
 * WHAT THIS CONSOLIDATES. Three copies of the same twelve lines existed:
 * /profile/upload-document-form.tsx, /onboarding/documents/document-upload.tsx,
 * and a third path in the onboarding wizard for the "sharing zone" note. All
 * three built the same storage key, inserted the same row, and disagreed about
 * the details — one used `upsert: false` and surfaced the raw Postgres error to
 * the student, one silently swallowed failures mid-loop and reported success
 * anyway, and none of them cleaned up the uploaded object when the row insert
 * failed, which left orphans in the bucket.
 *
 * WHY THE PROGRESS IS HONEST-BUT-COARSE. supabase-js `storage.upload()` exposes
 * no progress events — it is a single fetch, and the browser gives no upload
 * stream for one. So a row is `uploading` until it resolves, and the bar under
 * it is the indeterminate one. What this deliberately does NOT do is animate a
 * fake percentage to 90%: the frame draws "200 KB of 200 KB · 100%" for a
 * finished upload, not a creeping bar for a running one, and inventing the
 * middle would be the one number on the screen that is untrue.
 */

/** Matches the `type` column vocabulary already in `uploaded_documents`. */
export type DocumentKind = 'cv' | 'statement_of_purpose' | 'personal_statement' | 'transcript' | 'other';

export type UploadItem = {
  /** Stable across the item's life. Not the database id — that arrives later. */
  key: string;
  fileName: string;
  size: number;
  /** Which upload this came from, so one list can drive several dropzones. */
  kind: DocumentKind;
  status: DocumentStatus;
  error?: string | undefined;
  /** The `uploaded_documents.id`, once the row exists. */
  documentId?: string | undefined;
  storageKey?: string | undefined;
};

const BUCKET = 'student-documents';

/**
 * 10MB. Supabase's own default object limit is higher, but a CV or personal
 * statement past this is a scan at print resolution, and the failure it causes
 * is a long upload that dies at the end rather than a message up front.
 */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const ACCEPTED_DOCUMENT_TYPES = '.pdf,.doc,.docx,.txt,.rtf';

/**
 * A storage path that cannot collide and cannot escape the user's own folder.
 *
 * The filename is sanitised rather than passed through: Supabase storage keys
 * are URL path segments, and a name containing `/` or `..` would either fail
 * the upload or, worse, land somewhere unintended. RLS on the bucket is scoped
 * by the leading user id, so keeping that segment exact is load-bearing.
 */
function storagePath(userId: string, kind: DocumentKind, fileName: string): string {
  const safe = fileName
    .normalize('NFKD')
    .replace(/[^\w.\-]+/g, '-')
    .replace(/-+/g, '-')
    .slice(-80);
  return `${userId}/${kind}/${Date.now()}-${safe}`;
}

export function useDocumentUpload() {
  const [items, setItems] = useState<UploadItem[]>([]);

  const patch = useCallback((key: string, changes: Partial<UploadItem>) => {
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, ...changes } : item)));
  }, []);

  const remove = useCallback((key: string) => {
    setItems((prev) => prev.filter((item) => item.key !== key));
  }, []);

  const reset = useCallback(() => setItems([]), []);

  /**
   * Upload files and record them. Resolves when every one has settled.
   *
   * Never throws — a failed file becomes an `error` row the student can see and
   * retry, which is the whole point of the list. Throwing would take the other
   * files down with it.
   */
  const upload = useCallback(
    async (files: File[], kind: DocumentKind): Promise<UploadItem[]> => {
      const supabase = createClient();

      const started: UploadItem[] = files.map((file, index) => ({
        key: `${Date.now()}-${index}-${file.name}`,
        fileName: file.name,
        size: file.size,
        kind,
        status: 'uploading' as DocumentStatus,
      }));
      setItems((prev) => [...prev, ...started]);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        const failed = started.map((item) => ({
          ...item,
          status: 'error' as DocumentStatus,
          error: 'Please sign in first.',
        }));
        for (const item of failed) patch(item.key, item);
        return failed;
      }

      const settled: UploadItem[] = [];

      for (const [index, file] of files.entries()) {
        const item = started[index];
        if (!item) continue;

        if (file.size > MAX_UPLOAD_BYTES) {
          const failure = {
            status: 'error' as DocumentStatus,
            error: 'That file is over 10MB.',
          };
          patch(item.key, failure);
          settled.push({ ...item, ...failure });
          continue;
        }

        const path = storagePath(user.id, kind, file.name);

        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { upsert: false });

        if (uploadError) {
          const failure = {
            status: 'error' as DocumentStatus,
            // The raw storage error is for the console. "new row violates
            // row-level security policy" tells a student nothing they can act
            // on, and the old form put exactly that on screen.
            error: 'We could not upload that file. Please try again.',
          };
          console.error('[use-document-upload] storage upload failed:', uploadError);
          patch(item.key, failure);
          settled.push({ ...item, ...failure });
          continue;
        }

        const { data: row, error: insertError } = await supabase
          .from('uploaded_documents')
          .insert({
            user_id: user.id,
            type: kind,
            storage_key: path,
            file_name: file.name,
            mime_type: file.type || null,
            parsed_summary: null,
          })
          .select('id')
          .single();

        if (insertError) {
          // Take the object back out. Without this a failed insert leaves a
          // file in the bucket that nothing references and nothing will ever
          // clean up — all three of the previous implementations did that.
          await supabase.storage.from(BUCKET).remove([path]);

          const failure = {
            status: 'error' as DocumentStatus,
            error: 'We could not save that file. Please try again.',
          };
          console.error('[use-document-upload] row insert failed:', insertError);
          patch(item.key, failure);
          settled.push({ ...item, ...failure });
          continue;
        }

        const success = {
          status: 'complete' as DocumentStatus,
          documentId: row?.id as string | undefined,
          storageKey: path,
        };
        patch(item.key, success);
        settled.push({ ...item, ...success });
      }

      return settled;
    },
    [patch],
  );

  return { items, upload, remove, reset };
}
