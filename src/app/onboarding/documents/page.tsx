import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { OnboardingDocumentUpload } from './document-upload';

export default async function OnboardingDocumentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/auth');

  return (
    <main className="min-h-screen bg-transparent px-4 py-12 text-slate-800 md:px-8">
      <div className="mx-auto max-w-2xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <span className="inline-block rounded-full border border-pink-200 bg-pink-50 px-4 py-1.5 text-sm font-semibold text-pink-600">
            Almost there
          </span>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
            Upload your documents
          </h1>
          <p className="mx-auto max-w-md text-slate-500 leading-7">
            Optionally upload your CV or personal statement. This helps us give better
            recommendations and powers the AI writing assistant later.
          </p>
        </div>

        {/* Upload form */}
        <OnboardingDocumentUpload />

        {/* Skip */}
        <div className="text-center">
          <a
            href="/universities"
            className="inline-flex items-center gap-2 rounded-full border border-black/5 bg-white/80 px-6 py-3 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-white hover:shadow-md"
          >
            Skip for now — explore universities
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </a>
        </div>
      </div>
    </main>
  );
}
