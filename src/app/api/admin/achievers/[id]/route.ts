import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { decideAdvisorApplication } from '@/features/mentorship/api';

const DecisionSchema = z
  .object({
    status: z.enum(['approved', 'rejected']),
  })
  .strict();

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid advisor application id' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = DecisionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid advisor application decision' }, { status: 400 });
  }

  const result = await decideAdvisorApplication(id, parsed.data.status);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, application: result.application });
}
