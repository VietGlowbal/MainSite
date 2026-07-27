'use client';

/**
 * StatementFeedbackModal — opens the AI statement feedback tool in an overlay,
 * scoped to a single course application. Loads any existing draft for that
 * application on open so feedback persists across visits.
 */

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { AIAnalysis } from '@/lib/types';
import { StatementWriter } from './StatementWriter';
import { useLoadingIndicator } from '@/shared/ui/loading-overlay';

type Props = {
  applicationId: string;
  targetName: string;
  contextNote?: string | null;
  onClose: () => void;
};

type DraftState = {
  content: string;
  analysis: AIAnalysis | null;
  statementId: number | null;
  docType: 'personal_statement' | 'statement_of_purpose';
};

export function StatementFeedbackModal({ applicationId, targetName, contextNote, onClose }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [loading, setLoading] = useState(true);
  useLoadingIndicator(loading, 'Reading your statement');

  // Lock background scroll + close on Escape.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('personal_statements')
        .select('id, content, ai_analysis, doc_type')
        .eq('application_id', applicationId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;
      setDraft({
        content: data?.content ?? '',
        analysis: (data?.ai_analysis as AIAnalysis | null) ?? null,
        statementId: (data?.id as number) ?? null,
        docType: (data?.doc_type as DraftState['docType']) ?? 'personal_statement',
      });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, applicationId]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-3 backdrop-blur md:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="statement-feedback-title"
      onClick={onClose}
    >
      <div
        className="flex h-full max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-black/5 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.18)] md:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 md:px-6">
          <div>
            <p className="text-[0.65rem] font-bold uppercase tracking-wider text-pink-600">
              AI statement feedback
            </p>
            <h2 id="statement-feedback-title" className="mt-0.5 text-lg font-semibold text-slate-900">
              Strengthen your statement
            </h2>
            <p className="text-xs text-slate-500">for {targetName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        {loading || !draft ? (
          <div className="flex flex-1 flex-col items-center justify-center p-10">
            <div className="mb-3 h-8 w-8 animate-spin rounded-full border-[3px] border-pink-200 border-t-pink-500" />
            <p className="text-sm text-slate-500">Loading your draft…</p>
          </div>
        ) : (
          <StatementWriter
            embedded
            saveTarget={{ kind: 'application', applicationId }}
            targetName={targetName}
            contextNote={contextNote}
            initialContent={draft.content}
            initialAnalysis={draft.analysis}
            statementId={draft.statementId}
            initialDocType={draft.docType}
          />
        )}
      </div>
    </div>
  );
}
