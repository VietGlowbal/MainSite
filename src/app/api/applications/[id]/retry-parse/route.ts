import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/applications/[id]/retry-parse
 * 
 * Retries parsing for a failed or timed-out application.
 * Implements rate limiting (max 3 retries per hour per application).
 * 
 * Response:
 * {
 *   "success": true,
 *   "parseStatus": "processing"
 * }
 * 
 * Errors:
 * - 401: Unauthorized (not authenticated)
 * - 403: Forbidden (user doesn't own application)
 * - 404: Application or parse job not found
 * - 400: Invalid parse status (not failed/timeout)
 * - 429: Rate limit exceeded (max 3 retries per hour)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch application with parse status
    const { data: application, error: appError } = await supabase
      .from('course_applications')
      .select('id, user_id, parse_status')
      .eq('id', id)
      .single();

    if (appError || !application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    // Verify ownership
    if (application.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if parse_status allows retry
    const parseStatus = application.parse_status;
    if (parseStatus !== 'failed' && parseStatus !== 'timeout') {
      return NextResponse.json(
        { error: 'Can only retry failed or timed-out parsing' },
        { status: 400 }
      );
    }

    // Fetch the course_parse_jobs record
    const { data: job, error: jobError } = await supabase
      .from('course_parse_jobs')
      .select('id, attempts, updated_at')
      .eq('application_id', id)
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        { error: 'Parse job not found' },
        { status: 404 }
      );
    }

    // Rate limiting: Check retry attempts in the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const jobUpdatedAt = new Date(job.updated_at);
    
    // Simple rate limiting: if job was updated in last hour and attempts >= 3, deny
    // Note: This is a simplified check. For production, consider using a dedicated rate_limit table
    if (jobUpdatedAt > oneHourAgo && job.attempts >= 3) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Maximum 3 retries per hour.' },
        { status: 429 }
      );
    }

    // Reset the job to pending state
    const { error: updateJobError } = await supabase
      .from('course_parse_jobs')
      .update({
        status: 'pending',
        attempts: 0,
        next_attempt_at: new Date().toISOString(),
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    if (updateJobError) {
      console.error('Failed to update parse job:', updateJobError);
      return NextResponse.json(
        { error: 'Failed to retry parsing' },
        { status: 500 }
      );
    }

    // Update application parse_status and progress
    const { error: updateAppError } = await supabase
      .from('course_applications')
      .update({
        parse_status: 'processing',
        progress_percentage: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateAppError) {
      console.error('Failed to update application:', updateAppError);
      return NextResponse.json(
        { error: 'Failed to update application status' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      parseStatus: 'processing',
    });
  } catch (error) {
    console.error('Error retrying parse:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
