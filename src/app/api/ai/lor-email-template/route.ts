import { NextResponse } from 'next/server';
import { z } from 'zod';
import { fetchApplicationWorkspace } from '@/lib/api/application-workspace';
import { deepSeekJsonCompletion } from '@/lib/ai/deepseek-client';
import { LorStrategyInputSchema } from '@/lib/ai/lor';
import { applyRateLimit, lorAiLimiter } from '@/lib/rate-limiter';
import { createClient } from '@/lib/supabase/server';

const requestSchema = LorStrategyInputSchema.pick({
  applicationId: true,
  recommenderType: true,
  relationshipContext: true,
});

const templateSchema = z.object({
  subject: z.string().trim().min(1).max(180),
  body: z.string().trim().min(20).max(2_500),
});

function parseJson(content: string) {
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('No JSON object returned.');
  return JSON.parse(content.slice(start, end + 1));
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const input = requestSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: 'Invalid email template input.' }, { status: 400 });

  const workspace = await fetchApplicationWorkspace(input.data.applicationId, user.id);
  if (!workspace) return NextResponse.json({ error: 'Application not found.' }, { status: 404 });

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'AI service not configured.' }, { status: 500 });
  const rateLimitResponse = applyRateLimit(lorAiLimiter, user.id, 'LOR email template');
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const content = await deepSeekJsonCompletion({
      apiKey,
      model: 'deepseek-v4-flash',
      temperature: 0.3,
      maxTokens: 600,
      messages: [
        {
          role: 'system',
          content: `Write a concise, polite request for a university recommendation letter. Return JSON only.
Do not invent dates, achievements, deadlines, relationships, or names. Keep placeholders such as [Recommender's Name], [Your name], and [deadline] where needed. Do not claim the recommender has agreed to write the letter.`,
        },
        {
          role: 'user',
          content: JSON.stringify({
            university: workspace.application.universityName,
            programme: workspace.application.courseName,
            recommenderType: input.data.recommenderType,
            relationshipContext: input.data.relationshipContext,
            format: {
              subject: '<email subject>',
              body: '<email body, 140-220 words>',
            },
          }),
        },
      ],
    });
    return NextResponse.json(templateSchema.parse(parseJson(content)));
  } catch (error) {
    console.warn('[lor-email-template] generation failed', {
      model: 'deepseek-v4-flash',
      code: error instanceof Error ? error.message.slice(0, 120) : 'unknown',
    });
    return NextResponse.json({ error: 'Could not create the email template.' }, { status: 502 });
  }
}
