'use client';

import { useMemo, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { AIAnalysis, AISuggestion } from '@/lib/types';

type Props = {
  universityName: string;
  universityCountry?: string;
  universityRank?: number | null;
  universityAcceptRate?: string | null;
  universityStrengths?: string | null;
  userUniversityId: number;
  initialContent: string;
  initialAnalysis: AIAnalysis | null;
  statementId: number | null;
};

function ScoreRing({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 16;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : score >= 40 ? '#f97316' : '#ef4444';

  return (
    <div className="relative w-16 h-16">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="16" fill="none" stroke="#f1f5f9" strokeWidth="3" />
        <circle
          cx="18" cy="18" r="16" fill="none"
          stroke={color} strokeWidth="3" strokeLinecap="round"
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

export function StatementWriter({
  universityName,
  universityCountry,
  universityRank,
  universityAcceptRate,
  universityStrengths,
  userUniversityId,
  initialContent,
  initialAnalysis,
  statementId: initialStatementId,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [text, setText] = useState(initialContent);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(initialAnalysis);
  const [status, setStatus] = useState<'idle' | 'analyzing' | 'done'>(initialAnalysis ? 'done' : 'idle');
  const [activeTab, setActiveTab] = useState<'score' | 'suggestions' | 'checklist'>('suggestions');
  const [hoveredSuggestion, setHoveredSuggestion] = useState<string | null>(null);
  const [docType, setDocType] = useState('personal_statement');
  const [error, setError] = useState<string | null>(null);
  const [statementId, setStatementId] = useState<number | null>(initialStatementId);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const wordCount = text.split(/\s+/).filter((w) => w.length > 0).length;

  const handleAnalyze = useCallback(async () => {
    if (!text.trim() || text.trim().length < 20) return;
    setStatus('analyzing');
    setError(null);

    try {
      const res = await fetch('/api/ai/analyze-statement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          docType,
          targetUniversity: universityName,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Analysis failed');
      }

      const result: AIAnalysis = await res.json();
      setAnalysis(result);
      setStatus('done');
      setActiveTab('suggestions');

      // Save draft + analysis
      await saveDraft(text, result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed. Please try again.');
      setStatus('idle');
    }
  }, [text, docType, universityName]);

  const saveDraft = async (content: string, aiAnalysis?: AIAnalysis | null) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const payload = {
      user_id: userData.user.id,
      user_university_id: userUniversityId,
      title: `Statement for ${universityName}`,
      content,
      doc_type: docType,
      ai_analysis: aiAnalysis ?? analysis,
      updated_at: new Date().toISOString(),
    };

    if (statementId) {
      await supabase
        .from('personal_statements')
        .update(payload)
        .eq('id', statementId);
    } else {
      const { data } = await supabase
        .from('personal_statements')
        .insert(payload)
        .select('id')
        .single();
      if (data) setStatementId(data.id);
    }

    setSaveStatus('Saved');
    setTimeout(() => setSaveStatus(null), 2000);
  };

  const acceptSuggestion = (suggestion: AISuggestion) => {
    const newText = text.replace(suggestion.originalText, suggestion.replacement);
    setText(newText);

    if (analysis) {
      setAnalysis({
        ...analysis,
        suggestions: analysis.suggestions.filter((s) => s.id !== suggestion.id),
      });
    }
  };

  // Render text with highlights
  const renderHighlightedText = () => {
    if (!analysis?.suggestions?.length) {
      return <p className="whitespace-pre-wrap leading-relaxed text-slate-700 text-base">{text}</p>;
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

        const bgColor =
          sug.type === 'weak' ? 'bg-yellow-100' : sug.type === 'missing' ? 'bg-blue-100' : 'bg-red-100';

        elements.push(
          <span
            key={`m-${i}`}
            className={`${bgColor} px-0.5 rounded cursor-pointer transition-all ${
              hoveredSuggestion === sug.id ? 'ring-2 ring-slate-800 font-medium' : ''
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

    return <p className="whitespace-pre-wrap leading-relaxed text-slate-700 text-base">{elements}</p>;
  };

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* ── Left: Editor ── */}
      <section className="w-[60%] flex flex-col border-r border-slate-200">
        <div className="shrink-0 px-6 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600"
            >
              <option value="personal_statement">Personal Statement</option>
              <option value="statement_of_purpose">Statement of Purpose</option>
            </select>
            <span className="text-xs text-slate-400 tabular-nums">{wordCount} words</span>
            {saveStatus && (
              <span className="text-xs text-emerald-500 font-medium">{saveStatus}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => saveDraft(text)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
            >
              Save draft
            </button>
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={status === 'analyzing' || text.trim().length < 20}
              className={`rounded-lg px-4 py-1.5 text-xs font-bold text-white transition-all ${
                status === 'analyzing'
                  ? 'bg-emerald-400 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {status === 'analyzing' ? '⏳ Analyzing…' : status === 'done' ? '⚡ Re-analyze' : '⚡ Analyze'}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {status === 'idle' || status === 'analyzing' ? (
            <div className="relative h-full">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste your personal statement here, or start writing. We'll give you specific feedback on how to strengthen it for this university."
                className="w-full h-full resize-none border-none outline-none text-base text-slate-700 leading-relaxed placeholder:text-slate-300"
              />
              <div className="absolute bottom-3 right-4 text-xs text-slate-400">
                {wordCount} words
                {docType === 'personal_statement' && (
                  <span className={wordCount > 650 ? ' text-red-500 font-medium' : ''}> · UCAS max: 650</span>
                )}
              </div>
            </div>
          ) : (
            <div className="relative min-h-full">
              {renderHighlightedText()}
              <button
                type="button"
                onClick={() => setStatus('idle')}
                className="fixed bottom-6 left-6 bg-white border border-slate-200 shadow-lg rounded-full px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 z-10"
              >
                ✏️ Edit text
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ── Right: Analysis Panel ── */}
      <section className="w-[40%] flex flex-col bg-slate-50">
        {status === 'idle' && (
          <div className="flex-1 flex flex-col p-6 space-y-5 overflow-y-auto">
            {universityStrengths && (
              <div className="bg-white p-5 rounded-xl border border-slate-200">
                <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold mb-3">
                  What {universityName} looks for
                </p>
                <p className="text-sm text-slate-600 leading-relaxed">{universityStrengths}</p>
              </div>
            )}

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-widest mb-2">
                Example feedback preview
              </p>
              <div className="space-y-2 text-sm text-amber-900 opacity-70">
                <p>✅ Strong opening — clear motivation stated</p>
                <p>✅ Relevant technical projects mentioned</p>
                <p>⚠️ No mention of why {universityName} specifically</p>
                <p>❌ No connection to {universityName}&apos;s research areas</p>
              </div>
              <p className="text-xs text-amber-600 mt-3 italic">
                This is a sample — paste your statement and click Analyze to see real feedback
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200">
              <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold mb-3">Tips</p>
              <ul className="space-y-2 text-sm text-slate-600">
                <li>• Be specific about why this university</li>
                <li>• Show, don&apos;t tell — use concrete examples</li>
                <li>• Connect your past to your future goals</li>
                <li>• Keep it under 650 words for UCAS</li>
              </ul>
            </div>
          </div>
        )}

        {status === 'analyzing' && (
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            <div className="w-10 h-10 border-3 border-emerald-200 border-t-emerald-500 rounded-full animate-spin mb-4" />
            <h2 className="text-base font-semibold text-slate-600">Reading like an admissions officer…</h2>
            <p className="text-xs text-slate-400 mt-1">Checking tone, impact, and course fit.</p>
          </div>
        )}

        {error && (
          <div className="p-4 m-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600">
            {error}
          </div>
        )}

        {status === 'done' && analysis && (
          <>
            {/* Tabs */}
            <div className="shrink-0 flex border-b border-slate-200 bg-white px-2 pt-2">
              {(['score', 'suggestions', 'checklist'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition ${
                    activeTab === tab
                      ? 'border-emerald-500 text-emerald-700'
                      : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {tab === 'score' && '📊 Score'}
                  {tab === 'suggestions' && (
                    <>
                      💬 Suggestions
                      {analysis.suggestions.length > 0 && (
                        <span className="bg-red-100 text-red-600 text-[10px] px-1.5 py-0.5 rounded-full">
                          {analysis.suggestions.length}
                        </span>
                      )}
                    </>
                  )}
                  {tab === 'checklist' && '✅ Checklist'}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {activeTab === 'score' && (
                <div className="space-y-4">
                  <div className="bg-white p-5 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Admissions Readiness</p>
                      <p className="text-2xl font-bold text-slate-800 mt-1">
                        {analysis.score}<span className="text-sm text-slate-400 font-medium">/100</span>
                      </p>
                    </div>
                    <ScoreRing score={analysis.score} />
                  </div>
                  <div className="bg-white p-5 rounded-xl border border-slate-200">
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">AI Summary</p>
                    <p className="text-sm text-slate-600 leading-relaxed">{analysis.summary}</p>
                  </div>
                </div>
              )}

              {activeTab === 'suggestions' && (
                <div className="space-y-3">
                  {analysis.suggestions.length === 0 ? (
                    <div className="text-center py-8">
                      <span className="text-3xl">✅</span>
                      <p className="text-sm text-slate-500 mt-2">All suggestions accepted! Your text looks great.</p>
                    </div>
                  ) : (
                    analysis.suggestions.map((sug) => {
                      const borderColor =
                        sug.type === 'weak' ? 'border-yellow-300' : sug.type === 'missing' ? 'border-blue-300' : 'border-red-300';
                      const bgColor =
                        sug.type === 'weak' ? 'bg-yellow-100 text-yellow-700' : sug.type === 'missing' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700';

                      return (
                        <div
                          key={sug.id}
                          className={`bg-white rounded-xl border p-4 transition-all ${
                            hoveredSuggestion === sug.id ? `ring-2 ${borderColor} shadow-md` : 'border-slate-200'
                          }`}
                          onMouseEnter={() => setHoveredSuggestion(sug.id)}
                          onMouseLeave={() => setHoveredSuggestion(null)}
                        >
                          <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded ${bgColor} mb-2`}>
                            {sug.category}
                          </span>

                          <div className="space-y-2 text-sm">
                            <div className="pl-3 border-l-2 border-red-200">
                              <p className="line-through text-slate-400">{sug.originalText}</p>
                            </div>
                            <div className="pl-3 border-l-2 border-emerald-400">
                              <p className="font-medium text-slate-700">{sug.replacement}</p>
                            </div>
                          </div>

                          <p className="mt-3 text-xs text-slate-500 leading-relaxed bg-slate-50 rounded-lg p-2.5">
                            💡 {sug.explanation}
                          </p>

                          <button
                            type="button"
                            onClick={() => acceptSuggestion(sug)}
                            className="mt-3 w-full rounded-lg border border-emerald-300 bg-white text-emerald-600 py-2 text-xs font-semibold hover:bg-emerald-50 transition"
                          >
                            Accept change
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {activeTab === 'checklist' && (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                      Admissions criteria
                    </p>
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {analysis.checklist.map((item) => (
                      <li key={item.id} className="px-4 py-3 flex items-start gap-2.5">
                        {item.met ? (
                          <span className="text-emerald-500 mt-0.5">✅</span>
                        ) : (
                          <span className="text-red-400 mt-0.5">❌</span>
                        )}
                        <div>
                          <p className={`text-sm ${item.met ? 'text-slate-700' : 'text-slate-500'}`}>
                            {item.text}
                          </p>
                          {!item.met && (
                            <p className="text-[10px] text-red-500 font-medium mt-0.5">Missing from document</p>
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
