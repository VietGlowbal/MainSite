'use client';

import { useState } from 'react';
import { Button } from '@/shared/ui';

export function ManualReviewPanel({ token, review }: { token: string; review: { state: string; transaction: { reference: string; amount_vnd: number; product_type: string; status: string; plus_plan?: string | null; expires_at: string; recipient_name?: string | null; recipient_email?: string | null; summary?: string | null } } }) {
  const [state, setState] = useState(review.state);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  async function submit(action: 'confirm' | 'reject') {
    if (state === 'confirmed' || state === 'rejected' || state === 'expired') return;
    if (action === 'confirm' && !window.confirm(`Confirm ${new Intl.NumberFormat('vi-VN').format(review.transaction.amount_vnd)} VND for ${review.transaction.reference}?`)) return;
    setBusy(true);
    const response = await fetch(`/api/admin/payments/manual/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, note }) });
    const body = (await response.json().catch(() => ({}))) as { status?: string; error?: string };
    setState(body.status ?? (response.ok ? action === 'confirm' ? 'fulfilled' : 'failed' : state));
    if (!response.ok) window.alert(body.error ?? 'Could not update payment');
    setBusy(false);
  }
  const terminal = ['confirmed', 'rejected', 'expired', 'fulfilled', 'failed', 'paid_unfulfilled'].includes(state);
  return <section className="mx-auto flex max-w-gb-width-md flex-col gap-gb-2xl rounded-gb-2xl border border-line bg-surface p-gb-3xl shadow-gb-sm" aria-live="polite"><div><p className="text-gb-sm font-semibold uppercase tracking-wide text-fg-muted">Founder payment review</p><h1 className="mt-gb-sm font-display text-gb-display-xs font-semibold text-fg">{review.transaction.reference}</h1><p className="mt-gb-sm text-fg-tertiary">State: {state}</p></div><dl className="grid gap-gb-lg rounded-gb-xl bg-surface-muted p-gb-xl sm:grid-cols-2"><div><dt className="text-fg-muted">Student</dt><dd>{review.transaction.recipient_name ?? 'GlowBal student'}</dd>{review.transaction.recipient_email ? <dd className="text-gb-sm text-fg-tertiary">{review.transaction.recipient_email}</dd> : null}</div><div><dt className="text-fg-muted">Amount</dt><dd className="font-semibold">{new Intl.NumberFormat('vi-VN').format(review.transaction.amount_vnd)} ₫</dd></div><div><dt className="text-fg-muted">Product</dt><dd>{review.transaction.product_type}{review.transaction.plus_plan ? ` — ${review.transaction.plus_plan}` : ''}</dd>{review.transaction.summary ? <dd className="text-gb-sm text-fg-tertiary">{review.transaction.summary}</dd> : null}</div><div><dt className="text-fg-muted">Checkout expiry</dt><dd>{new Date(review.transaction.expires_at).toLocaleString()}</dd></div><div><dt className="text-fg-muted">Current ledger</dt><dd>{review.transaction.status}</dd></div></dl><label className="text-gb-sm text-fg">Reviewer note<textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} rows={3} className="mt-gb-sm w-full rounded-gb-md border border-line p-gb-md" /></label><div className="flex flex-wrap gap-gb-lg"><Button type="button" onClick={() => submit('confirm')} disabled={busy || terminal}>Confirm received</Button><Button type="button" variant="secondary" onClick={() => submit('reject')} disabled={busy || terminal}>Reject</Button></div></section>;
}
