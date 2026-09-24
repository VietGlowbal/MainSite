import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isCourseUrl } from '@/features/universities/domain';
import { createClient } from '@/lib/supabase/server';

const requestSchema = z.object({
  savedId: z.number().int().positive(),
  program: z.string().trim().min(1).max(300),
  programUrl: z.string().trim().url().max(2048).refine(isCourseUrl, 'Invalid programme URL').nullable(),
});

function missingColumn(error: { code?: string; message?: string }): boolean {
  return (
    error.code === 'PGRST204' ||
    error.code === '42703' ||
    /'(?:program|program_url)' column/i.test(error.message ?? '')
  );
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid programme selection' }, { status: 400 });
  }

  const { savedId, program, programUrl } = parsed.data;
  const { data, error } = await supabase
    .from('user_universities')
    .update({ program, program_url: programUrl })
    .eq('id', savedId)
    .eq('user_id', user.id)
    .select('id, program, program_url')
    .maybeSingle();

  if (error) {
    console.error('save programme: update failed:', error.message);
    return NextResponse.json(
      {
        error: missingColumn(error)
          ? 'Saving a subject is not switched on in this environment yet.'
          : 'We could not save that subject. Please try again.',
      },
      { status: missingColumn(error) ? 503 : 500 },
    );
  }
  if (!data) {
    return NextResponse.json(
      { error: 'That saved university is no longer available.', errorCode: 'NOT_SAVED' },
      { status: 404 },
    );
  }

  return NextResponse.json({ saved: data });
}
