'use client';

import { useState } from 'react';
import {
  PILLAR_BY_KEY,
  pillarWeightPercent,
  type PillarBreakdown,
  type PillarKey,
} from '@/lib/match-insights';

/**
 * PillarBox — one collapsible row per pillar. Collapsed shows the score and a
 * mini bar; expanded reveals the AI explanation, evidence, strengths, gaps and
 * (for Plus) improvement guidance + a button to add improvement tasks.
 */
export function PillarBox({
  pillarKey,
  breakdown,
  projectedCurrent,
  isPlus,
  tasksAdded,
  busy,
  onAddTasks,
  onUpgrade,
}: {
  pillarKey: PillarKey;
  breakdown: PillarBreakdown;
  /** Current score after completed improvement tasks (for the projected delta). */
  projectedCurrent?: number;
  isPlus: boolean;
  tasksAdded: boolean;
  busy: boolean;
  onAddTasks: (pillar: PillarKey) => void;
  onUpgrade: () => void;
}) {
  const [open, setOpen] = useState(false);
  const def = PILLAR_BY_KEY[pillarKey];
  const assessed = breakdown.assessed;
  const showProjected = projectedCurrent != null && projectedCurrent > breakdown.current + 0.5;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-900">{def.label}</span>
            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
              {Math.round(def.weight * 100)}%
            </span>
            {breakdown.verdict && assessed ? (
              <span className="truncate text-xs text-slate-400">· {breakdown.verdict}</span>
            ) : null}
          </div>

          {/* Mini bar */}
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            {assessed ? (
              <div className="relative h-full">
                {/* max ghost */}
                <div className="absolute inset-y-0 left-0 rounded-full bg-slate-200" style={{ width: `${breakdown.max}%` }} />
                {/* current */}
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-[linear-gradient(90deg,#FF3D9A,#19B8D8)]"
                  style={{ width: `${showProjected ? projectedCurrent : breakdown.current}%` }}
                />
              </div>
            ) : null}
          </div>
        </div>

        <div className="shrink-0 text-right">
          {assessed ? (
            <>
              <span className="text-base font-bold text-slate-900">
                {showProjected ? Math.round(projectedCurrent!) : breakdown.current}
              </span>
              <span className="text-xs text-slate-400"> → {breakdown.max}</span>
            </>
          ) : (
            <span className="text-xs font-semibold text-pink-600">Unlock {pillarWeightPercent(pillarKey)}%</span>
          )}
        </div>

        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round"
          className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open ? (
        <div className="space-y-3 border-t border-slate-100 px-4 py-3 text-sm">
          {breakdown.summary ? <p className="text-slate-600">{breakdown.summary}</p> : null}

          {!assessed ? (
            <p className="rounded-xl bg-pink-50 px-3 py-2 text-xs text-pink-700">
              We couldn’t assess this pillar yet — add the missing details (e.g. your essay or activities)
              to unlock <strong>{pillarWeightPercent(pillarKey)}%</strong> of your match score.
            </p>
          ) : null}

          {breakdown.evidenceQuotes.length > 0 ? (
            <div className="space-y-1">
              {breakdown.evidenceQuotes.map((q, i) => (
                <p key={i} className="border-l-2 border-slate-200 pl-2 text-xs italic text-slate-500">“{q}”</p>
              ))}
            </div>
          ) : null}

          {breakdown.strengths.length > 0 ? (
            <ul className="space-y-1">
              {breakdown.strengths.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                  <span className="mt-0.5 text-emerald-500">✓</span>{s}
                </li>
              ))}
            </ul>
          ) : null}

          {breakdown.gaps.length > 0 ? (
            <ul className="space-y-1">
              {breakdown.gaps.map((g, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                  <span className="mt-0.5 text-amber-500">•</span>{g}
                </li>
              ))}
            </ul>
          ) : null}

          {/* Improvement guidance — Plus only */}
          {breakdown.improvements.length > 0 ? (
            isPlus ? (
              <div className="rounded-xl border border-pink-100 bg-pink-50/60 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-pink-700">How to improve</p>
                <ul className="space-y-2">
                  {breakdown.improvements.map((imp) => (
                    <li key={imp.id} className="flex items-start justify-between gap-2 text-xs text-slate-700">
                      <span>
                        <span className="font-semibold">{imp.label}.</span> {imp.detail}
                      </span>
                      <span className="shrink-0 rounded-full bg-white px-1.5 py-0.5 font-bold text-pink-600">
                        +{imp.estimatedUplift}
                      </span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => onAddTasks(pillarKey)}
                  disabled={busy || tasksAdded}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] px-3.5 py-1.5 text-xs font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-60"
                >
                  {tasksAdded ? 'Added to your checklist ✓' : busy ? 'Adding…' : 'Add improvement tasks'}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onUpgrade}
                className="flex w-full items-center justify-between gap-2 rounded-xl border border-pink-100 bg-pink-50/60 px-3 py-2 text-left text-xs text-pink-700 transition hover:bg-pink-50"
              >
                <span>
                  <strong>{breakdown.improvements.length} ways to raise this score</strong> — unlock step-by-step
                  improvement tasks with GlowBal Plus.
                </span>
                <span className="shrink-0 font-semibold">Upgrade →</span>
              </button>
            )
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
