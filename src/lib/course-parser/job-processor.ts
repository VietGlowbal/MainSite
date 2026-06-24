/**
 * Course parse job processor.
 *
 * Orchestrates a single parse job: fetch + AI-parse the official course page,
 * write the extracted details onto the course_applications row, and mark the
 * job complete (or schedule a retry on failure).
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { parseCoursePage } from './ai-parser';
import { updateJobStatus, recordJobFailure, type CourseParseJob } from './job-queue';

export interface ProcessResult {
  applicationId: string;
  status: 'complete' | 'failed' | 'retry';
  reason?: string;
}

/**
 * Update the application row with progress / parsed data.
 */
async function updateApplication(
  applicationId: string,
  fields: Record<string, unknown>
): Promise<void> {
  const supabase = createAdminClient();
  await supabase
    .from('course_applications')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', applicationId);
}

/**
 * Process one claimed parse job end to end.
 */
export async function processParseJob(job: CourseParseJob): Promise<ProcessResult> {
  try {
    // Mark the application as actively parsing.
    await updateApplication(job.application_id, {
      parse_status: 'processing',
      progress_percentage: 20,
    });

    const parsed = await parseCoursePage(job.course_url);

    if (!parsed) {
      // Couldn't fetch/parse — retry (transient) up to max_attempts.
      const willRetry = job.attempts < job.max_attempts;
      await recordJobFailure(job.id, 'Failed to fetch or parse course page', willRetry);
      await updateApplication(job.application_id, {
        parse_status: willRetry ? 'pending' : 'failed',
        progress_percentage: willRetry ? 20 : 100,
      });
      return {
        applicationId: job.application_id,
        status: willRetry ? 'retry' : 'failed',
        reason: 'parse_failed',
      };
    }

    // Build the application update from whatever we confidently extracted.
    // Never overwrite an existing good course_name with null.
    const appUpdate: Record<string, unknown> = {
      parse_status: 'complete',
      progress_percentage: 100,
      import_status: 'complete',
    };
    if (parsed.courseName) appUpdate.course_name = parsed.courseName;
    if (parsed.degreeLevel) appUpdate.degree_level = parsed.degreeLevel;
    if (parsed.studyMode) appUpdate.study_mode = parsed.studyMode;
    if (parsed.summary) appUpdate.ai_summary = parsed.summary;
    if (parsed.deadline && /^\d{4}-\d{2}-\d{2}$/.test(parsed.deadline)) {
      appUpdate.deadline = parsed.deadline;
      appUpdate.deadline_source = job.course_url;
    }

    await updateApplication(job.application_id, appUpdate);

    // Store the full parsed payload on the job for traceability.
    await updateJobStatus(job.id, 'complete', {
      parsed_data: parsed as unknown as Record<string, unknown>,
    });

    return { applicationId: job.application_id, status: 'complete' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const willRetry = job.attempts < job.max_attempts;
    await recordJobFailure(job.id, message, willRetry);
    await updateApplication(job.application_id, {
      parse_status: willRetry ? 'pending' : 'failed',
      progress_percentage: willRetry ? 20 : 100,
    });
    return {
      applicationId: job.application_id,
      status: willRetry ? 'retry' : 'failed',
      reason: message,
    };
  }
}
