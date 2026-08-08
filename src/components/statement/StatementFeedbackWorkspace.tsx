'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { SiteNavigation } from '@/components/site-navigation';
import { createClient } from '@/lib/supabase/client';
import type { LorReview } from '@/lib/ai/lor';
import type { AIAnalysis } from '@/lib/types';
import { Container } from '@/shared/ui';
import {
  LorStrategyWorkspace,
  type LorEvidenceOption,
  type StoredLorStrategy,
} from './LorStrategyWorkspace';
import { StatementWriter, type StoredVinUniAnalysis } from './StatementWriter';

type Props = {
  applicationId: string;
  targetName: string;
  contextNote?: string | null;
  demo?: boolean;
  reviewType?: 'statement' | 'lor';
  lorEvidence?: LorEvidenceOption[];
  initialLorStrategy?: StoredLorStrategy | null;
  userName?: string | null;
  userAvatarUrl?: string | null;
  evaluationMode?: 'generic' | 'vinuni';
};

type DraftState = {
  content: string;
  analysis: AIAnalysis | LorReview | StoredVinUniAnalysis | null;
  statementId: number | null;
  docType: 'personal_statement' | 'statement_of_purpose' | 'recommendation_letter';
};

function isLorReview(value: DraftState['analysis']): value is LorReview {
  return Boolean(value && 'dimensions' in value && Array.isArray(value.dimensions));
}

