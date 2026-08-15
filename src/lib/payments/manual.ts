import { createHash, randomUUID } from 'node:crypto';

export const MANUAL_PROVIDER = 'manual_bank_transfer' as const;
export const MANUAL_MENTORSHIP_INITIAL_HOLD_MINUTES = 30;
export const MANUAL_MENTORSHIP_REVIEW_GRACE_HOURS = 2;
export const MANUAL_PLUS_EXPIRY_HOURS = 24;

export type ManualProduct = 'mentorship' | 'plus';

export function newManualReference(): string {
  return `GLOWMANUAL${Date.now().toString(36).toUpperCase()}${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
}

export function manualRequestFingerprint(value: unknown): string {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(',')}}`;
}

export function manualStatusLabel(status: string): string {
  switch (status) {
    case 'pending': return 'Awaiting transfer';
    case 'claimed': return 'Transfer reported — awaiting founder';
    case 'fulfilled': return 'Confirmed';
    case 'failed': return 'Rejected';
    case 'expired': return 'Expired';
    case 'paid_unfulfilled': return 'Received late — support review required';
    default: return 'Payment status unavailable';
  }
}
