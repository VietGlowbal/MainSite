import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { University } from '@/lib/types';
import { StatementWriter } from './statement-writer';

type Props = {
  params: Promise<{ id: string }>;
};

export default async function WriterPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/auth');

  const { data: userUniversity } = await supabase
    .from('user_universities')
    .select('*, university:universities(*)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!userUniversity) redirect('/my-universities');

  const university = userUniversity.university as University;

  // Load existing draft if any
  const { data: existingDraft } = await supabase
    .from('personal_statements')
    .select('*')
    .eq('user_id', user.id)
    .eq('user_university_id', userUniversity.id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <main className="h-screen flex flex-col bg-white text-slate-800 overflow-hidden">
      {/* Top bar */}
      <header className="shrink-0 border-b border-slate-200 bg-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <a
            href={`/my-universities/${id}`}
            className="text-sm text-slate-500 hover:text-slate-700 transition flex items-center gap-1"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back
          </a>
          <div className="h-5 w-px bg-slate-200" />
          <div>
            <h1 className="text-sm font-semibold text-slate-800">AI Statement Writer</h1>
            <p className="text-xs text-slate-400">{university.name}</p>
          </div>
        </div>
      </header>

      <StatementWriter
        universityName={university.name}
        userUniversityId={userUniversity.id}
        initialContent={existingDraft?.content ?? ''}
        initialAnalysis={existingDraft?.ai_analysis ?? null}
        statementId={existingDraft?.id ?? null}
      />
    </main>
  );
}
