import { NextResponse } from 'next/server';
import { z } from 'zod';
import { generateCoachReply } from '@/lib/ai/strategy-dashboard/coach-reply';
import { createClient } from '@/lib/supabase/server';

/**
 * GET  /api/applications/[id]/strategy/recommendations/[recId]/coach — the
 *      thread's message history (empty array if no thread yet).
 * POST /api/applications/[id]/strategy/recommendations/[recId]/coach — send a
 *      message, get an AI reply, persist both.
 *
 * requirements.md Requirement 12. One thread per recommendation
 * (`strategy_coach_threads.recommendation_id`), created lazily on first
 * message rather than up front.
 */
export const runtime = 'nodejs';
export const maxDuration = 30;

const bodySchema = z.object({
  message: z.string().trim().min(1).max(2000),
});

async function loadRecommendation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  applicationId: string,
  recId: string,
  userId: string,
) {
  const { data: application } = await supabase
    .from('course_applications')
    .select('id, course_name, university_name')
    .eq('id', applicationId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!application) return null;

  const { data: recommendation } = await supabase
    .from('application_recommendations')
    .select('id, title, body')
    .eq('id', recId)
    .eq('application_id', applicationId)
    .maybeSingle();
  if (!recommendation) return null;

  return { application, recommendation };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; recId: string }> },
) {
  const { id: applicationId, recId } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const loaded = await loadRecommendation(supabase, applicationId, recId, user.id);
  if (!loaded) return NextResponse.json({ error: 'Recommendation not found' }, { status: 404 });

  const { data: thread } = await supabase
    .from('strategy_coach_threads')
    .select('id')
    .eq('recommendation_id', recId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!thread) return NextResponse.json({ messages: [] });

  const { data: messages } = await supabase
    .from('strategy_coach_messages')
    .select('*')
    .eq('thread_id', thread.id)
    .order('created_at', { ascending: true });

  return NextResponse.json({ messages: messages ?? [] });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; recId: string }> },
) {
  const { id: applicationId, recId } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const loaded = await loadRecommendation(supabase, applicationId, recId, user.id);
  if (!loaded) return NextResponse.json({ error: 'Recommendation not found' }, { status: 404 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'AI service not configured' }, { status: 500 });

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid message' }, { status: 400 });

  let { data: thread } = await supabase
    .from('strategy_coach_threads')
    .select('id')
    .eq('recommendation_id', recId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!thread) {
    const { data: created, error: createErr } = await supabase
      .from('strategy_coach_threads')
      .insert({ recommendation_id: recId, user_id: user.id })
      .select('id')
      .single();
    if (createErr || !created) {
      console.error('[strategy coach] thread create failed', createErr);
      return NextResponse.json({ error: 'Could not start coaching thread' }, { status: 500 });
    }
    thread = created;
  }

  const { data: history } = await supabase
    .from('strategy_coach_messages')
    .select('role, content')
    .eq('thread_id', thread.id)
    .order('created_at', { ascending: true });

  const { error: userMsgErr } = await supabase.from('strategy_coach_messages').insert({
    thread_id: thread.id,
    user_id: user.id,
    role: 'user',
    content: parsed.data.message,
  });
  if (userMsgErr) {
    console.error('[strategy coach] user message insert failed', userMsgErr);
    return NextResponse.json({ error: 'Could not send message' }, { status: 500 });
  }

  let reply: string;
  try {
    reply = await generateCoachReply({
      context: {
        recommendationTitle: loaded.recommendation.title,
        recommendationReason: loaded.recommendation.body,
        courseName: loaded.application.course_name,
        universityName: loaded.application.university_name,
      },
      history: [...(history ?? []), { role: 'user', content: parsed.data.message }],
      apiKey,
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    });
  } catch (err) {
    console.error('[strategy coach] AI reply failed', err);
    return NextResponse.json({ error: 'Coach could not reply. Please try again.' }, { status: 502 });
  }

  const { data: assistantMessage, error: assistantMsgErr } = await supabase
    .from('strategy_coach_messages')
    .insert({ thread_id: thread.id, user_id: user.id, role: 'assistant', content: reply })
    .select()
    .single();

  if (assistantMsgErr) {
    console.error('[strategy coach] assistant message insert failed', assistantMsgErr);
    return NextResponse.json({ error: 'Could not save the reply' }, { status: 500 });
  }

  return NextResponse.json({ message: assistantMessage });
}
