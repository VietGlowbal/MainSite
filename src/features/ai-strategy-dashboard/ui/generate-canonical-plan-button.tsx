'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** Admin/local bootstrap for exercising the Core 3 -> Core 4 flow end to end. */
export function GenerateCanonicalPlanButton({
  applicationId,
  endpoint = 'dev',
}: {
  applicationId: string;
  /** Production uses the admin-protected endpoint; local development keeps the dev endpoint. */
  endpoint?: 'admin' | 'dev';
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/${endpoint}/applications/${encodeURIComponent(applicationId)}/planner/sync`, {
        method: 'POST',
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : 'Could not generate the canonical plan');
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not generate the canonical plan');
    } finally {
      setPending(false);
    }
  }

  return <div className="rounded-gb-xl border border-line bg-surface-muted p-gb-lg">
    <div className="flex flex-wrap items-center justify-between gap-gb-md">
      <div><p className="text-gb-sm font-semibold text-fg">Canonical Planner is not generated yet</p><p className="text-gb-xs text-fg-muted">Generate the deterministic Core 3 hierarchy for this application.</p></div>
      <button type="button" onClick={() => void generate()} disabled={pending} className="rounded-gb-lg bg-brand px-gb-lg py-gb-sm text-gb-sm font-semibold text-on-brand disabled:cursor-not-allowed disabled:opacity-60">
        {pending ? 'Generating…' : 'Generate canonical plan'}
      </button>
    </div>
    {error ? <p role="alert" className="mt-gb-md text-gb-sm text-fg-error">{error}</p> : null}
  </div>;
}
