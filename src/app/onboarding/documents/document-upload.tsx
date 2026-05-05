'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type DocType = 'cv' | 'statement_of_purpose' | 'personal_statement';

const DOC_TYPES: { value: DocType; label: string; hint: string; emoji: string }[] = [
  { value: 'cv', label: 'CV / Résumé', hint: 'Your academic or professional CV', emoji: '📄' },
  { value: 'statement_of_purpose', label: 'Statement of Purpose', hint: 'SOP for graduate applications', emoji: '🎯' },
  { value: 'personal_statement', label: 'Personal Statement', hint: 'UCAS or general personal statement', emoji: '✍️' },
];

export function OnboardingDocumentUpload() {
  const supabase = useMemo(() => createClient(), []);
  const [uploads, setUploads] = useState<{ docType: DocType; fileName: string }[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<DocType>('cv');
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    if (!file) return;
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

    const path = `${userData.user.id}/${docType}/${Date.now()}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from('student-documents')
      .upload(path, file, { upsert: false });

    if (uploadError) {
      setMessage(uploadError.message);
      setIsError(true);
      setLoading(false);
      return;
    }

    const { error: insertError } = await supabase.from('uploaded_documents').insert({
      user_id: userData.user.id,
      type: docType,
      storage_key: path,
      file_name: file.name,
      mime_type: file.type,
      parsed_summary: null,
    });

    if (insertError) {
      setMessage(insertError.message);
      setIsError(true);
    } else {
      setUploads((prev) => [...prev, { docType, fileName: file.name }]);
      setMessage('Uploaded successfully!');
      setFile(null);
      const input = document.getElementById('onboarding-doc-input') as HTMLInputElement | null;
      if (input) input.value = '';
    }

    setLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Doc type selector */}
      <div className="grid grid-cols-3 gap-3">
        {DOC_TYPES.map((dt) => (
          <button
            key={dt.value}
            type="button"
            onClick={() => setDocType(dt.value)}
            className={`rounded-2xl border p-4 text-center transition-all ${
              docType === dt.value
                ? 'border-pink-300 bg-pink-50 shadow-[0_0_0_2px_rgba(255,77,140,0.15)]'
                : 'border-black/5 bg-white/80 hover:border-pink-200'
            }`}
          >
            <span className="text-2xl" aria-hidden="true">{dt.emoji}</span>
            <p className={`mt-2 text-sm font-semibold ${docType === dt.value ? 'text-pink-600' : 'text-slate-700'}`}>
              {dt.label}
            </p>
            <p className="mt-0.5 text-xs text-slate-400 leading-snug">{dt.hint}</p>
          </button>
        ))}
      </div>

      {/* File input + upload */}
      <div className="glow-card space-y-4">
        <label className="glow-label">
          Choose file
          <input
            id="onboarding-doc-input"
            className="glow-input mt-2"
            type="file"
            accept=".pdf,.doc,.docx,.txt"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        {file && (
          <p className="text-xs text-slate-500 truncate">
            Selected: <span className="font-medium text-slate-700">{file.name}</span> ({(file.size / 1024).toFixed(0)} KB)
          </p>
        )}
        <button
          type="button"
          onClick={handleUpload}
          disabled={loading || !file}
          className="glow-button-primary glow-button-primary-wide"
        >
          {loading ? 'Uploading…' : 'Upload'}
        </button>
      </div>

      {/* Success uploads */}
      {uploads.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Uploaded</p>
          {uploads.map((u, i) => (
            <div key={i} className="glow-muted-card flex items-center justify-between text-sm">
              <span className="font-medium text-slate-700 truncate">{u.fileName}</span>
              <span className="shrink-0 rounded-full bg-green-50 border border-green-200 px-2 py-0.5 text-xs font-semibold text-green-600">
                ✓ Uploaded
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Message */}
      {message && (
        <p className={`text-sm rounded-xl px-3 py-2 ${isError ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
          {message}
        </p>
      )}

      {/* Continue button */}
      {uploads.length > 0 && (
        <div className="text-center pt-2">
          <a
            href="/universities"
            className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#FF4D8C,#FF85B3)] px-8 py-3 font-semibold text-white shadow-[0_10px_24px_rgba(255,77,140,0.24)] transition hover:shadow-[0_14px_32px_rgba(255,77,140,0.32)]"
          >
            Continue to universities
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </a>
        </div>
      )}
    </div>
  );
}
