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

import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useT } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/client';
import type {
  AaccAnalysis,
  VinUniStreamEvent,
} from '@/lib/ai/vinuni-grounded-evaluation';
import type {
  AaccAnalysisV2,
  ReviewClaim,
  VinUniRequestedSection,
  VinUniV2SectionEvent,
  VinUniV2StreamEvent,
} from '@/lib/ai/vinuni-evaluation-v2';
import {
  createVinUniInputHash,
  VINUNI_DEFAULT_ESSAY_PROMPT,
  VINUNI_DEMO_APPLICATION_ID,
} from '@/lib/ai/vinuni-evaluation-shared';
import type { LorReview } from '@/lib/ai/lor';
import type { AIAnalysis, AISuggestion } from '@/lib/types';
import {
  reviewClaimElementId,
  reviewClaimKey,
  VinUniAaccFeedback,
} from './VinUniAaccFeedback';

export type StatementSaveTarget =
  | { kind: 'university'; userUniversityId: number }
  | { kind: 'application'; applicationId: string }
  | { kind: 'demo' };

type DocType = 'personal_statement' | 'statement_of_purpose' | 'recommendation_letter';

type Props = {
  /** Where the draft is stored. */
  saveTarget: StatementSaveTarget;
  /** University / course name — used in the AI prompt and the draft title. */
  targetName: string;
  /** Optional programme context kept for caller compatibility. */
  contextNote?: string | null;
  initialContent: string;
  initialAnalysis: AIAnalysis | LorReview | StoredVinUniAnalysis | null;
  statementId: number | null;
  initialDocType?: DocType;
  /** Compact layout tuned for a modal (no fixed full-screen height). */
  embedded?: boolean;
  /** Full-page Apply workspace with a wider feedback pane and mobile pane switcher. */
  workspace?: boolean;
  /** Explicit evaluator selection for scoped MVP entry points. */
  evaluationMode?: 'generic' | 'vinuni';
  /** Reuse the editor and feedback UI for an application recommendation letter. */
  reviewType?: 'statement' | 'lor';
  onAnalysisStart?: () => void;
  onAnalysisComplete?: () => void;
  onAnalysisError?: () => void;
  requestedWorkspacePane?: 'essay' | 'feedback';
};

type VinUniAnalysis = AaccAnalysis | AaccAnalysisV2;
type ReviewAnalysis = AIAnalysis | LorReview;

export type StoredVinUniAnalysis = {
  schemaVersion: string;
  rubricVersion: string;
  promptVersion: string;
  essayPrompt: string;
  inputHash: string;
  analysis: AaccAnalysisV2;
};

function isLorReview(analysis: ReviewAnalysis): analysis is LorReview {
  return 'dimensions' in analysis && Array.isArray(analysis.dimensions);
}

function formatCoverageStatus(status: LorReview['profileCoverage'][number]['status']) {
  const words = status.replaceAll('_', ' ');
  return words[0].toUpperCase() + words.slice(1);
}

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

const EMPTY_PILLAR = {
  score: 0,
  analysis: [],
  strengths: [],
  gaps: [],
  evidenceQuotes: [],
};

function emptyVinUniAnalysis(): AaccAnalysis {
  return {
    overall: { score: 0, verdict: 'needs-work', summary: '' },
    pillars: {
      ability: { ...EMPTY_PILLAR },
      aspirations: { ...EMPTY_PILLAR },
      creativity: { ...EMPTY_PILLAR },
      commitment: { ...EMPTY_PILLAR },
    },
    topRecommendations: [],
    sections: {
      overallSummary: [],
      ideasStructure: { strengths: [], weaknesses: [], suggestions: [] },
      hookEngagement: { analysis: [], suggestions: [] },
      nextSteps: [],
    },
  };
}

function emptyReview(): AaccAnalysisV2['review'] {
  const pillar = () => ({ score: 0, analysis: [], strengths: [], gaps: [] });
  return {
    overall: [],
    ideasStructure: { strengths: [], weaknesses: [], suggestions: [] },
    hookEngagement: { analysis: [], suggestions: [] },
    pillars: {
      ability: pillar(),
      aspirations: pillar(),
      creativity: pillar(),
      commitment: pillar(),
    },
    nextSteps: { actions: [], questions: [] },
  };
}

function ensureV2Analysis(current: VinUniAnalysis): AaccAnalysisV2 {
  if ('review' in current) return current;
  return {
    ...current,
    isComplete: false,
    context: {
      profileStatus: 'not_available',
      programmeConfidence: 'low',
      programmeName: null,
    },
    evidenceMap: {
      essaySegments: [],
      claims: [],
      reflectionArcs: [],
      promptCoverage: [],
      aaccCoverage: {
        ability: { evidenceIds: [], strength: 'none' },
        aspirations: { evidenceIds: [], strength: 'none' },
        creativity: { evidenceIds: [], strength: 'none' },
        commitment: { evidenceIds: [], strength: 'none' },
      },
      informationGaps: [],
      possiblePromptInjection: false,
    },
    review: emptyReview(),
  };
}

