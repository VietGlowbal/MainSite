'use client';

import { useState } from 'react';
import { ACCEPTED_DOCUMENT_TYPES, useDocumentUpload } from '@/features/apply/hooks';
import { Button, DocumentRow, FileDropzone } from '@/shared/ui';

type ReanalysisState = 'idle' | 'running' | 'done' | 'error';

/**
 * Evidence Upload — requirements.md Requirement 14.
 *
 * Reuses `useDocumentUpload` (the same hook `/ai-strategy/reflection/achievements`
 * uses) rather than a second upload implementation, then links the resulting
 * `uploaded_documents` row to this recommendation via
 * `PATCH .../recommendations/[recId]/evidence`.
 *
 * ⚠️ RE-ANALYSIS IS A USER-TRIGGERED ACTION HERE, NOT THE BACKGROUND JOB
 * design.md originally sketched. Building a real async job queue (matching
 * the course-parser's polling convention) is a bigger lift than this pass
 * has room for, and a fake one would be worse than an honest gap. "Re-analyse
 * now" calls the canonical endpoints (`/api/applications/[id]/personal-report`,
 * `match-insights`, `strategy/recommendation`) a Dashboard visit triggers.
 */
export function EvidenceUpload({
  applicationId,
  recommendationId,
}: {
  applicationId: string;
  recommendationId: string;
}) {
  const { items, upload, remove } = useDocumentUpload();
  const [linking, setLinking] = useState(false);
  const [reanalysis, setReanalysis] = useState<ReanalysisState>('idle');

  async function handleFiles(files: File[]) {
    const uploaded = await upload(files, 'other');
    setLinking(true);
    try {
      await Promise.all(
        uploaded
          .filter((item) => item.documentId)
          .map((item) =>
            fetch(
              `/api/applications/${applicationId}/strategy/recommendations/${recommendationId}/evidence`,
              {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ documentId: item.documentId }),
              },
            ),
          ),
      );
    } finally {
      setLinking(false);
    }
  }

  async function reanalyse() {
    setReanalysis('running');
    try {
      const [personalRes, matchRes] = await Promise.all([
        fetch(`/api/applications/${applicationId}/personal-report`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }),
        fetch(`/api/applications/${applicationId}/match-insights`, { method: 'POST' }),
      ]);
      if (!personalRes.ok || !matchRes.ok) {
        setReanalysis('error');
        return;
      }
      const recRes = await fetch(
        `/api/applications/${applicationId}/strategy/recommendation`,
        { method: 'POST' },
      );
      setReanalysis(recRes.ok ? 'done' : 'error');
    } catch {
      setReanalysis('error');
    }
  }

  return (
    <div className="flex flex-col gap-gb-lg">
      <FileDropzone
        onFiles={handleFiles}
        accept={`${ACCEPTED_DOCUMENT_TYPES},.jpg,.jpeg,.png,.mp4`}
        multiple
        disabled={linking}
        label="Upload evidence"
        hint="Certificates, documents, photos, videos (max 10MB each)"
      />

      {items.length > 0 ? (
        <ul className="flex flex-col gap-gb-md">
          {items.map((item) => (
            <DocumentRow
              key={item.key}
              fileName={item.fileName}
              total={item.size}
              status={item.status}
              {...(item.error ? { error: item.error } : {})}
              onRemove={() => remove(item.key)}
            />
          ))}
        </ul>
      ) : null}

      {items.some((i) => i.status === 'complete') ? (
        <div className="flex items-center gap-gb-lg">
          <Button
            variant="secondary"
            size="sm"
            disabled={reanalysis === 'running'}
            onClick={reanalyse}
          >
            {reanalysis === 'running' ? 'Re-analysing…' : 'Re-analyse now'}
          </Button>
          {reanalysis === 'done' ? (
            <p className="text-gb-sm text-fg-tertiary">
              Updated — refresh the dashboard to see new priorities.
            </p>
          ) : null}
          {reanalysis === 'error' ? (
            <p className="text-gb-sm text-fg-error">Could not re-analyse. Please try again.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
