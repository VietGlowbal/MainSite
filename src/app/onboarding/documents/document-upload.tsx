'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useLoadingIndicator } from '@/shared/ui/loading-overlay';

type UploadedFile = {
  docType: string;
  fileName: string;
};

const ACCEPTED_TYPES = '.pdf,.docx,.doc,.pptx,.xlsx';
const ACCEPTED_LABEL = '.pdf, .docx, .doc, .pptx, .xlxs';

export function OnboardingDocumentUpload() {
  const supabase = useMemo(() => createClient(), []);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvUploaded, setCvUploaded] = useState<string | null>(null);
  const [extraFiles, setExtraFiles] = useState<File[]>([]);
  const [extraUploaded, setExtraUploaded] = useState<UploadedFile[]>([]);
  const [sharingText, setSharingText] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);
  useLoadingIndicator(loading, 'Uploading your documents');
  const [dragOverCv, setDragOverCv] = useState(false);
  const [dragOverExtra, setDragOverExtra] = useState(false);

  const cvInputRef = useRef<HTMLInputElement>(null);
  const extraInputRef = useRef<HTMLInputElement>(null);

  const handleCvDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOverCv(false);
    const file = e.dataTransfer.files[0];
    if (file) setCvFile(file);
  }, []);

  const handleExtraDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOverExtra(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) setExtraFiles((prev) => [...prev, ...files]);
  }, []);

  const handleSubmit = async () => {
    setLoading(true);
    setMessage(null);
    setIsError(false);

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      setMessage('Please sign in first.');
      setIsError(true);
      setLoading(false);
      return;
    }

    const userId = userData.user.id;

    // Upload CV
    if (cvFile && !cvUploaded) {
      const path = `${userId}/cv/${Date.now()}-${cvFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from('student-documents')
        .upload(path, cvFile, { upsert: false });

      if (uploadError) {
        setMessage(uploadError.message);
        setIsError(true);
        setLoading(false);
        return;
      }

      await supabase.from('uploaded_documents').insert({
        user_id: userId,
        type: 'cv',
        storage_key: path,
        file_name: cvFile.name,
        mime_type: cvFile.type,
        parsed_summary: null,
      });

      setCvUploaded(cvFile.name);
      setCvFile(null);
    }

    // Upload extra files
    for (const file of extraFiles) {
      const path = `${userId}/extra/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('student-documents')
        .upload(path, file, { upsert: false });

      if (uploadError) {
        setMessage(uploadError.message);
        setIsError(true);
        setLoading(false);
        return;
      }

      await supabase.from('uploaded_documents').insert({
        user_id: userId,
        type: 'other',
        storage_key: path,
        file_name: file.name,
        mime_type: file.type,
        parsed_summary: null,
      });

      setExtraUploaded((prev) => [...prev, { docType: 'other', fileName: file.name }]);
    }
    setExtraFiles([]);

    // Save sharing text as a note
    if (sharingText.trim()) {
      await supabase.from('uploaded_documents').insert({
        user_id: userId,
        type: 'personal_statement',
        storage_key: `${userId}/notes/sharing-zone-${Date.now()}.txt`,
        file_name: 'Sharing Zone Note',
        mime_type: 'text/plain',
        parsed_summary: sharingText.trim(),
      });
    }

    setMessage('Everything uploaded successfully!');
    setLoading(false);
  };

  const allUploadedFiles = [...extraUploaded];

  return (
    <div className="onboarding-question-card space-y-6 rounded-[2rem] border border-black/5 bg-white/95 p-6 shadow-[0_20px_60px_rgba(22,33,62,0.10)] backdrop-blur-xl md:p-10">
      {/* CV Upload */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={() => cvInputRef.current?.click()}
          className="shrink-0 rounded-full bg-gradient-to-r from-[var(--glowbal-pink)] to-[var(--glowbal-pink-light)] px-6 py-3 text-sm font-bold text-white shadow-md transition hover:shadow-lg"
        >
          Upload your CV
        </button>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOverCv(true); }}
          onDragLeave={() => setDragOverCv(false)}
          onDrop={handleCvDrop}
          onClick={() => cvInputRef.current?.click()}
          className={`flex-1 cursor-pointer rounded-2xl border-2 border-dashed px-6 py-4 text-center transition ${
            dragOverCv
              ? 'border-[var(--glowbal-mint)] bg-cyan-50/50'
              : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
          }`}
        >
          {cvUploaded ? (
            <div className="flex items-center justify-center gap-2">
              <FolderIcon />
              <span className="text-sm font-medium text-[var(--glowbal-mint)] underline">{cvUploaded}</span>
            </div>
          ) : cvFile ? (
            <p className="text-sm font-medium text-slate-700">{cvFile.name}</p>
          ) : (
            <div>
              <p className="text-sm text-slate-500">Click or Drop to Add File</p>
              <p className="text-xs text-slate-400">File Types: {ACCEPTED_LABEL}</p>
            </div>
          )}
        </div>
        <input
          ref={cvInputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) setCvFile(file);
          }}
        />
      </div>

      {/* Extra files upload */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <button
          type="button"
          onClick={() => extraInputRef.current?.click()}
          className="shrink-0 rounded-full bg-gradient-to-r from-[var(--glowbal-mint)] to-[var(--glowbal-mint-light)] px-6 py-3 text-sm font-bold text-white shadow-md transition hover:shadow-lg"
        >
          Anything else?
        </button>
        <div className="flex-1 space-y-3">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOverExtra(true); }}
            onDragLeave={() => setDragOverExtra(false)}
            onDrop={handleExtraDrop}
            onClick={() => extraInputRef.current?.click()}
            className={`cursor-pointer rounded-2xl border-2 border-dashed px-6 py-4 text-center transition ${
              dragOverExtra
                ? 'border-[var(--glowbal-mint)] bg-cyan-50/50'
                : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
            }`}
          >
            <p className="text-sm text-slate-500">Click or Drop to Add File</p>
            <p className="text-xs text-slate-400">File Types: {ACCEPTED_LABEL}</p>
          </div>

          {/* Uploaded file list */}
          {(allUploadedFiles.length > 0 || extraFiles.length > 0) && (
            <div className="space-y-2">
              {allUploadedFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  <FolderIcon />
                  <span className="text-sm font-medium text-[var(--glowbal-mint)] underline">{f.fileName}</span>
                </div>
              ))}
              {extraFiles.map((f, i) => (
                <div key={`pending-${i}`} className="flex items-center gap-2">
                  <FolderIcon />
                  <span className="text-sm font-medium text-slate-600">{f.name}</span>
                  <button
                    type="button"
                    onClick={() => setExtraFiles((prev) => prev.filter((_, idx) => idx !== i))}
                    className="ml-auto text-xs text-slate-400 hover:text-red-400"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => extraInputRef.current?.click()}
                className="mt-1 rounded-full border border-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-500 hover:border-slate-300 hover:text-slate-700"
              >
                + Add more
              </button>
            </div>
          )}
        </div>
        <input
          ref={extraInputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            if (files.length > 0) setExtraFiles((prev) => [...prev, ...files]);
          }}
        />
      </div>

      <p className="text-center text-xs text-slate-500">
        Add any extracurricular certificates, degrees, or achievements we should take into account.
      </p>

      {/* Sharing Zone */}
      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <span className="shrink-0 rounded-full bg-gradient-to-r from-[var(--glowbal-mint)] to-[var(--glowbal-mint-light)] px-5 py-2 text-sm font-bold text-white shadow-md">
            Sharing Zone
          </span>
          <p className="text-sm text-slate-600">
            What&apos;s on your cute mind? Tell us{' '}
            <span className="font-semibold italic text-[var(--glowbal-pink)]">anything you would love us to include in our recommendations</span>.
            We&apos;re all ears!
          </p>
        </div>
        <textarea
          className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 placeholder:text-slate-400 focus:border-[var(--glowbal-mint)] focus:outline-none focus:ring-2 focus:ring-cyan-100"
          rows={4}
          placeholder="I don't really have any experience in real work life about Marketing, but I really like creating contents and doing something creative..."
          value={sharingText}
          onChange={(e) => setSharingText(e.target.value)}
        />
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <a
          href="/onboarding"
          className="onboarding-nav-btn onboarding-nav-btn-back"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Go Back
        </a>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          className="onboarding-nav-btn onboarding-nav-btn-next"
        >
          {loading ? 'Uploading...' : 'Submit'}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Message */}
      {message && (
        <p className={`text-center text-sm rounded-xl px-3 py-2 ${isError ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
          {message}
        </p>
      )}

      {/* Continue button after upload */}
      {(cvUploaded || allUploadedFiles.length > 0) && !loading && (
        <div className="text-center pt-2">
          <a
            href="/onboarding/complete"
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[var(--glowbal-pink)] to-[var(--glowbal-pink-light)] px-8 py-3 font-semibold text-white shadow-[0_10px_24px_rgba(255,77,140,0.24)] transition hover:shadow-[0_14px_32px_rgba(255,77,140,0.32)]"
          >
            Continue
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </a>
        </div>
      )}
    </div>
  );
}

function FolderIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 7V17C3 18.1046 3.89543 19 5 19H19C20.1046 19 21 18.1046 21 17V9C21 7.89543 20.1046 7 19 7H13L11 5H5C3.89543 5 3 5.89543 3 7Z"
        fill="var(--glowbal-mint)"
        opacity="0.8"
      />
    </svg>
  );
}
