'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ACCEPTED_DOCUMENT_TYPES, useDocumentUpload } from '@/features/apply/hooks';
import { DocumentRow, FileDropzone } from '@/shared/ui';
import { useLoadingIndicator } from '@/shared/ui/loading-overlay';

/**
 * The onboarding wizard's document step.
 *
 * SCOPE OF THIS REWRITE. The *upload* is now the shared `useDocumentUpload`
 * hook and the shared dropzone; the wizard's surrounding chrome (the gradient
 * pills, `.onboarding-nav-btn`, the Sharing Zone) is deliberately untouched,
 * because the Reflection frames replace this whole step and redesigning it
 * twice would be waste.
 *
 * What the old upload code did wrong, all of which the hook now handles:
 *   • Reported success after a mid-loop failure — the loop returned early on
 *     the first bad file having already told the student "Everything uploaded
 *     successfully!" for the ones before it.
 *   • Left the object in the bucket when the row insert failed, so the file
 *     existed but nothing referenced it.
 *   • Put raw Supabase errors on screen ("new row violates row-level security
 *     policy"), which no student can act on.
 *   • Two hand-rolled drag handlers with `className="hidden"` file inputs,
 *     which takes them out of the tab order and the accessibility tree.
 */

const ACCEPTED_LABEL = 'PDF, DOC, DOCX, TXT or RTF (max. 10MB)';

export function OnboardingDocumentUpload() {
  const { items, upload, remove } = useDocumentUpload();
  const [sharingText, setSharingText] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);

  useLoadingIndicator(loading, 'Uploading your documents');

  const cvItems = items.filter((item) => item.kind === 'cv');
  const extraItems = items.filter((item) => item.kind === 'other');
  const anyComplete = items.some((item) => item.status === 'complete');

  async function handleCv(files: File[]) {
    setLoading(true);
    setMessage(null);
    await upload(files, 'cv');
    setLoading(false);
  }

  async function handleExtra(files: File[]) {
    setLoading(true);
    setMessage(null);
    await upload(files, 'other');
    setLoading(false);
  }

  /**
   * The Sharing Zone note, stored as a document row with no file behind it.
   *
   * Odd, but it is what the existing schema supports and what the match
   * pipeline already reads — `parsed_summary` is the field it looks at.
   */
  async function saveNote() {
    const text = sharingText.trim();
    if (!text) return;

    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage('Please sign in first.');
      setIsError(true);
      setLoading(false);
      return;
    }

    const { error } = await supabase.from('uploaded_documents').insert({
      user_id: user.id,
      type: 'personal_statement',
      storage_key: `${user.id}/notes/sharing-zone-${Date.now()}.txt`,
      file_name: 'Sharing Zone note',
      mime_type: 'text/plain',
      parsed_summary: text,
    });

    if (error) {
      console.error('[onboarding] sharing note failed:', error);
      setMessage('We could not save your note. Please try again.');
      setIsError(true);
    } else {
      setNoteSaved(true);
      setMessage('Saved.');
      setIsError(false);
    }
    setLoading(false);
  }

  return (
    <div className="onboarding-question-card space-y-6 rounded-[2rem] border border-black/5 bg-white/95 p-6 shadow-[0_20px_60px_rgba(22,33,62,0.10)] backdrop-blur-xl md:p-10">
      <div className="space-y-3">
        <h2 className="text-lg font-bold text-slate-900">Upload your CV</h2>
        <FileDropzone
          onFiles={handleCv}
          accept={ACCEPTED_DOCUMENT_TYPES}
          disabled={loading}
          label="Click to upload your CV"
          hint={ACCEPTED_LABEL}
        />
        {cvItems.length > 0 ? (
          <ul className="flex flex-col gap-gb-md">
            {cvItems.map((item) => (
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
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-bold text-slate-900">Anything else?</h2>
        <p className="text-sm text-slate-500">
          Extracurricular certificates, degrees, or achievements we should take into account.
        </p>
        <FileDropzone
          onFiles={handleExtra}
          accept={ACCEPTED_DOCUMENT_TYPES}
          multiple
          disabled={loading}
          label="Click to upload"
          hint={ACCEPTED_LABEL}
        />
        {extraItems.length > 0 ? (
          <ul className="flex flex-col gap-gb-md">
            {extraItems.map((item) => (
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
      </div>

      {/* Sharing Zone */}
      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <span className="shrink-0 rounded-full bg-gradient-to-r from-[var(--glowbal-mint)] to-[var(--glowbal-mint-light)] px-5 py-2 text-sm font-bold text-white shadow-md">
            Sharing Zone
          </span>
          <p className="text-sm text-slate-600">
            What&apos;s on your cute mind? Tell us{' '}
            <span className="font-semibold italic text-[var(--glowbal-pink)]">
              anything you would love us to include in our recommendations
            </span>
            . We&apos;re all ears!
          </p>
        </div>
        <textarea
          className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 placeholder:text-slate-400 focus:border-[var(--glowbal-mint)] focus:outline-none focus:ring-2 focus:ring-cyan-100"
          rows={4}
          placeholder="I don't really have any experience in real work life about Marketing, but I really like creating contents and doing something creative..."
          value={sharingText}
          onChange={(event) => {
            setSharingText(event.target.value);
            setNoteSaved(false);
          }}
        />
        {sharingText.trim() && !noteSaved ? (
          <button
            type="button"
            onClick={saveNote}
            disabled={loading}
            className="rounded-full border border-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-500 hover:border-slate-300 hover:text-slate-700 disabled:opacity-50"
          >
            Save note
          </button>
        ) : null}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <a href="/onboarding" className="onboarding-nav-btn onboarding-nav-btn-back">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Go Back
        </a>

        {/* Files upload as they are chosen, so there is nothing left to submit —
            this is now a plain link on, shown once something has landed. */}
        {anyComplete && !loading ? (
          <a href="/onboarding/complete" className="onboarding-nav-btn onboarding-nav-btn-next">
            Continue
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </a>
        ) : (
          <a href="/onboarding/complete" className="text-sm font-semibold text-slate-400 hover:text-slate-600">
            Skip for now
          </a>
        )}
      </div>

      {message ? (
        <p
          className={`text-center text-sm rounded-xl px-3 py-2 ${
            isError ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'
          }`}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
