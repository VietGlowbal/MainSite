'use client';

import { FormEvent, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function UploadDocumentForm() {
  const supabase = useMemo(() => createClient(), []);
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      setMessage('Please sign in first so we know who owns the upload.');
      setLoading(false);
      return;
    }

    if (!file) {
      setMessage('Please choose a file first.');
      setLoading(false);
      return;
    }

    const path = `${userData.user.id}/cv/${Date.now()}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from('student-documents')
      .upload(path, file, { upsert: false });

    if (uploadError) {
      setMessage(uploadError.message);
      setLoading(false);
      return;
    }

    const { error: insertError } = await supabase.from('uploaded_documents').insert({
      user_id: userData.user.id,
      type: 'cv',
      storage_key: path,
      file_name: file.name,
      mime_type: file.type,
      parsed_summary: null,
    });

    if (insertError) {
      setMessage(insertError.message);
    } else {
      setMessage('Document uploaded and recorded successfully.');
      setFile(null);
    }

    setLoading(false);
  };

  return (
    <form className="glow-form-shell" onSubmit={handleSubmit}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'rgb(15 23 42)' }}>Upload document</h2>
      <p style={{ marginTop: '0.75rem', fontSize: '0.95rem', lineHeight: 1.8, color: 'rgb(71 85 105)' }}>
        For now this supports a simple CV upload into Supabase Storage and records metadata in the database.
      </p>

      <label className="glow-label" style={{ marginTop: '1.5rem' }}>
        Choose file
        <input
          className="glow-input"
          type="file"
          accept=".pdf,.doc,.docx,.txt"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
      </label>

      <button className="glow-button-primary" style={{ marginTop: '1.5rem', width: '100%' }} type="submit" disabled={loading}>
        {loading ? 'Uploading...' : 'Upload CV'}
      </button>

      {message && <p className="glow-message">{message}</p>}
    </form>
  );
}
