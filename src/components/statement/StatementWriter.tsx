'use client';

/**
 * StatementWriter — the AI personal-statement / SOP feedback tool.
 *
 * Reusable across the app:
 *   - full-page, on /my-universities/[id]/writer   (saveTarget.kind = 'university')
 *   - embedded in a modal inside the Apply journey  (saveTarget.kind = 'application')
 *
 * It posts the draft to /api/ai/analyze-statement, renders a score, inline
 * suggestions and an admissions checklist, and persists the draft + analysis
 * to the personal_statements table against whichever target it was given.
 */

import { useMemo, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { AIAnalysis, AISuggestion } from '@/lib/types';

export type StatementSaveTarget =
  | { kind: 'university'; userUniversityId: number }
  | { kind: 'application'; applicationId: string };

type DocType = 'personal_statement' | 'statement_of_purpose';

type Props = {
  /** Where the draft is stored. */
  saveTarget: StatementSaveTarget;
  /** University / course name — used in the AI prompt and the draft title. */
  targetName: string;
  /** Optional "what this university looks for" context shown before analysis. */
  contextNote?: string | null;
  initialContent: string;
  initialAnalysis: AIAnalysis | null;
  statementId: number | null;
  initialDocType?: DocType;
  /** Compact layout tuned for a modal (no fixed full-screen height). */
  embedded?: boolean;
};

function scoreColor(score: number) {
  if (score >= 80) return '#10b981'; // emerald
  if (score >= 60) return '#f59e0b'; // amber
  if (score >= 40) return '#fb7185'; // rose
  return '#ef4444'; // red
}

function ScoreRing({ score, size = 64 }: { score: number; size?: number }) {
  const r = 16;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (Math.max(0, Math.min(100, score)) / 100) * circumference;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r={r} fill="none" stroke="#f1f5f9" strokeWidth="3" />
        <circle
          cx="18"
          cy="18"
          r={r}
          fill="none"
          stroke={scoreColor(score)}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-slate-700">
        {score}
      </span>
    </div>
  );
}

const SUGGESTION_STYLES: Record<AISuggestion['type'], { chip: string; bar: string; highlight: string }> = {
  weak: { chip: 'bg-amber-100 text-amber-700', bar: 'border-amber-300', highlight: 'bg-amber-100' },
  missing: { chip: 'bg-sky-100 text-sky-700', bar: 'border-sky-300', highlight: 'bg-sky-100' },
  impact: { chip: 'bg-rose-100 text-rose-700', bar: 'border-rose-300', highlight: 'bg-rose-100' },
};

