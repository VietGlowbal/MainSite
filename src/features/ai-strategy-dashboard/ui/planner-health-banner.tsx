'use client';

import { useState } from 'react';
import type { PlannerHealth } from '../domain';

export function PlannerHealthBanner({ applicationId, health }: { applicationId: string; health: PlannerHealth }) {
  const [busy, setBusy] = useState(false);
  async function refresh() {
    setBusy(true);
    const response = await fetch(`/api/applications/${applicationId}/planner/refresh`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ trigger: 'manual_refresh' }) });
    if (response.ok) window.location.reload(); else setBusy(false);
  }
  const stale = health.lifecycle === 'stale';
  const failed = health.lifecycle === 'failed';
  const message = stale ? 'Your application information changed.' : failed ? 'We could not update your plan. Your current plan is still available.' : health.lifecycle === 'refreshing' ? 'Updating your plan…' : health.lifecycle === 'complete' ? 'You have completed the current plan.' : health.lifecycle === 'waiting_for_input' ? 'Your plan is waiting for your input.' : 'Your plan is up to date.';
  return <div className="flex flex-wrap items-center justify-between gap-gb-lg rounded-gb-lg border border-line bg-surface-muted px-gb-lg py-gb-md"><div><p className="text-gb-sm font-semibold text-fg">{message}</p><p className="mt-gb-xxs text-gb-xs text-fg-tertiary">{health.progress.completedMicroSteps}/{health.progress.microSteps} tasks complete</p></div>{(stale || failed) ? <button type="button" disabled={busy} onClick={() => void refresh()} className="rounded-gb-sm bg-brand px-gb-lg py-gb-sm text-gb-sm font-semibold text-on-brand disabled:opacity-60">{busy ? 'Updating…' : 'Update plan'}</button> : null}</div>;
}
