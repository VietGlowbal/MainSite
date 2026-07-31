import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { UploadedDocument } from '@/lib/types';
import { DocumentRow, Panel, PanelHeader } from '@/shared/ui';
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
      <div className="flex flex-col gap-gb-3xl">
        <UploadDocumentForm />

        {documents.length > 0 && (
          <Panel className="flex flex-col gap-gb-xl">
            <PanelHeader
              title="Your documents"
              description="Stored privately. Only you and the AI that scores your applications can read them."
            />
            <ul className="flex flex-col gap-gb-md">
              {documents.map((doc) => (
                /* No `total`: `uploaded_documents` stores no byte count, and
                   the row is honest about that rather than printing a made-up
                   size next to a real filename. */
                <DocumentRow key={doc.id} fileName={doc.file_name} status="complete" />
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </ProfileSectionShell>
  );
}
