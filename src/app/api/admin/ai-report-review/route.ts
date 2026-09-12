import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminAiReportReview } from '@/features/ai-strategy-dashboard/api';

const querySchema = z.string().uuid();

export async function GET(request: Request) {
  const applicationId = querySchema.safeParse(new URL(request.url).searchParams.get('applicationId'));
  if (!applicationId.success) {
    return NextResponse.json({ error: 'A valid applicationId is required' }, { status: 422 });
  }

  const result = await getAdminAiReportReview(applicationId.data);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ review: result.review });
}
