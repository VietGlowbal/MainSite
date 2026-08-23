'use client';

import { useState } from 'react';

const REASONS = [['already_done', 'Already done'], ['not_relevant', 'Not relevant'], ['too_generic', 'Too generic'], ['incorrect', 'Incorrect'], ['too_easy', 'Too easy'], ['too_hard', 'Too hard'], ['not_actionable', 'Not actionable'], ['other', 'Other']] as const;

export function PlannerFeedback({ applicationId, targetType, targetId }: { applicationId: string; targetType: 'plan' | 'micro_step'; targetId?: string }) {
  const [rating, setRating] = useState<number | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(false);
  async function save(next: { rating?: number | null; reason?: string | null }) {
    setError(false);
    const response = await fetch(`/api/applications/${applicationId}/planner/feedback`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ targetType, targetId: targetId ?? null, rating: next.rating ?? rating, reason: next.reason ?? reason }) });
    if (!response.ok) { setError(true); return; }
    setSaved(true);
  }
  return <div className="flex flex-col gap-gb-sm border-t border-line pt-gb-lg"><p className="text-gb-sm font-semibold text-fg">Was this useful?</p><div className="flex flex-wrap gap-gb-xs">{[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" aria-label={`${value} out of 5`} aria-pressed={rating === value} onClick={() => { setRating(value); void save({ rating: value }); }} className="rounded-gb-sm border border-line px-gb-sm py-gb-xs text-gb-sm hover:border-brand">{value}</button>)}</div>{rating !== null && rating <= 3 ? <div className="flex flex-wrap gap-gb-xs">{REASONS.map(([value, label]) => <button key={value} type="button" aria-pressed={reason === value} onClick={() => { setReason(value); void save({ reason: value }); }} className="rounded-gb-sm border border-line px-gb-sm py-gb-xs text-gb-xs hover:border-brand">{label}</button>)}</div> : null}{saved ? <p className="text-gb-xs text-fg-tertiary">Thanks — this helps improve Planner quality.</p> : null}{error ? <p role="alert" className="text-gb-xs text-fg-error">Could not save feedback.</p> : null}</div>;
}