function isStoredVinUniAnalysis(
  value: AIAnalysis | StoredVinUniAnalysis | null,
): value is StoredVinUniAnalysis {
  return Boolean(
    value &&
      'schemaVersion' in value &&
      'analysis' in value &&
      typeof value.analysis === 'object',
  );
}

function applyVinUniSection(
  current: VinUniAnalysis,
  event:
    | Extract<VinUniStreamEvent, { type: 'section' }>
    | VinUniV2SectionEvent,
): VinUniAnalysis {
  const textOf = (items: { text: string }[]) => items.map(({ text }) => text);
  if (event.section === 'A') {
    const items = textOf(event.data.items);
    const next = {
      ...current,
      overall: { ...current.overall, summary: items.join(' ') },
      sections: { ...current.sections!, overallSummary: items },
    };
    if (event.data.items.some((item) => 'evidenceRefs' in item)) {
      const v2 = ensureV2Analysis(next);
      return { ...v2, review: { ...v2.review, overall: event.data.items as ReviewClaim[] } };
    }
    return next;
  }
  if (event.section === 'B') {
    const next = {
      ...current,
      sections: {
        ...current.sections!,
        ideasStructure: {
          strengths: textOf(event.data.strengths),
          weaknesses: event.data.weaknesses.map((group) => ({
            category: group.category,
            title: group.title,
            items: textOf(group.items),
          })),
          suggestions: textOf(event.data.suggestions),
        },
      },
    };
    if (
      [...event.data.strengths, ...event.data.suggestions].some(
        (item) => 'evidenceRefs' in item,
      )
    ) {
      const v2 = ensureV2Analysis(next);
      return {
        ...v2,
        review: {
          ...v2.review,
          ideasStructure: event.data as AaccAnalysisV2['review']['ideasStructure'],
        },
      };
    }
    return next;
  }
  if (event.section === 'C') {
    const next = {
      ...current,
      sections: {
        ...current.sections!,
        hookEngagement: {
          analysis: textOf(event.data.analysis),
          suggestions: textOf(event.data.suggestions),
        },
      },
    };
    if (
      [...event.data.analysis, ...event.data.suggestions].some(
        (item) => 'evidenceRefs' in item,
      )
    ) {
      const v2 = ensureV2Analysis(next);
      return {
        ...v2,
        review: {
          ...v2.review,
          hookEngagement: event.data as AaccAnalysisV2['review']['hookEngagement'],
        },
      };
    }
    return next;
  }
  if (event.section === 'D') {
    const next = {
      ...current,
      pillars: {
        ...current.pillars,
        [event.criterion]: {
          score: event.data.score * 10,
          analysis: textOf(event.data.analysis),
          strengths: textOf(event.data.strengths),
          gaps: textOf(event.data.gaps),
          evidenceQuotes: [],
        },
      },
    };
    if (
      [...event.data.analysis, ...event.data.strengths, ...event.data.gaps].some(
        (item) => 'evidenceRefs' in item,
      )
    ) {
      const v2 = ensureV2Analysis(next);
      return {
        ...v2,
        review: {
          ...v2.review,
          pillars: {
            ...v2.review.pillars,
            [event.criterion]: event.data as AaccAnalysisV2['review']['pillars'][typeof event.criterion],
          },
        },
      };
    }
    return next;
  }
  if (event.section === 'E') {
    if ('actions' in event.data) {
      const items = textOf(event.data.actions);
      const next: VinUniAnalysis = {
        ...current,
        sections: { ...current.sections!, nextSteps: items },
        topRecommendations: items.map((action, index) => ({
          id: `stream-rec-${index + 1}`,
          pillar: 'ability',
          action,
          rationale: '',
        })),
      };
      const v2 = ensureV2Analysis(next);
      return {
        ...v2,
        review: {
          ...v2.review,
          nextSteps: event.data,
        },
      };
    }
    const items = textOf(event.data.items);
    const next = {
      ...current,
      sections: { ...current.sections!, nextSteps: items },
      topRecommendations: items.map((action, index) => ({
        id: `stream-rec-${index + 1}`,
        pillar: 'ability',
        action,
        rationale: '',
      })),
    };
    return next as VinUniAnalysis;
  }
  const score = event.data.score;
  return {
    ...current,
    overall: {
      ...current.overall,
      score,
      verdict:
        score >= 90
          ? 'strong-fit'
          : score >= 70
            ? 'promising'
            : score >= 50
              ? 'needs-work'
              : 'misaligned',
    },
  };
}

async function readNdjson(
  response: Response,
  onEvent: (event: VinUniStreamEvent | VinUniV2StreamEvent) => void,
) {
  if (!response.body) throw new Error('AI service returned no stream.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (line.trim()) onEvent(JSON.parse(line) as VinUniStreamEvent);
    }
    if (done) break;
  }
  if (buffer.trim()) onEvent(JSON.parse(buffer) as VinUniStreamEvent);
}

