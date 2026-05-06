import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { computeMatchResult } from '@/lib/matching';
import type { University, StudentProfile } from '@/lib/types';
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

  // Fetch profile for match score
  const { data: profile } = await supabase
    .from('student_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  const matchResult = profile ? computeMatchResult(profile as StudentProfile, university) : null;

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
            <p className="text-xs text-slate-400">{university.name} · {university.country}{university.qs_rank ? ` · #${university.qs_rank} QS` : ''}</p>
          </div>
        </div>
        {matchResult && (
          <span className={`text-xs font-bold px-3 py-1 rounded-full ${
            matchResult.percentage >= 75 ? 'bg-emerald-50 text-emerald-600' :
            matchResult.percentage >= 50 ? 'bg-amber-50 text-amber-600' :
            'bg-pink-50 text-pink-600'
          }`}>
            {matchResult.percentage}% match
          </span>
        )}
      </header>

      <StatementWriter
        universityName={university.name}
        universityCountry={university.country}
        universityRank={university.qs_rank}
        universityAcceptRate={university.accept_rate}
        universityStrengths={university.strengths}
        userUniversityId={userUniversity.id}
        initialContent={existingDraft?.content ?? ''}
        initialAnalysis={existingDraft?.ai_analysis ?? null}
        statementId={existingDraft?.id ?? null}
      />
    </main>
  );
}