export function StatementWriter({
  saveTarget,
  targetName,
  contextNote,
  initialContent,
  initialAnalysis,
  statementId: initialStatementId,
  initialDocType = 'personal_statement',
  embedded = false,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [text, setText] = useState(initialContent);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(initialAnalysis);
  const [status, setStatus] = useState<'idle' | 'analyzing' | 'done'>(initialAnalysis ? 'done' : 'idle');
  const [activeTab, setActiveTab] = useState<'score' | 'suggestions' | 'checklist'>('suggestions');
  const [hoveredSuggestion, setHoveredSuggestion] = useState<string | null>(null);
  const [docType, setDocType] = useState<DocType>(initialDocType);
  const [error, setError] = useState<string | null>(null);
  const [statementId, setStatementId] = useState<number | null>(initialStatementId);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'edit' | 'review'>(initialAnalysis ? 'review' : 'edit');

  const wordCount = text.split(/\s+/).filter((w) => w.length > 0).length;

  const saveDraft = useCallback(
    async (content: string, aiAnalysis?: AIAnalysis | null) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const payload: Record<string, unknown> = {
        user_id: userData.user.id,
        title: `Statement for ${targetName}`,
        content,
        doc_type: docType,
        ai_analysis: aiAnalysis ?? analysis,
        updated_at: new Date().toISOString(),
      };
      if (saveTarget.kind === 'university') {
        payload.user_university_id = saveTarget.userUniversityId;
      } else {
        payload.application_id = saveTarget.applicationId;
      }

      if (statementId) {
        await supabase.from('personal_statements').update(payload).eq('id', statementId);
      } else {
        const { data } = await supabase
          .from('personal_statements')
          .insert(payload)
          .select('id')
          .single();
        if (data) setStatementId(data.id as number);
      }

      setSaveStatus('Saved');
      setTimeout(() => setSaveStatus(null), 2000);
    },
    [supabase, targetName, docType, analysis, saveTarget, statementId],
  );

  const handleAnalyze = useCallback(async () => {
    if (text.trim().length < 20) return;
    setStatus('analyzing');
    setError(null);

    try {
      const res = await fetch('/api/ai/analyze-statement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, docType, targetUniversity: targetName }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Analysis failed');
      }

      const result: AIAnalysis = await res.json();
      setAnalysis(result);
      setStatus('done');
      setActiveTab('suggestions');
      setViewMode('review');
      await saveDraft(text, result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed. Please try again.');
      setStatus('idle');
    }
  }, [text, docType, targetName, saveDraft]);

  const acceptSuggestion = (suggestion: AISuggestion) => {
    setText((prev) => prev.replace(suggestion.originalText, suggestion.replacement));
    if (analysis) {
      setAnalysis({
        ...analysis,
        suggestions: analysis.suggestions.filter((s) => s.id !== suggestion.id),
      });
    }
  };

  const renderHighlightedText = () => {
    if (!analysis?.suggestions?.length) {
      return <p className="whitespace-pre-wrap text-base leading-relaxed text-slate-700">{text}</p>;
    }

    const elements: React.ReactNode[] = [];
    let remaining = text;
    const sorted = [...analysis.suggestions].sort(
      (a, b) => text.indexOf(a.originalText) - text.indexOf(b.originalText),
    );

    sorted.forEach((sug, i) => {
      const idx = remaining.indexOf(sug.originalText);
      if (idx !== -1) {
        elements.push(<span key={`t-${i}`}>{remaining.substring(0, idx)}</span>);
        elements.push(
          <span
            key={`m-${i}`}
            className={`${SUGGESTION_STYLES[sug.type].highlight} cursor-pointer rounded px-0.5 transition-all ${
              hoveredSuggestion === sug.id ? 'font-medium ring-2 ring-slate-800' : ''
            }`}
            onMouseEnter={() => setHoveredSuggestion(sug.id)}
            onMouseLeave={() => setHoveredSuggestion(null)}
            onClick={() => {
              setActiveTab('suggestions');
              setHoveredSuggestion(sug.id);
            }}
          >
            {sug.originalText}
          </span>,
        );
        remaining = remaining.substring(idx + sug.originalText.length);
      }
    });
    elements.push(<span key="end">{remaining}</span>);

    return <p className="whitespace-pre-wrap text-base leading-relaxed text-slate-700">{elements}</p>;
  };

  const outerClass = embedded
    ? 'flex min-h-0 flex-1 flex-col lg:flex-row'
    : 'flex flex-1 flex-col overflow-hidden lg:flex-row';

  return (
    <div className={outerClass}>
      {/* ── Left: Editor ── */}
      <section className="flex min-h-0 flex-1 flex-col border-b border-slate-200 lg:w-3/5 lg:border-b-0 lg:border-r">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value as DocType)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 focus:border-pink-300 focus:outline-none"
            >
              <option value="personal_statement">Personal Statement</option>
              <option value="statement_of_purpose">Statement of Purpose</option>
            </select>
            <span className="hidden text-xs tabular-nums text-slate-400 sm:inline">{wordCount} words</span>
            {saveStatus && <span className="text-xs font-medium text-emerald-500">{saveStatus}</span>}
          </div>
          <div className="flex items-center gap-2">
            {analysis && (
              <button
                type="button"
                onClick={() => setViewMode((m) => (m === 'edit' ? 'review' : 'edit'))}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                {viewMode === 'edit' ? 'Review' : 'Edit'}
              </button>
            )}
            <button
              type="button"
              onClick={() => saveDraft(text)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Save draft
            </button>
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={status === 'analyzing' || text.trim().length < 20}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] px-4 py-1.5 text-xs font-bold text-white shadow-[0_4px_12px_rgba(255,77,140,0.25)] transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
            >
              {status === 'analyzing'
                ? 'Analyzing…'
                : status === 'done'
                  ? 'Re-analyze'
                  : 'Analyze'}
            </button>
          </div>
        </div>

        <div className={`min-h-0 flex-1 overflow-y-auto p-4 md:p-6 ${embedded ? 'max-h-[42vh] lg:max-h-none' : ''}`}>
          {viewMode === 'edit' || status === 'analyzing' ? (
            <div className="relative h-full">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={`Paste your ${docType === 'statement_of_purpose' ? 'statement of purpose' : 'personal statement'} here, or start writing. We'll give you specific feedback on how to strengthen it for ${targetName}.`}
                className="h-full min-h-[240px] w-full resize-none border-none text-base leading-relaxed text-slate-700 outline-none placeholder:text-slate-300"
              />
              <div className="pointer-events-none absolute bottom-2 right-3 text-xs text-slate-400">
                {wordCount} words
                {docType === 'personal_statement' && (
                  <span className={wordCount > 650 ? ' font-medium text-red-500' : ''}> · UCAS max: 650</span>
                )}
              </div>
            </div>
          ) : (
            <div className="relative min-h-full">{renderHighlightedText()}</div>
          )}
        </div>
      </section>

      {/* ── Right: Analysis Panel ── */}
      <section className="flex min-h-0 flex-1 flex-col bg-slate-50 lg:w-2/5">
        {status === 'idle' && !analysis && (
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {contextNote && (
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
                  What {targetName} looks for
                </p>
                <p className="text-sm leading-relaxed text-slate-600">{contextNote}</p>
              </div>
            )}

            <div className="rounded-xl border border-pink-100 bg-gradient-to-br from-pink-50 to-white p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-pink-500">
                How it works
              </p>
              <ol className="space-y-1.5 text-sm text-slate-600">
                <li>1. Paste or write your statement on the left.</li>
                <li>2. Hit Analyze — we read it like an admissions officer.</li>
                <li>3. Apply the inline suggestions to sharpen it.</li>
              </ol>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">Tips</p>
              <ul className="space-y-1.5 text-sm text-slate-600">
                <li>• Be specific about why this course and university.</li>
                <li>• Show, don&apos;t tell — use concrete examples.</li>
                <li>• Connect your past experience to your future goals.</li>
                <li>• Keep it under 650 words for UCAS.</li>
              </ul>
            </div>
          </div>
        )}

        {status === 'analyzing' && (
          <div className="flex flex-1 flex-col items-center justify-center p-8">
            <div className="mb-4 h-10 w-10 animate-spin rounded-full border-[3px] border-pink-200 border-t-pink-500" />
            <h2 className="text-base font-semibold text-slate-600">Reading like an admissions officer…</h2>
            <p className="mt-1 text-xs text-slate-400">Checking tone, impact, and course fit.</p>
          </div>
        )}

        {error && (
          <div className="m-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>
        )}

        {analysis && status !== 'analyzing' && (
          <>
            <div className="flex shrink-0 border-b border-slate-200 bg-white px-2 pt-2">
              {(['score', 'suggestions', 'checklist'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-semibold capitalize transition ${
                    activeTab === tab
                      ? 'border-pink-500 text-pink-600'
                      : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {tab}
                  {tab === 'suggestions' && analysis.suggestions.length > 0 && (
                    <span className="rounded-full bg-pink-100 px-1.5 py-0.5 text-[10px] text-pink-600">
                      {analysis.suggestions.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
              {activeTab === 'score' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-5">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                        Admissions readiness
                      </p>
                      <p className="mt-1 text-2xl font-bold text-slate-800">
                        {analysis.score}
                        <span className="text-sm font-medium text-slate-400">/100</span>
                      </p>
                    </div>
                    <ScoreRing score={analysis.score} />
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-5">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
                      AI summary
                    </p>
                    <p className="text-sm leading-relaxed text-slate-600">{analysis.summary}</p>
                  </div>
                </div>
              )}

              {activeTab === 'suggestions' && (
                <div className="space-y-3">
                  {analysis.suggestions.length === 0 ? (
                    <div className="py-8 text-center">
                      <p className="text-sm text-slate-500">
                        All suggestions applied. Your statement is looking strong.
                      </p>
                    </div>
                  ) : (
                    analysis.suggestions.map((sug) => {
                      const styles = SUGGESTION_STYLES[sug.type];
                      return (
                        <div
                          key={sug.id}
                          className={`rounded-xl border bg-white p-4 transition-all ${
                            hoveredSuggestion === sug.id ? `shadow-md ${styles.bar}` : 'border-slate-200'
                          }`}
                          onMouseEnter={() => setHoveredSuggestion(sug.id)}
                          onMouseLeave={() => setHoveredSuggestion(null)}
                        >
                          <span className={`mb-2 inline-block rounded px-2 py-0.5 text-[10px] font-bold ${styles.chip}`}>
                            {sug.category}
                          </span>

                          <div className="space-y-2 text-sm">
                            <div className="border-l-2 border-rose-200 pl-3">
                              <p className="text-slate-400 line-through">{sug.originalText}</p>
                            </div>
                            <div className="border-l-2 border-emerald-400 pl-3">
                              <p className="font-medium text-slate-700">{sug.replacement}</p>
                            </div>
                          </div>

                          <p className="mt-3 rounded-lg bg-slate-50 p-2.5 text-xs leading-relaxed text-slate-500">
                            {sug.explanation}
                          </p>

                          <button
                            type="button"
                            onClick={() => acceptSuggestion(sug)}
                            className="mt-3 w-full rounded-lg border border-pink-300 bg-white py-2 text-xs font-semibold text-pink-600 transition hover:bg-pink-50"
                          >
                            Apply change
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {activeTab === 'checklist' && (
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                      Admissions criteria
                    </p>
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {analysis.checklist.map((item) => (
                      <li key={item.id} className="flex items-start gap-2.5 px-4 py-3">
                        <span
                          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-white ${
                            item.met ? 'bg-emerald-500' : 'bg-slate-300'
                          }`}
                        >
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                            {item.met ? <polyline points="20 6 9 17 4 12" /> : <line x1="5" y1="12" x2="19" y2="12" />}
                          </svg>
                        </span>
                        <div>
                          <p className={`text-sm ${item.met ? 'text-slate-700' : 'text-slate-500'}`}>{item.text}</p>
                          {!item.met && (
                            <p className="mt-0.5 text-[10px] font-medium text-rose-500">Missing from document</p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
