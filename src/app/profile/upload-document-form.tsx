'use client';

import { FormEvent, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type DocType = 'cv' | 'statement_of_purpose';

const DOC_TYPES: { value: DocType; label: string; hint: string }[] = [
  { value: 'cv', label: 'CV / Résumé', hint: 'Your academic or professional CV' },
  { value: 'statement_of_purpose', label: 'Statement of Purpose', hint: 'Personal statement or SOP for applications' },
];

export function UploadDocumentForm() {
  const supabase = useMemo(() => createClient(), []);
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<DocType>('cv');
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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

    if (!file) {
      setMessage('Please choose a file first.');
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
      setMessage('Uploaded successfully.');
      setFile(null);
      // reset file input
      const input = document.getElementById('doc-file-input') as HTMLInputElement | null;
      if (input) input.value = '';
    }

    setLoading(false);
  };

  return (
    <section className="glow-card space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Upload document</h2>
        <p className="mt-1 text-sm text-slate-500">CV or Statement of Purpose — stored securely in your profile.</p>
      </div>

      {/* Doc type selector */}
      <div className="grid grid-cols-2 gap-3">
        {DOC_TYPES.map((dt) => (
          <button
            key={dt.value}
            type="button"
            onClick={() => setDocType(dt.value)}
            className={`rounded-2xl border p-3 text-left transition-all ${
              docType === dt.value
                ? 'border-pink-300 bg-pink-50 shadow-[0_0_0_2px_rgba(255,77,140,0.15)]'
                : 'border-black/5 bg-white/60 hover:border-pink-200'
            }`}
          >
            <p className={`text-sm font-semibold ${docType === dt.value ? 'text-pink-600' : 'text-slate-700'}`}>{dt.label}</p>
            <p className="mt-0.5 text-xs text-slate-400 leading-snug">{dt.hint}</p>
          </button>
        ))}
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="glow-label">
          Choose file
          <input
            id="doc-file-input"
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
        <button className="glow-button-primary glow-button-primary-wide" type="submit" disabled={loading}>
          {loading ? 'Uploading…' : `Upload ${DOC_TYPES.find(d => d.value === docType)?.label}`}
        </button>
      </form>

      {message && (
        <p className={`text-sm rounded-xl px-3 py-2 ${isError ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
          {message}
        </p>
      )}
    </section>
  );
}
