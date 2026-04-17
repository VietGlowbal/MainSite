import { UploadDocumentForm } from './upload-document-form';
import { createClient } from '@/lib/supabase/server';

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const documents = user
    ? (await supabase
        .from('uploaded_documents')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })).data ?? []
    : [];

  return (
    <main className="min-h-screen bg-transparent px-6 py-16 text-slate-800 md:px-10">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-[2rem] border border-black/5 bg-white/80 p-8 shadow-[0_12px_32px_rgba(22,33,62,0.06)] backdrop-blur">
          <span className="rounded-full border border-pink-200 bg-pink-50 px-3 py-1 text-sm font-semibold text-pink-600">
            Profile and documents
          </span>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-slate-900">Upload CVs and supporting documents</h1>
          <p className="mt-4 leading-7 text-slate-600">
            This is the first version of the document flow. We will use it for CV uploads,
            parsed summaries, and eventually recommendation inputs.
          </p>
        </section>

        <UploadDocumentForm />

        <section className="rounded-[2rem] border border-black/5 bg-white/80 p-8 shadow-[0_12px_32px_rgba(22,33,62,0.06)] backdrop-blur lg:col-span-2">
          <h2 className="text-2xl font-semibold text-slate-900">Recent uploads</h2>
          {documents.length === 0 ? (
            <p className="mt-4 text-slate-600">No documents uploaded yet.</p>
          ) : (
            <div className="mt-5 space-y-3">
              {documents.map((document) => (
                <article key={document.id} className="rounded-[1.25rem] border border-black/5 bg-slate-50/90 p-4 text-sm text-slate-600">
                  <p><strong className="text-slate-900">File:</strong> {document.file_name}</p>
                  <p><strong className="text-slate-900">Type:</strong> {document.type}</p>
                  <p><strong className="text-slate-900">Stored at:</strong> {document.storage_key}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