export function StatementWriter({
  saveTarget,
  targetName,
  initialContent,
  initialAnalysis,
  statementId: initialStatementId,
  initialDocType = 'personal_statement',
  embedded = false,
  workspace = false,
  evaluationMode = 'generic',
  reviewType = 'statement',
  onAnalysisStart,
  onAnalysisComplete,
  onAnalysisError,
  requestedWorkspacePane,
}: Props) {
  const t = useT();
  const isLor = reviewType === 'lor';
  const isVinUni =
    !isLor &&
    (evaluationMode === 'vinuni' || /\bvin\s*(?:university|uni)\b/i.test(targetName));
  const storedVinUni = isStoredVinUniAnalysis(initialAnalysis) ? initialAnalysis : null;
  const supabase = useMemo(() => createClient(), []);
  const [text, setText] = useState(initialContent);
  const [analysis, setAnalysis] = useState<ReviewAnalysis | null>(
    isVinUni || isStoredVinUniAnalysis(initialAnalysis) ? null : initialAnalysis,
  );
  const [vinUniAnalysis, setVinUniAnalysis] = useState<VinUniAnalysis | null>(
    storedVinUni?.analysis ?? null,
  );
  const [essayPrompt, setEssayPrompt] = useState(
    storedVinUni?.essayPrompt ?? VINUNI_DEFAULT_ESSAY_PROMPT,
  );
  const [vinUniStatus, setVinUniStatus] = useState('');
  const [animateVinUniFeedback, setAnimateVinUniFeedback] = useState(false);
  const [missingSections, setMissingSections] = useState<VinUniRequestedSection[]>([]);
  const [activeEvidenceIds, setActiveEvidenceIds] = useState<string[]>([]);
  const [activeClaimKeys, setActiveClaimKeys] = useState<string[]>([]);
  const [status, setStatus] = useState<'idle' | 'analyzing' | 'done'>(
    storedVinUni || (!isVinUni && initialAnalysis) ? 'done' : 'idle',
  );
  const [activeTab, setActiveTab] = useState<'score' | 'suggestions' | 'checklist'>('suggestions');
  const [hoveredSuggestion, setHoveredSuggestion] = useState<string | null>(null);
  const [docType, setDocType] = useState<DocType>(
    isLor ? 'recommendation_letter' : initialDocType,
  );
  const [error, setError] = useState<string | null>(null);
  const [statementId, setStatementId] = useState<number | null>(initialStatementId);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'edit' | 'review'>(
    storedVinUni || (!isVinUni && initialAnalysis) ? 'review' : 'edit',
  );
  const [reviewEditing, setReviewEditing] = useState(false);
  const [workspacePane, setWorkspacePane] = useState<'essay' | 'feedback'>('essay');
  const analysisAbortRef = useRef<AbortController | null>(null);
  const textRef = useRef(text);
  const promptRef = useRef(essayPrompt);
  textRef.current = text;
  promptRef.current = essayPrompt;

  useEffect(() => () => analysisAbortRef.current?.abort(), []);
  useEffect(() => {
    if (requestedWorkspacePane) setWorkspacePane(requestedWorkspacePane);
  }, [requestedWorkspacePane]);

  const wordCount = text.split(/\s+/).filter((w) => w.length > 0).length;
  const minimumAnalysisLength = isVinUni ? 200 : isLor ? 80 : 20;

  const saveDraft = useCallback(
    async (content: string, aiAnalysis?: unknown) => {
      if (saveTarget.kind === 'demo') {
        setSaveStatus(t('Demo · data is not saved'));
        setTimeout(() => setSaveStatus(null), 2000);
        return;
      }
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const payload: Record<string, unknown> = {
        user_id: userData.user.id,
        title: `${isLor ? 'Recommendation letter' : 'Statement'} for ${targetName}`,
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
    [supabase, targetName, docType, analysis, saveTarget, statementId, isLor, t],
  );

  const handleAnalyze = useCallback(async (retrySections?: VinUniRequestedSection[]) => {
    if (text.trim().length < minimumAnalysisLength) return;
    onAnalysisStart?.();
    analysisAbortRef.current?.abort();
    const abortController = new AbortController();
    analysisAbortRef.current = abortController;
    setWorkspacePane('feedback');
    setStatus('analyzing');
    if (isVinUni) {
      setAnimateVinUniFeedback(true);
      if (workspace) setViewMode('review');
    }
    setError(null);
    setVinUniStatus(isVinUni ? t('AI is preparing the analysis…') : '');
    setMissingSections([]);
    if (isVinUni && !retrySections?.length) {
      setReviewEditing(false);
      setVinUniAnalysis(emptyVinUniAnalysis());
    }
    const submittedText = text;
    const submittedPrompt = essayPrompt;

    try {
      const res = await fetch(
        isVinUni ? '/api/ai/analyze-statement-aacc' : '/api/ai/analyze-statement',
        {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            isVinUni
              ? {
                  text: submittedText,
                  essayPrompt: submittedPrompt,
                  ...(saveTarget.kind === 'application'
                    ? { applicationId: saveTarget.applicationId }
                    : saveTarget.kind === 'demo'
                      ? { applicationId: VINUNI_DEMO_APPLICATION_ID }
                    : {}),
                  ...(retrySections?.length
                    ? { requestedSections: retrySections }
                    : {}),
                }
              : {
                  text,
                  docType,
                  targetUniversity: targetName,
                  ...(isLor && saveTarget.kind === 'application'
                    ? { applicationId: saveTarget.applicationId }
                    : {}),
                },
          ),
          signal: abortController.signal,
        },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Analysis failed');
      }

      if (isVinUni) {
        let completed = false;
        let streamError: string | null = null;
        const completeEvent: {
          current:
            | Extract<VinUniV2StreamEvent, { type: 'complete' }>
            | Extract<VinUniStreamEvent, { type: 'complete' }>
            | null;
        } = { current: null };
        await readNdjson(res, (event) => {
          if (event.type === 'status') {
            setVinUniStatus(event.message);
          } else if (event.type === 'evidence_map') {
            setVinUniAnalysis((current) => ({
              ...ensureV2Analysis(current ?? emptyVinUniAnalysis()),
              evidenceMap: event.data,
            }));
          } else if (event.type === 'diagnostics') {
            setVinUniAnalysis((current) => ({
              ...ensureV2Analysis(current ?? emptyVinUniAnalysis()),
              diagnostics: event.data,
            }));
          } else if (event.type === 'section') {
            setVinUniAnalysis((current) =>
              applyVinUniSection(current ?? emptyVinUniAnalysis(), event),
            );
          } else if (event.type === 'complete') {
            if (
              'inputHash' in event &&
              event.inputHash !==
                createVinUniInputHash(textRef.current, promptRef.current)
            ) {
              return;
            }
            completed = true;
            completeEvent.current = event;
            if (!('isComplete' in event.analysis) || event.analysis.isComplete) {
              setVinUniAnalysis(event.analysis);
            }
          } else {
            streamError = event.message;
            setMissingSections(
              event.sections.filter((section): section is VinUniRequestedSection =>
                [
                  'A',
                  'B',
                  'C',
                  'D:ability',
                  'D:aspirations',
                  'D:creativity',
                  'D:commitment',
                  'E',
                ].includes(section),
              ),
            );
          }
        });
        if (!completed && !streamError && !retrySections?.length) {
          throw new Error('AI stream ended before completion.');
        }
        if (streamError) setError(streamError);
        setStatus('done');
        setVinUniStatus('');
        setViewMode('review');
        if (
          completeEvent.current &&
          'versions' in completeEvent.current &&
          completeEvent.current.analysis.isComplete
        ) {
          await saveDraft(submittedText, {
            schemaVersion: completeEvent.current.versions.schema,
            rubricVersion: completeEvent.current.versions.rubric,
            promptVersion: completeEvent.current.versions.prompt,
            essayPrompt: submittedPrompt,
            inputHash: completeEvent.current.inputHash,
            analysis: completeEvent.current.analysis,
          } satisfies StoredVinUniAnalysis);
        }
        return;
      }

      setVinUniAnalysis(null);
      const genericResult = (await res.json()) as ReviewAnalysis;
      setAnalysis(genericResult);
      setStatus('done');
      setActiveTab('suggestions');
      setViewMode('review');
      await saveDraft(text, genericResult);
      onAnalysisComplete?.();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Analysis failed. Please try again.');
      setStatus('idle');
      onAnalysisError?.();
    } finally {
      if (analysisAbortRef.current === abortController) analysisAbortRef.current = null;
    }
  }, [
    text,
    essayPrompt,
    docType,
    targetName,
    saveDraft,
    saveTarget,
    isVinUni,
    isLor,
    minimumAnalysisLength,
    workspace,
    onAnalysisStart,
    onAnalysisComplete,
    onAnalysisError,
    t,
  ]);

  const acceptSuggestion = (suggestion: AISuggestion) => {
    if (!suggestion.originalText || !text.includes(suggestion.originalText)) return;
    setText((prev) => prev.replace(suggestion.originalText, suggestion.replacement));
    if (analysis) {
      setAnalysis({
        ...analysis,
        suggestions: analysis.suggestions.filter((s) => s.id !== suggestion.id),
      });
    }
  };

  const allReviewClaims = useCallback(() => {
    if (!vinUniAnalysis || !('review' in vinUniAnalysis)) return [];
    const review = vinUniAnalysis.review;
    return [
      ...(vinUniAnalysis.diagnostics?.issues ?? []),
      ...review.overall,
      ...review.ideasStructure.strengths,
      ...review.ideasStructure.weaknesses.flatMap(({ items }) => items),
      ...review.ideasStructure.suggestions,
      ...review.hookEngagement.analysis,
      ...review.hookEngagement.suggestions,
      ...Object.values(review.pillars).flatMap((pillar) => [
        ...pillar.analysis,
        ...pillar.strengths,
        ...pillar.gaps,
      ]),
      ...review.nextSteps.actions,
      ...review.nextSteps.questions,
    ];
  }, [vinUniAnalysis]);

  const selectReviewClaim = useCallback((claim: ReviewClaim) => {
    const essayIds = claim.evidenceRefs
      .filter(({ source }) => source === 'essay')
      .map(({ id }) => id);
    setActiveClaimKeys([reviewClaimKey(claim)]);
    setActiveEvidenceIds(essayIds);
    setViewMode('review');
    if (workspace && essayIds.length) setWorkspacePane('essay');
    window.requestAnimationFrame(() => {
      document.getElementById(`evidence-${essayIds[0]}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    });
  }, [workspace]);

  const selectEssayEvidence = useCallback(
    (evidenceId: string) => {
      const claims = allReviewClaims()
        .filter((claim) =>
          claim.evidenceRefs.some(
            (reference) =>
              reference.source === 'essay' && reference.id === evidenceId,
          ),
        );
      setActiveEvidenceIds([evidenceId]);
      setActiveClaimKeys(claims.map(reviewClaimKey));
      if (workspace) setWorkspacePane('feedback');
      window.requestAnimationFrame(() => {
        const firstClaim = claims[0];
        if (!firstClaim) return;
        document.getElementById(reviewClaimElementId(firstClaim))?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      });
    },
    [allReviewClaims, workspace],
  );

  const renderVinUniEvidence = () => {
    const mappedAnalysis =
      vinUniAnalysis && 'evidenceMap' in vinUniAnalysis ? vinUniAnalysis : null;
    const diagnosticEvidenceIds = new Set<string>(
      mappedAnalysis?.diagnostics?.issues.flatMap((issue) =>
        issue.evidenceRefs
          .filter(({ source }) => source === 'essay')
          .map(({ id }) => id),
      ) ?? [],
    );
    const linkedEvidenceIds = new Set<string>(
      allReviewClaims().flatMap((claim) =>
        claim.evidenceRefs
          .filter(({ source }) => source === 'essay')
          .map(({ id }) => id),
      ),
    );
    const elements: React.ReactNode[] = [];
    let cursor = 0;
    for (const segment of mappedAnalysis?.evidenceMap.essaySegments ?? []) {
      const index = text.indexOf(segment.text, cursor);
      if (index < 0) continue;
      if (index > cursor) elements.push(text.slice(cursor, index));
      if (
        !linkedEvidenceIds.has(segment.evidence_id) &&
        !diagnosticEvidenceIds.has(segment.evidence_id)
      ) {
        elements.push(segment.text);
        cursor = index + segment.text.length;
        continue;
      }
      const active = activeEvidenceIds.includes(segment.evidence_id);
      const needsImprovement = diagnosticEvidenceIds.has(segment.evidence_id);
      elements.push(
        <button
          key={segment.evidence_id}
          id={`evidence-${segment.evidence_id}`}
          type="button"
          aria-label={`${t('Evidence')} ${segment.evidence_id}: ${segment.text}`}
          data-active={active ? 'true' : 'false'}
          onClick={() => selectEssayEvidence(segment.evidence_id)}
          className={`inline rounded-[0.2em] text-left text-inherit transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 ${
            active
              ? 'bg-amber-200 text-slate-950 ring-2 ring-amber-400'
              : needsImprovement
                ? 'bg-amber-100/80 text-slate-950'
                : 'hover:bg-amber-50'
          }`}
        >
          {segment.text}
        </button>,
      );
      cursor = index + segment.text.length;
    }
    if (cursor < text.length) elements.push(text.slice(cursor));
    return (
      <p
        data-testid="essay-manuscript"
        className="whitespace-pre-wrap text-base leading-8 text-slate-700"
      >
        {elements}
      </p>
    );
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

  const renderVinUniReviewEditor = () => (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <p className="text-xs font-medium text-slate-500">
          {reviewEditing ? t('Editing · old result is not updated') : `${wordCount} ${t('words')}`}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setReviewEditing((current) => !current)}
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition duration-300 hover:border-pink-300 hover:text-pink-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-500"
          >
            {reviewEditing ? t('View highlights') : t('Edit essay')}
          </button>
          <button
            type="button"
            onClick={() => void handleAnalyze()}
            disabled={status === 'analyzing' || text.trim().length < minimumAnalysisLength}
            className="rounded-full bg-pink-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition duration-300 hover:bg-pink-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status === 'analyzing' ? t('Analysing…') : t('Analyse again')}
          </button>
        </div>
      </div>
      {reviewEditing ? (
        <textarea
          aria-label={t('Edit essay')}
          value={text}
          onChange={(event) => setText(event.target.value)}
          className="min-h-[520px] w-full resize-y rounded-xl border border-slate-200 bg-white p-4 text-base leading-8 text-slate-700 outline-none transition focus:border-pink-300 focus:ring-2 focus:ring-pink-100"
        />
      ) : (
        renderVinUniEvidence()
      )}
    </div>
  );

  const vinUniWorkspaceReview = Boolean(
    workspace &&
      isVinUni &&
      vinUniAnalysis &&
      viewMode === 'review',
  );
  const outerClass = vinUniWorkspaceReview
    ? 'block min-h-0 flex-1 overflow-y-auto bg-slate-50'
    : embedded
      ? 'flex min-h-0 min-w-0 w-full flex-1 flex-col gap-10 bg-[#FAFAFA] lg:flex-row'
      : 'flex min-w-0 w-full flex-1 flex-col gap-10 overflow-hidden bg-[#FAFAFA] lg:flex-row';

  return (
    <div className={outerClass}>
      {workspace && !vinUniWorkspaceReview && (
        <div className="grid shrink-0 grid-cols-2 rounded-lg border border-neutral-200 bg-white p-2 lg:hidden">
          {[
            ['essay', isLor ? 'Recommendation letter' : 'Essay'],
            ['feedback', 'Feedback'],
          ].map(([pane, label]) => (
            <button
              key={pane}
              type="button"
              onClick={() => setWorkspacePane(pane as 'essay' | 'feedback')}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                workspacePane === pane
                  ? 'bg-pink-50 text-pink-600'
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {t(label)}
            </button>
          ))}
        </div>
      )}
      {/* ── Left: Editor ── */}
      {!vinUniWorkspaceReview ? <section
        aria-label={isLor ? t('Recommendation letter') : t('Essay')}
        className={`${workspace && workspacePane !== 'essay' ? 'hidden lg:flex' : 'flex'} min-h-0 min-w-0 flex-1 flex-col rounded-2xl border border-neutral-300 bg-white lg:basis-0`}
      >
        <div className="flex shrink-0 flex-col items-stretch gap-4 px-4 pt-6 md:px-6">
          <h2 className="font-display text-2xl font-medium leading-8 text-neutral-900">
            {isLor ? 'Your recommendation letter' : 'Your essay'}
          </h2>
          <div className="flex items-center gap-3">
            {isLor ? (
              <span className="rounded-full bg-rose-50 px-4 py-1 text-sm font-medium text-rose-600">
                Letter of Recommendation
              </span>
            ) : (
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value as DocType)}
                className={isLor ? 'rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 focus:border-pink-300 focus:outline-none' : 'rounded-full border-0 bg-rose-50 px-4 py-1 text-sm font-medium text-rose-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600'}
              >
                <option value="personal_statement">Personal Statement</option>
                <option value="statement_of_purpose">Statement of Purpose</option>
              </select>
            )}
            <span className="rounded-full bg-rose-50 px-4 py-1 text-sm font-medium tabular-nums text-rose-600">{wordCount} words</span>
            {saveStatus && <span className="text-xs font-medium text-emerald-500">{saveStatus}</span>}
          </div>
          <div className="flex items-center gap-2">
            {(analysis || vinUniAnalysis) && (
              <button
                type="button"
                onClick={() => setViewMode((m) => (m === 'edit' ? 'review' : 'edit'))}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                {viewMode === 'edit' ? 'Review' : 'Edit'}
              </button>
            )}
            {!isVinUni && (
              <button
                type="button"
                onClick={() => saveDraft(text)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Save draft
              </button>
            )}
          </div>
        </div>

        <div className={`min-h-0 flex-1 overflow-y-auto p-4 md:p-6 ${embedded ? 'max-h-[42vh] lg:max-h-none' : ''}`}>
          {viewMode === 'edit' || status === 'analyzing' ? (
            <div className="flex h-full min-h-0 flex-col">
              {isVinUni ? (
                <label className="mb-4 block shrink-0 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                  <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                    {t('Essay prompt')}
                  </span>
                  <textarea
                    aria-label={t('Essay prompt')}
                    value={essayPrompt}
                    maxLength={2000}
                    onChange={(event) => setEssayPrompt(event.target.value)}
                    className="min-h-16 w-full resize-y bg-transparent text-sm leading-5 text-slate-700 outline-none"
                  />
                </label>
              ) : null}
              <div className="relative min-h-0 flex-1">
              <textarea
                aria-label={isLor ? t('Letter of recommendation draft') : t('Essay content')}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={
                  isLor
                    ? `Paste the recommendation letter here. We'll give specific feedback grounded in ${targetName}.`
                    : `Paste your ${docType === 'statement_of_purpose' ? 'statement of purpose' : 'personal statement'} here, or start writing. We'll give you specific feedback on how to strengthen it for ${targetName}.`
                }
                className="h-full min-h-[240px] w-full resize-none rounded-lg border border-rose-100 p-3 text-base leading-relaxed text-neutral-700 shadow-sm outline-none transition placeholder:text-neutral-400 focus:border-rose-300 focus:ring-2 focus:ring-rose-100"
              />
              <div className="pointer-events-none absolute bottom-2 right-3 text-xs text-slate-400">
                {wordCount} words
                {!isLor && docType === 'personal_statement' && (
                  <span className={wordCount > 650 ? ' font-medium text-red-500' : ''}> · UCAS max: 650</span>
                )}
              </div>
              </div>
            </div>
          ) : (
            <div className="relative min-h-full">
              {isVinUni &&
              vinUniAnalysis &&
              'evidenceMap' in vinUniAnalysis &&
              vinUniAnalysis.evidenceMap.essaySegments.length
                ? renderVinUniEvidence()
                : renderHighlightedText()}
            </div>
          )}
        </div>
        <div className="shrink-0 px-4 pb-6 md:px-6">
          <button
            type="button"
            onClick={() => void handleAnalyze()}
            disabled={status === 'analyzing' || text.trim().length < minimumAnalysisLength}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-rose-600 px-5 text-base font-semibold text-white shadow-sm transition hover:bg-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span aria-hidden="true">✦</span>
            {status === 'analyzing'
              ? 'Analyzing…'
              : status === 'done'
                ? 'Re-analyze'
                : 'Analyze'}
          </button>
        </div>
      </section> : null}

      {/* ── Right: Analysis Panel ── */}
      <section
        aria-label={t('Feedback')}
        className={vinUniWorkspaceReview
          ? 'block w-full bg-slate-50'
          : `${workspace && workspacePane !== 'feedback' ? 'hidden lg:flex' : 'flex'} min-h-0 min-w-0 flex-1 flex-col rounded-2xl border border-neutral-300 bg-white lg:basis-0`}
      >
        {!vinUniWorkspaceReview && (
          <h2 className="px-4 pt-6 font-display text-2xl font-medium leading-8 text-neutral-900 md:px-6">
            AI Feedback
          </h2>
        )}
        {isVinUni && !vinUniAnalysis ? (
          <div className="flex flex-wrap gap-2 border-b border-slate-200 bg-white px-4 py-3 text-[11px] font-semibold text-slate-600">
            <span className="rounded-full border border-slate-200 px-3 py-1.5">Essay</span>
            <span className="rounded-full border border-pink-200 bg-pink-50 px-3 py-1.5">VinUni AACC</span>
            <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5">{t('Programme · server confirmed')}</span>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5">{t('Profile · if available')}</span>
          </div>
        ) : null}
        {status === 'idle' && !analysis && !vinUniAnalysis && (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 overflow-y-auto p-6 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-rose-50 text-4xl text-rose-600" aria-hidden="true">
              ✦
            </div>
            <p className="text-sm text-neutral-500">
              Your feedback will appear here once you submit your {isLor ? 'letter' : 'essay'}
            </p>
          </div>
        )}

        {status === 'analyzing' && !vinUniAnalysis && (
          <div className="flex flex-1 flex-col items-center justify-center p-8">
            <div className="mb-4 h-10 w-10 animate-spin rounded-full border-[3px] border-pink-200 border-t-pink-500" />
            <h2 className="text-base font-semibold text-slate-600">
              {isLor ? 'Reviewing the recommendation letter…' : 'Reading like an admissions officer…'}
            </h2>
            <p className="mt-1 text-xs text-slate-400">Checking tone, evidence, and programme fit.</p>
          </div>
        )}

        {vinUniStatus ? (
          <div
            role="status"
            className="mx-4 mt-4 flex items-center gap-3 rounded-xl border border-pink-200 bg-white px-4 py-3 text-sm font-medium text-slate-700"
          >
            <span className="h-2 w-2 animate-pulse rounded-full bg-pink-500" aria-hidden />
            {vinUniStatus}
          </div>
        ) : null}

        {error && (
          <div className="m-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <p>{error}</p>
            {missingSections.length ? (
              <button
                type="button"
                onClick={() => void handleAnalyze(missingSections)}
                className="mt-3 rounded-full border border-red-300 bg-white px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
              >
                {t('Retry missing sections')}
              </button>
            ) : null}
          </div>
        )}

        {vinUniAnalysis && (
          <div
            className={
              vinUniWorkspaceReview
                ? 'p-4 md:p-6'
                : 'min-h-0 flex-1 overflow-y-auto p-4'
            }
          >
            {'context' in vinUniAnalysis ? (
              <div className="mb-3 flex flex-wrap gap-2 text-[11px] font-semibold text-slate-600">
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">Essay</span>
                <span className="rounded-full border border-pink-200 bg-pink-50 px-3 py-1.5">VinUni AACC</span>
                <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5">
                  Programme · {vinUniAnalysis.context.programmeName ?? 'VinUni chung'}
                </span>
                <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5">
                  {t('Profile')} · {vinUniAnalysis.context.profileStatus === 'available' ? t('Used') : t('Not available')}
                </span>
              </div>
            ) : null}
            <VinUniAaccFeedback
              analysis={vinUniAnalysis}
              manuscript={vinUniWorkspaceReview ? renderVinUniReviewEditor() : undefined}
              streaming={animateVinUniFeedback}
              loading={status === 'analyzing'}
              activeClaimKeys={activeClaimKeys}
              onEvidenceSelect={selectReviewClaim}
              onTryAgain={() => {
                analysisAbortRef.current?.abort();
                setVinUniAnalysis(null);
                setActiveClaimKeys([]);
                setActiveEvidenceIds([]);
                setMissingSections([]);
                setStatus('idle');
                setAnimateVinUniFeedback(false);
                setViewMode('edit');
              }}
            />
          </div>
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
                        {isLor ? 'Recommendation readiness' : 'Admissions readiness'}
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
                  {isLor && isLorReview(analysis) ? (
                    <>
                      <div className="rounded-xl border border-pink-200 bg-pink-50 p-5">
                        <p className="text-xs font-semibold uppercase tracking-widest text-pink-600">
                          Overall quality
                        </p>
                        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
                          <p className="text-lg font-bold text-slate-900">{analysis.recommendation}</p>
                          <p className="font-mono text-sm font-bold text-slate-600">
                            {analysis.rawScore}/85
                          </p>
                        </div>
                      </div>

                      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                            Quality dimensions
                          </p>
                        </div>
                        <ol className="divide-y divide-slate-100">
                          {analysis.dimensions.map((dimension) => (
                            <li key={dimension.id} className="px-4 py-3">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-semibold text-slate-800">
                                  {dimension.label}
                                </p>
                                <span className="shrink-0 font-mono text-xs font-bold text-pink-600">
                                  {dimension.score}/{dimension.maxScore}
                                </span>
                              </div>
                              <p className="mt-1 text-xs leading-5 text-slate-500">
                                {dimension.rationale}
                              </p>
                            </li>
                          ))}
                        </ol>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-white p-5">
                        <p className="text-xs font-bold tracking-[0.14em] text-emerald-700">
                          WHAT WORKS WELL
                        </p>
                        <div className="mt-3 space-y-4">
                          {analysis.whatWorksWell.map((item) => (
                            <article key={item.title}>
                              <h4 className="text-sm font-semibold text-slate-900">{item.title}</h4>
                              <p className="mt-1 text-sm leading-6 text-slate-600">{item.explanation}</p>
                              {item.evidenceQuote ? (
                                <blockquote className="mt-2 border-l-2 border-emerald-300 pl-3 text-xs italic text-slate-500">
                                  “{item.evidenceQuote}”
                                </blockquote>
                              ) : null}
                            </article>
                          ))}
                        </div>
                      </div>

                      {analysis.improvements.length ? (
                        <div className="rounded-xl border border-slate-200 bg-white p-5">
                          <p className="text-xs font-bold tracking-[0.14em] text-amber-700">
                            WHAT COULD BE STRONGER
                          </p>
                          <div className="mt-3 space-y-4">
                            {analysis.improvements.map((item) => (
                              <article key={item.title}>
                                <h4 className="text-sm font-semibold text-slate-900">{item.title}</h4>
                                <p className="mt-1 text-sm leading-6 text-slate-600">{item.explanation}</p>
                              {!isLor ? (
                                <p className="mt-2 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-slate-700">
                                  <span className="font-semibold">Suggestion:</span> {item.suggestion}
                                </p>
                              ) : null}
                              </article>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      <div className="rounded-xl border border-slate-200 bg-white p-5">
                        <p className="text-xs font-bold tracking-[0.14em] text-slate-500">
                          PROFILE COVERAGE
                        </p>
                        <div className="mt-3 space-y-3">
                          {analysis.profileCoverage.map((item) => (
                            <article key={item.trait} className="rounded-lg bg-slate-50 p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <h4 className="text-sm font-semibold text-slate-900">{item.trait}</h4>
                                <span className="text-xs font-semibold text-pink-600">
                                  {formatCoverageStatus(item.status)}
                                </span>
                              </div>
                              <p className="mt-1 text-xs leading-5 text-slate-500">{item.explanation}</p>
                            </article>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : null}
                </div>
              )}

              {activeTab === 'suggestions' && (
                <div className="space-y-3">
                  {analysis.suggestions.length === 0 ? (
                    <div className="py-8 text-center">
                      <p className="text-sm text-slate-500">
                        All suggestions applied. Your {isLor ? 'letter' : 'statement'} is looking strong.
                      </p>
                    </div>
                  ) : (
                    analysis.suggestions.map((sug) => {
                      const styles = SUGGESTION_STYLES[sug.type];
                      const canApply = Boolean(sug.originalText && text.includes(sug.originalText));
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

                          {isLor ? (
                            <div className={`rounded-lg border-l-2 p-3 text-sm ${styles.highlight} ${styles.bar}`}>
                              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                {sug.originalText ? 'Review this part' : 'Information to add'}
                              </p>
                              <p className="mt-1 font-medium text-slate-700">
                                {sug.originalText || 'Add a truthful, directly observed detail to strengthen this point.'}
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-2 text-sm">
                              <div className="border-l-2 border-rose-200 pl-3">
                                <p className="text-slate-400 line-through">{sug.originalText}</p>
                              </div>
                              <div className="border-l-2 border-emerald-400 pl-3">
                                <p className="font-medium text-slate-700">{sug.replacement}</p>
                              </div>
                            </div>
                          )}

                          <p className="mt-3 rounded-lg bg-slate-50 p-2.5 text-xs leading-relaxed text-slate-500">
                            {sug.explanation}
                          </p>

                          {isLor ? (
                            <p className="mt-3 text-xs font-medium text-slate-500">
                              Update this directly in the letter draft using facts your recommender can verify.
                            </p>
                          ) : (
                            <button
                              type="button"
                              onClick={() => acceptSuggestion(sug)}
                              disabled={!canApply}
                              className="mt-3 w-full rounded-lg border border-pink-300 bg-white py-2 text-xs font-semibold text-pink-600 transition hover:bg-pink-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                            >
                              {canApply ? 'Apply change' : 'Manual edit required'}
                            </button>
                          )}
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
                      {isLor ? 'Recommendation criteria' : 'Admissions criteria'}
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