export function StatementFeedbackWorkspace({
  applicationId,
  targetName,
  contextNote,
  demo = false,
  reviewType = 'statement',
  lorEvidence = [],
  initialLorStrategy = null,
  userName = null,
  evaluationMode: requestedEvaluationMode,
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
  const [lorStage, setLorStage] = useState<'strategy' | 'draft' | 'review'>('strategy');
  const [strategyReady, setStrategyReady] = useState(Boolean(initialLorStrategy));
  const [reviewReady, setReviewReady] = useState(false);
  const evaluationMode = requestedEvaluationMode ?? (/\bvin\s*(?:university|uni)\b/i.test(targetName)
    ? 'vinuni'
    : 'generic');
  const currentLorStageIndex = ['strategy', 'draft', 'review'].indexOf(lorStage);

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
        const savedAnalysis =
          (data?.ai_analysis as DraftState['analysis']) ?? null;
        setDraft({
          content: data?.content ?? '',
          analysis: savedAnalysis,
          statementId: (data?.id as number) ?? null,
          docType: isLor
            ? 'recommendation_letter'
            : ((data?.doc_type as DraftState['docType']) ?? 'personal_statement'),
        });
        if (isLor && initialLorStrategy) {
          const hasReview = isLorReview(savedAnalysis);
          setStrategyReady(true);
          setReviewReady(hasReview);
          setLorStage(hasReview ? 'review' : 'draft');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applicationId, initialLorStrategy, isLor, supabase]);

  return (
    <div className={isLor ? 'gb-page-full-bleed gb-has-mobile-header bg-surface' : undefined}>
      {isLor ? <SiteNavigation tone="light" /> : null}

      <main className={isLor ? 'min-h-screen bg-surface py-gb-md text-fg sm:py-gb-xl lg:py-gb-2xl' : 'min-h-screen bg-[#FAFAFA] pb-24 pt-6 text-neutral-900'}>
      <Container className={`flex min-h-[calc(100dvh-1.5rem)] flex-col sm:min-h-[calc(100dvh-2.5rem)] lg:min-h-[calc(100dvh-3.5rem)] ${isLor ? '' : '!max-w-[1600px]'}`}>
        <header className={isLor ? 'flex shrink-0 items-start justify-between gap-gb-xl bg-surface px-gb-xl py-gb-xl sm:px-gb-2xl' : 'flex shrink-0 items-start justify-between gap-8 py-8'}>
          <div className="min-w-0">
            {/*
             * LOR only. The statement route is one of the six application
             * destinations and now sits under `ApplicationNav`'s band, whose
             * breadcrumb already links `/apply/<id>` and also names the course —
             * two back links stacked a few pixels apart is a choice the student
             * should not have to read twice. `/apply/<id>/lor-feedback` is NOT
             * one of the six, gets no band, and so keeps the link as its only
             * way out.
             */}
            {isLor ? (
              <Link
                href={`/apply/${applicationId}`}
                className="mb-gb-sm inline-flex items-center gap-gb-xs text-gb-xs font-semibold text-fg-tertiary transition-colors hover:text-fg-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <span aria-hidden="true">←</span>
                Quay lại Apply
              </Link>
            ) : null}
            <p className="text-gb-xs font-bold uppercase tracking-[0.18em] text-fg-brand">
              {isLor ? 'AI LOR feedback' : 'AI statement feedback'}
            </p>
            <h1 className={isLor ? 'mt-gb-xs font-display text-gb-xl font-semibold tracking-gb-display-tight text-fg sm:text-gb-display-xs' : 'mt-1 font-display text-4xl font-semibold leading-[44px] tracking-[-0.02em] text-neutral-900'}>
              {isLor ? 'Strengthen your recommendation letter' : 'Strengthen your statement'}
            </h1>
            <p className="mt-gb-xs truncate text-gb-sm text-fg-tertiary">for {targetName}</p>
          </div>
          <div className={isLor ? 'hidden rounded-gb-full bg-brand-subtle px-gb-lg py-gb-sm text-gb-xs font-semibold text-fg-brand sm:block' : 'hidden rounded-full bg-rose-50 px-4 py-1 text-sm font-medium text-rose-600 sm:block'}>
            {isLor ? 'Programme-grounded AI feedback' : 'Phân tích AI có dẫn chứng'}
          </div>
        </header>

        <div className={isLor ? 'flex min-h-[640px] flex-1 flex-col bg-surface' : 'flex min-h-[680px] flex-1 flex-col overflow-hidden bg-[#FAFAFA]'}>
          {!draft ? (
            <div className="flex flex-1 flex-col items-center justify-center p-10">
              <div className="mb-gb-lg h-8 w-8 animate-spin rounded-gb-full border-[3px] border-brand-subtle border-t-brand" />
              <p className="text-gb-sm text-fg-tertiary">
                {isLor ? 'Loading your recommendation letter…' : 'Loading your draft…'}
              </p>
            </div>
          ) : (
            <>
              {isLor ? (
                <nav
                  aria-label="LOR review stages"
                  className="shrink-0 border-b border-line bg-surface px-gb-sm py-gb-xl sm:px-gb-2xl"
                >
                  <ol className="mx-auto grid w-full max-w-4xl grid-cols-3">
                    {([
                      ['strategy', 'Recommender strategy', true],
                      ['draft', 'Letter draft', strategyReady],
                      ['review', 'Quality review', reviewReady],
                    ] as const).map(([stage, label, enabled], index, stages) => {
                      const current = lorStage === stage;
                      const completed = index < currentLorStageIndex;

                      return (
                        <li key={stage} className="relative min-w-0">
                          {index < stages.length - 1 ? (
                            <span
                              data-testid={`lor-stage-connector-${stage}`}
                              aria-hidden="true"
                              className={`absolute left-1/2 top-5 h-0.5 w-full ${
                                completed ? 'bg-brand' : 'bg-line'
                              }`}
                            />
                          ) : null}
                          <button
                            type="button"
                            disabled={!enabled}
                            aria-current={current ? 'step' : undefined}
                            onClick={() => setLorStage(stage)}
                            className="relative z-10 flex w-full min-w-0 flex-col items-center px-gb-xs text-center focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand disabled:cursor-not-allowed"
                          >
                            <span
                              data-testid={`lor-stage-node-${stage}`}
                              className={`flex h-10 w-10 items-center justify-center rounded-gb-full border-2 text-gb-sm font-bold transition-colors ${
                                completed
                                  ? 'border-brand bg-brand text-white'
                                  : current
                                    ? 'border-brand bg-surface text-fg-brand'
                                    : 'border-line bg-surface text-fg-muted'
                              }`}
                            >
                              {completed ? (
                                <span aria-label="Completed">✓</span>
                              ) : current ? (
                                <span className="h-3 w-3 rounded-gb-full bg-brand" aria-hidden="true" />
                              ) : (
                                index + 1
                              )}
                            </span>
                            <span className={`mt-gb-sm text-gb-xs font-semibold sm:text-gb-sm ${
                              current ? 'text-fg-brand' : completed ? 'text-fg' : 'text-fg-tertiary'
                            }`}>
                              {label}
                            </span>
                            <span className="mt-gb-xs text-[11px] text-fg-muted">
                              {completed ? 'Completed' : current ? 'In progress' : enabled ? 'Ready' : 'Locked'}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                </nav>
              ) : null}

              <div className="relative min-h-0 flex-1">
                {isLor ? (
                  <div
                    hidden={lorStage !== 'strategy'}
                    className={lorStage === 'strategy' ? 'absolute inset-0 flex' : 'hidden'}
                  >
                    <LorStrategyWorkspace
                      applicationId={applicationId}
                      targetName={targetName}
                      studentName={userName}
                      evidence={lorEvidence}
                      initialStrategy={initialLorStrategy}
                      onContinue={() => {
                        setStrategyReady(true);
                        setLorStage('draft');
                      }}
                    />
                  </div>
                ) : null}
                <div
                  hidden={isLor && lorStage === 'strategy'}
                  className={`${isLor && lorStage === 'strategy' ? 'hidden' : 'flex'} absolute inset-0`}
                >
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
                    requestedWorkspacePane={isLor && lorStage === 'review' ? 'feedback' : 'essay'}
                    onAnalysisStart={
                      isLor
                        ? () => {
                            setLorStage('review');
                          }
                        : undefined
                    }
                    onAnalysisComplete={
                      isLor
                        ? () => {
                            setReviewReady(true);
                            setLorStage('review');
                          }
                        : undefined
                    }
                    onAnalysisError={isLor ? () => setLorStage('draft') : undefined}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </Container>
      </main>
    </div>
  );
}
