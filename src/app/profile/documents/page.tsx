import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { UploadedDocument } from '@/lib/types';
import { DocumentRow } from '@/shared/ui';
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
          <section className="flex flex-col gap-gb-lg rounded-gb-2xl border border-line bg-surface p-gb-3xl">
            <h2 className="text-gb-md font-semibold text-fg">Your documents</h2>
            <ul className="flex flex-col gap-gb-md">
              {documents.map((doc) => (
                /* No `total`: `uploaded_documents` stores no byte count, and
                   the row is honest about that rather than printing a made-up
                   size next to a real filename. */
                <DocumentRow key={doc.id} fileName={doc.file_name} status="complete" />
              ))}
            </ul>
          </section>
        )}
      </div>
    </ProfileSectionShell>
  );
}
