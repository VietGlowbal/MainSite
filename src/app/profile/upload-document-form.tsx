'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ACCEPTED_DOCUMENT_TYPES,
  useDocumentUpload,
  type DocumentKind,
} from '@/features/apply/hooks';
import { DocumentRow, FileDropzone } from '@/shared/ui';
import { useLoadingIndicator } from '@/shared/ui/loading-overlay';

/**
 * Uploading a CV or a personal statement.
 *
 * REBUILT AGAINST THE NEW FRAMES. What this replaces was a bare
 * `<input type="file">` wrapped in `.glow-card` / `.glow-input` /
 * `.glow-button-primary` — three class families on CLAUDE.md's quarantine list,
 * so it was inheriting from the 5,672 lines of unlayered legacy CSS that
 * out-rank Tailwind. It also surfaced raw Supabase errors to the student, left
 * orphaned objects in the bucket when the row insert failed, and bounced them
 * to /universities on a 900ms timer whether or not that was where they came
 * from.
 *
 * The upload itself now lives in `useDocumentUpload`, shared with onboarding.
 */

const DOC_TYPES: { value: DocumentKind; label: string; hint: string }[] = [
  { value: 'cv', label: 'CV / Résumé', hint: 'Your academic or professional CV' },
  {
    value: 'statement_of_purpose',
    label: 'Personal statement',
    hint: 'Your statement of purpose or personal statement',
  },
];

export function UploadDocumentForm() {
  const router = useRouter();
  const { items, upload, remove } = useDocumentUpload();
  const [kind, setKind] = useState<DocumentKind>('cv');
  const [busy, setBusy] = useState(false);

  useLoadingIndicator(busy, 'Uploading your document');

  const active = DOC_TYPES.find((d) => d.value === kind);

  async function handleFiles(files: File[]) {
    setBusy(true);
    const settled = await upload(files, kind);
    setBusy(false);

    // Refresh rather than navigate. The list of stored documents on this page
    // is server-rendered, and the student is most likely here to add a second
    // file — sending them to /universities on a timer was the old form
    // guessing, and it guessed wrong for anyone arriving from /apply.
    if (settled.some((item) => item.status === 'complete')) router.refresh();
  }

  return (
    <section className="flex flex-col gap-gb-2xl rounded-gb-2xl border border-line bg-surface p-gb-3xl">
      <div className="flex flex-col gap-gb-xs">
        <h2 className="text-gb-lg font-semibold text-fg">Upload a document</h2>
        <p className="text-gb-sm text-fg-tertiary">
          Stored privately in your profile. GlowBal reads it to score how well you match a course.
        </p>
      </div>

      <div
        role="radiogroup"
        aria-label="Document type"
        className="grid gap-gb-lg sm:grid-cols-2"
      >
        {DOC_TYPES.map((option) => {
          const selected = kind === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setKind(option.value)}
              className={`flex flex-col gap-gb-xxs rounded-gb-xl border p-gb-xl text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                selected
                  ? 'border-brand bg-brand-subtle'
                  : 'border-line hover:border-line-strong'
              }`}
            >
              <span
                className={`text-gb-sm font-semibold ${selected ? 'text-fg-brand' : 'text-fg'}`}
              >
                {option.label}
              </span>
              <span className="text-gb-xs text-fg-tertiary">{option.hint}</span>
            </button>
          );
        })}
      </div>

      <FileDropzone
        onFiles={handleFiles}
        accept={ACCEPTED_DOCUMENT_TYPES}
        disabled={busy}
        label={`Click to upload ${active?.label ?? 'a document'}`}
        hint="PDF, DOC, DOCX, TXT or RTF (max. 10MB)"
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
              removeLabel={`Dismiss ${item.fileName}`}
            />
          ))}
        </ul>
      ) : null}
    </section>
  );
}
