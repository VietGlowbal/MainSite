import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { UploadedDocument } from '@/lib/types';
import { ProfileSectionShell } from '../_section-shell';
import { UploadDocumentForm } from '../upload-document-form';

export default async function DocumentsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth');

  const { data } = await supabase
    .from('uploaded_documents')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  const documents = (data ?? []) as UploadedDocument[];

  return (
    <ProfileSectionShell
      title="Documents"
      description="Upload your CV, personal statement, transcripts and other supporting documents."
    >
      <div className="space-y-5">
        <UploadDocumentForm />

        {documents.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
            <h2 className="text-sm font-semibold text-slate-900 mb-4">Uploaded documents</h2>
            <div className="space-y-3">
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white border border-slate-200">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 truncate">{doc.file_name}</p>
                    <p className="text-xs text-slate-400">
                      {doc.type} · Uploaded {new Date(doc.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ProfileSectionShell>
  );
}
