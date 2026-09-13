import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { mapStatusToPhase, classifyParseError } from '@/lib/course-parser/parse-phases';

const STALE_THRESHOLD_MS = 5 * 60 * 1000;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const supabase = await createClient();

    // Get the authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch the application
    const { data: application, error: fetchError } = await supabase
      .from('course_applications')
      .select('id, parse_status, progress_percentage, parse_error, updated_at, user_id')
      .eq('id', id)
      .single();

    if (fetchError || !application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    // Verify ownership
    if (application.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch underlying parse job metadata if present (defensive)
    let job = null;
    try {
      const adminDb = createAdminClient();
      const { data: jobData } = await adminDb
        .from('course_parse_jobs')
        .select('id, status, attempts, max_attempts, updated_at, started_at, error_message, phase')
        .eq('application_id', id)
        .maybeSingle();
      job = jobData;
    } catch {
      // Safe fallback if admin client or table isn't accessible
    }

    const lastUpdatedAt = job?.updated_at || application.updated_at || new Date().toISOString();
    const updatedTime = new Date(lastUpdatedAt).getTime();
    const isProcessing = application.parse_status === 'processing' || job?.status === 'processing';
    const isStale = isProcessing && !Number.isNaN(updatedTime) && Date.now() - updatedTime > STALE_THRESHOLD_MS;

    const canRetry =
      application.parse_status === 'failed' ||
      application.parse_status === 'timeout' ||
      job?.status === 'failed' ||
      job?.status === 'timeout' ||
      isStale;

    const phase = mapStatusToPhase({
      status: application.parse_status,
      phase: job?.phase,
      progressPercentage: application.progress_percentage,
      isStale,
    });

    const error = application.parse_error || job?.error_message || null;
    const errorType = classifyParseError(error, job?.attempts ?? 0, job?.max_attempts ?? 3);

    return NextResponse.json({
      id: application.id,
      parseStatus: application.parse_status,
      progressPercentage: application.progress_percentage ?? 0,
      phase,
      lastUpdatedAt,
      isStale,
      canRetry,
      error,
      errorType,
      attempts: job?.attempts ?? 0,
      maxAttempts: job?.max_attempts ?? 3,
    });
  } catch (error) {
    console.error('Error fetching parse status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
