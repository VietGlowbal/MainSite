import { NextResponse } from 'next/server';
import { isAuthorizedCron } from '@/lib/cron-auth';
import {
  DEFAULT_PERSONAL_REPORT_GENERATION_BATCH,
  MAX_PERSONAL_REPORT_GENERATION_BATCH,
  processApplicationPersonalReportGenerations,
} from '@/features/apply/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function handle(request: Request) {
  if (!isAuthorizedCron(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const requested = Number.parseInt(new URL(request.url).searchParams.get('batch') ?? '', 10);
  const batchSize = Number.isFinite(requested)
    ? Math.min(Math.max(requested, 1), MAX_PERSONAL_REPORT_GENERATION_BATCH)
    : DEFAULT_PERSONAL_REPORT_GENERATION_BATCH;
  return NextResponse.json(await processApplicationPersonalReportGenerations(batchSize));
}

export async function GET(request: Request) { return handle(request); }
export async function POST(request: Request) { return handle(request); }
