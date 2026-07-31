'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { AIAnalysis } from '@/lib/types';
import { StatementWriter, type StoredVinUniAnalysis } from './StatementWriter';

type Props = {
  applicationId: string;
  targetName: string;
  contextNote?: string | null;
  demo?: boolean;
  reviewType?: 'statement' | 'lor';
};

type DraftState = {
  content: string;
  analysis: AIAnalysis | StoredVinUniAnalysis | null;
  statementId: number | null;
  docType: 'personal_statement' | 'statement_of_purpose' | 'recommendation_letter';
};

export function StatementFeedbackWorkspace({
  applicationId,
  targetName,
  contextNote,
  demo = false,
  reviewType = 'statement',
}: Props) {
  const isLor = reviewType === 'lor';
  const supabase = useMemo(() => (demo ? null : createClient()), [demo]);
  const [draft, setDraft] = useState<DraftState | null>(
    demo
      ? {
          content: '',
          analysis: null,
          statementId: null,
          docType: isLor ? 'recommendation_letter' : 'personal_statement',
        }
      : null,
  );
  const evaluationMode = /\bvin\s*(?:university|uni)\b/i.test(targetName)
    ? 'vinuni'
    : 'generic';

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    void (async () => {
      const baseQuery = supabase
        .from('personal_statements')
        .select('id, content, ai_analysis, doc_type')
        .eq('application_id', applicationId);
      const { data } = await (isLor
        ? baseQuery.eq('doc_type', 'recommendation_letter')
        : baseQuery.in('doc_type', ['personal_statement', 'statement_of_purpose']))
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!cancelled) {
        setDraft({
          content: data?.content ?? '',
          analysis:
            (data?.ai_analysis as AIAnalysis | StoredVinUniAnalysis | null) ?? null,
          statementId: (data?.id as number) ?? null,
          docType: isLor
            ? 'recommendation_letter'
            : ((data?.doc_type as DraftState['docType']) ?? 'personal_statement'),
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applicationId, isLor, supabase]);

  return (
    <main className="min-h-screen bg-[#f5f6fa] p-3 sm:p-5 lg:p-7">
      <div className="mx-auto flex min-h-[calc(100dvh-1.5rem)] max-w-[1600px] flex-col sm:min-h-[calc(100dvh-2.5rem)] lg:min-h-[calc(100dvh-3.5rem)]">
        <header className="flex shrink-0 items-start justify-between gap-4 rounded-t-2xl border border-b-0 border-slate-200 bg-white px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <Link
              href="/apply"
              className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-pink-600"
            >
              <span aria-hidden="true">←</span>
              Quay lại Apply
            </Link>
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-pink-600">
              {isLor ? 'AI LOR feedback' : 'AI statement feedback'}
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">
              {isLor ? 'Strengthen your recommendation letter' : 'Strengthen your statement'}
            </h1>
            <p className="mt-1 truncate text-sm text-slate-500">for {targetName}</p>
          </div>
          <div className="hidden rounded-full border border-pink-100 bg-pink-50 px-3 py-1.5 text-xs font-semibold text-pink-700 sm:block">
            {isLor ? 'Programme-grounded AI feedback' : 'Phân tích AI có dẫn chứng'}
          </div>
        </header>

        <div className="flex min-h-[640px] flex-1 overflow-hidden rounded-b-2xl border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
          {!draft ? (
            <div className="flex flex-1 flex-col items-center justify-center p-10">
              <div className="mb-3 h-8 w-8 animate-spin rounded-full border-[3px] border-pink-200 border-t-pink-500" />
              <p className="text-sm text-slate-500">
                {isLor ? 'Loading your recommendation letter…' : 'Loading your draft…'}
              </p>
            </div>
          ) : (
            <StatementWriter
              embedded
              workspace
              evaluationMode={evaluationMode}
              saveTarget={demo ? { kind: 'demo' } : { kind: 'application', applicationId }}
              targetName={targetName}
              contextNote={contextNote}
              initialContent={draft.content}
              initialAnalysis={draft.analysis}
              statementId={draft.statementId}
              initialDocType={draft.docType}
              reviewType={reviewType}
            />
          )}
        </div>
      </div>
    </main>
  );
}
