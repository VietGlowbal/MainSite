'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  MATCH_PILLARS,
  PILLAR_ORDER,
  weightedScore,
  matchLabel,
  projectPillars,
  type PillarKey,
  type PillarBreakdown,
} from '@/lib/match-insights';
import { RadarPentagon } from './RadarPentagon';
import { PillarBox } from './PillarBox';
import { useLoadingIndicator } from '@/shared/ui/loading-overlay';

// Structural subset of the transformed ApplicationMatchAnalysis. `pillars` is
// stored as JSON, so it arrives loosely typed and is narrowed below.
export type MatchInsightsData = {
  pillars?: Record<string, unknown> | null;
  confidence?: number | null;
  currentMatchScore?: number | null;
  maxPossibleMatchScore?: number | null;
} | null | undefined;

export type ImprovementTaskLite = {
  pillar?: string | null;
  estimatedUplift?: number | null;
  status: string;
};

function scoreToneClass(score: number): string {
  if (score >= 70) return 'text-emerald-600';
  if (score >= 50) return 'text-amber-600';
  return 'text-rose-500';
}

export type MatchInputs = { cv: boolean; essay: boolean; academic: boolean };

export function MatchInsightsPanel({
  applicationId,
  analysis,
  isPlus,
  improvementTasks,
  inputs = { cv: false, essay: false, academic: false },
}: {
  applicationId: string;
  analysis: MatchInsightsData;
  isPlus: boolean;
  improvementTasks: ImprovementTaskLite[];
  inputs?: MatchInputs;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [busyPillar, setBusyPillar] = useState<PillarKey | null>(null);
  useLoadingIndicator(busy || busyPillar !== null, 'Recalculating your match');
  const [addedPillars, setAddedPillars] = useState<Set<PillarKey>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const pillars = useMemo(
    () => (analysis?.pillars ?? {}) as Record<PillarKey, PillarBreakdown>,
    [analysis?.pillars],
  );
  const hasAnalysis = PILLAR_ORDER.some((k) => pillars[k]);
  const hasAnyInput = inputs.cv || inputs.essay || inputs.academic;

  // Uplift from completed improvement tasks, per pillar → a projected score.
  const upliftByPillar = useMemo(() => {
    const acc: Partial<Record<PillarKey, number>> = {};
    for (const t of improvementTasks) {
      if (t.status !== 'completed' || !t.pillar) continue;
      const key = t.pillar as PillarKey;
      acc[key] = (acc[key] ?? 0) + (t.estimatedUplift ?? 0);
    }
    return acc;
  }, [improvementTasks]);

  const projected = useMemo(
    () => (hasAnalysis ? projectPillars(pillars, upliftByPillar) : pillars),
    [hasAnalysis, pillars, upliftByPillar],
  );

  const currentScore = hasAnalysis ? weightedScore(pillars, 'current') : 0;
  const maxScore = hasAnalysis ? weightedScore(pillars, 'max') : 0;
  const projectedScore = hasAnalysis ? weightedScore(projected, 'current') : 0;
  const showProjected = projectedScore > currentScore;

  const currentMap = Object.fromEntries(MATCH_PILLARS.map((p) => [p.key, pillars[p.key]?.current ?? 0]));
  const maxMap = Object.fromEntries(MATCH_PILLARS.map((p) => [p.key, pillars[p.key]?.max ?? 0]));
  const projectedMap = Object.fromEntries(MATCH_PILLARS.map((p) => [p.key, projected[p.key]?.current ?? 0]));

  async function runAnalysis() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/applications/${applicationId}/match-insights`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Analysis failed');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setBusy(false);
    }
  }

  async function addTasks(pillar: PillarKey) {
    setBusyPillar(pillar);
    setError(null);
    try {
      const res = await fetch(`/api/applications/${applicationId}/improvement-tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pillar }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.upgrade) {
          router.push('/plus');
          return;
        }
        throw new Error(data.error ?? 'Could not add tasks');
      }
      setAddedPillars((prev) => new Set(prev).add(pillar));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add tasks');
    } finally {
      setBusyPillar(null);
    }
  }

  const confidence = analysis?.confidence ?? null;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_4px_14px_rgba(15,23,42,0.04)] md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Your match insights</h2>
          <p className="text-sm text-slate-500">How well your profile, CV &amp; essay fit this course — and how to improve.</p>
        </div>
        {hasAnalysis ? (
          <button
            type="button"
            onClick={runAnalysis}
            disabled={busy}
            className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-pink-300 hover:text-pink-600 disabled:opacity-60"
          >
            {busy ? 'Analysing…' : 'Re-analyse'}
          </button>
        ) : null}
      </div>

      {error ? <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p> : null}

      {!hasAnalysis ? (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6">
          <p className="mx-auto max-w-md text-center text-sm text-slate-500">
            We’ll score how you match this course across five areas — but first add the documents below
            so the score reflects the real you (not an empty 0%).
          </p>

          <ul className="mx-auto mt-4 max-w-md space-y-2">
            <InputRow done={inputs.cv} label="Your CV / résumé" href="/profile/documents" cta="Upload CV" />
            <InputRow done={inputs.essay} label="Your personal statement / essay" href="/profile/documents" cta="Upload essay" />
            <InputRow done={inputs.academic} label="Your grades & academic background" href="/profile/academic" cta="Add grades" />
          </ul>

          <div className="mt-5 flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={runAnalysis}
              disabled={busy || !hasAnyInput}
              title={hasAnyInput ? undefined : 'Add your CV, essay or grades first'}
              className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_22px_rgba(255,77,140,0.25)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? 'Analysing your match…' : 'Analyse my match'}
            </button>
            {!hasAnyInput ? (
              <p className="text-xs text-slate-400">Add at least one of the above to get a score.</p>
            ) : null}
          </div>
        </div>
      ) : (
        <>
          {/* Headline scores */}
          <div className="mt-5 grid gap-4 lg:grid-cols-[320px_1fr]">
            <div className="flex flex-col items-center justify-center rounded-2xl bg-slate-50/70 p-4">
              <RadarPentagon current={currentMap} max={maxMap} projected={showProjected ? projectedMap : undefined} />
              <div className="mt-1 flex items-center gap-4 text-[11px] text-slate-500">
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#FF3D9A]" />Current</span>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-3 rounded-full border border-dashed border-slate-400" />Max</span>
                {showProjected ? (
                  <span className="inline-flex items-center gap-1"><span className="h-2 w-3 rounded-full border border-dashed border-[#FF3D9A]" />Projected</span>
                ) : null}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Current match</p>
                  <p className={`text-4xl font-bold ${scoreToneClass(currentScore)}`}>{currentScore}<span className="text-lg text-slate-400">%</span></p>
                  <p className="text-xs text-slate-500">{matchLabel(currentScore)}</p>
                </div>
                {showProjected ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-pink-500">Projected</p>
                    <p className="text-4xl font-bold text-pink-600">{projectedScore}<span className="text-lg text-pink-300">%</span></p>
                    <p className="text-xs text-slate-500">with completed improvements</p>
                  </div>
                ) : null}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Max achievable</p>
                  <p className="text-4xl font-bold text-slate-400">{maxScore}<span className="text-lg text-slate-300">%</span></p>
                  <p className="text-xs text-slate-500">this cycle</p>
                </div>
              </div>

              {confidence != null ? (
                <div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>Analysis confidence</span>
                    <span>{confidence}%</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-slate-400" style={{ width: `${confidence}%` }} />
                  </div>
                  {confidence < 60 ? (
                    <p className="mt-1 text-[11px] text-slate-400">
                      <Link href="/profile/documents" className="font-semibold text-pink-500 hover:underline">
                        Add your CV &amp; essay
                      </Link>{' '}
                      for a more accurate score.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          {/* Pillar boxes */}
          <div className="mt-5 space-y-2.5">
            {MATCH_PILLARS.map((p) => {
              const b = pillars[p.key];
              if (!b) return null;
              return (
                <PillarBox
                  key={p.key}
                  pillarKey={p.key}
                  breakdown={b}
                  projectedCurrent={projected[p.key]?.current}
                  isPlus={isPlus}
                  tasksAdded={addedPillars.has(p.key)}
                  busy={busyPillar === p.key}
                  onAddTasks={addTasks}
                  onUpgrade={() => router.push('/plus')}
                />
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

function InputRow({ done, label, href, cta }: { done: boolean; label: string; href: string; cta: string }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
      <span className="flex items-center gap-2 text-sm text-slate-700">
        <span
          className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${
            done ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'
          }`}
          aria-hidden
        >
          {done ? '✓' : ''}
        </span>
        {label}
      </span>
      {done ? (
        <span className="shrink-0 text-xs font-semibold text-emerald-600">Added</span>
      ) : (
        <Link
          href={href}
          className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-pink-600 transition hover:border-pink-300"
        >
          {cta}
        </Link>
      )}
    </li>
  );
}
