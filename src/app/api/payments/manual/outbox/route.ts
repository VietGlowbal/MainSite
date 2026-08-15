import { NextResponse, type NextRequest } from 'next/server';
import { getManualPaymentConfig } from '@/server/payments/manual-config';
import { dispatchDueManualPaymentJobs } from '@/server/payments/manual-outbox';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  let config;
  try { config = getManualPaymentConfig(); } catch { return NextResponse.json({ error: 'Manual payments are not configured' }, { status: 503 }); }
  const authorization = request.headers.get('authorization');
  const expected = `Bearer ${config.reconciliationSecret}`;
  if (authorization !== expected) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { return NextResponse.json({ sent: await dispatchDueManualPaymentJobs(50) }); } catch { return NextResponse.json({ error: 'Could not dispatch payment notifications' }, { status: 503 }); }
}
