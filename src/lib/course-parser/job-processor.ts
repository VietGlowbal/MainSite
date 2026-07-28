/**
 * Course parse job processor.
 *
 * Runs one claimed job end to end: extract the official course page, write the
 * course facts, the five-stage checklist and any scholarships onto the
 * application, then mark the job complete or schedule a retry.
 *
 * Before this, the processor called a parser that returned five scalar fields
 * and wrote no stages or tasks at all — so every application in the database
 * opened as an empty workspace. It now persists the whole extraction.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import {
  confidenceToNumber,
  extractCourse,
  groupTasksByStage,
  type CourseExtraction,
  type ExtractionFailure,
} from './extract-course';
import { updateJobStatus, recordJobFailure, type CourseParseJob } from './job-queue';

export interface ProcessResult {
  applicationId: string;
  status: 'complete' | 'failed' | 'retry';
  reason?: string;
}

/**
 * Which failures are worth trying again.
 *
 * A blocked or slow site may well answer next time. A missing API key and a
 * page that renders itself in the browser will fail identically on every
 * attempt, so spending three tries and fifteen minutes on them only delays
 * telling the student something useful.
 */
const RETRYABLE: Record<ExtractionFailure, boolean> = {
  fetch_failed: true,
  model_failed: true,
  not_configured: false,
  empty_page: false,
};

/** Shown to the student. Written to be actionable, not to blame the site. */
const FAILURE_MESSAGE: Record<ExtractionFailure, string> = {
  fetch_failed:
    'We could not open that page. It may be private, moved, or blocking automated visits.',
  empty_page:
    'That page gave us no text to read — some course pages build themselves in the browser. Try the print or plain version if there is one.',
  not_configured: 'Course reading is temporarily unavailable. We will pick this up shortly.',
  model_failed: 'We could not read that page this time.',
};

/**
 * Link keys map onto `application_sources.source_type`, which is a CHECK
 * constraint, not free text.
 */
const LINK_SOURCE: Record<string, { type: string; title: string }> = {
  entryRequirements: { type: 'entry_requirements', title: 'Entry requirements' },
  howToApply: { type: 'how_to_apply', title: 'How to apply' },
  tuitionFees: { type: 'tuition_fees', title: 'Tuition fees' },
  scholarships: { type: 'scholarships', title: 'Scholarships and funding' },
};

/**
 * Returns whether the write landed. The previous version swallowed the result
 * entirely, which is how a row could sit in `processing` forever with nothing
 * in the logs to say why.
 */
async function updateApplication(
  applicationId: string,
  fields: Record<string, unknown>,
): Promise<boolean> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('course_applications')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', applicationId);

  if (error) {
    console.error('[job-processor] application update failed', {
      applicationId,
      columns: Object.keys(fields),
      message: error.message,
    });
    return false;
  }
  return true;
}

/**
 * Move an application out of `processing` and into a terminal state.
 *
 * Status and message are written separately, and that is deliberate.
 * `parse_error` is added by supabase-apply-parse-state.sql; if this deploys
 * ahead of that migration, a combined update would be rejected whole and the
 * row would be stranded mid-parse — the exact failure this release exists to
 * remove. Splitting them means the worst case is a failed row with a generic
 * message instead of a specific one, and a loud log line saying why.
 */
async function settleApplication(
  applicationId: string,
  parseStatus: 'pending' | 'failed',
  message: string | null,
): Promise<void> {
  await updateApplication(applicationId, {
    parse_status: parseStatus,
    progress_percentage: 0,
  });

  if (message !== null || parseStatus === 'pending') {
    await updateApplication(applicationId, { parse_error: message });
  }
}

/**
 * Write the checklist.
 *
 * Deletes this application's AI-generated stages first, which cascades to their
 * tasks. That is what makes a retry safe — without it, a second successful
 * parse would double every task. Stages the *user* added survive, because the
 * delete is scoped to `ai_generated`.
 */
async function writeChecklist(
  applicationId: string,
  extraction: CourseExtraction,
): Promise<{ stages: number; tasks: number }> {
  const supabase = createAdminClient();

  await supabase
    .from('application_stages')
    .delete()
    .eq('application_id', applicationId)
    .eq('ai_generated', true);

  const grouped = groupTasksByStage(extraction.tasks);

  const { data: createdStages, error: stageError } = await supabase
    .from('application_stages')
    .insert(
      grouped.map(({ stage }, index) => ({
        application_id: applicationId,
        name: stage.name,
        slug: stage.slug,
        description: stage.description,
        order_num: index + 1,
        status: 'not_started',
        is_required: true,
        ai_generated: true,
        confidence: confidenceToNumber(extraction.confidence),
      })),
    )
    .select('id, slug');

  if (stageError || !createdStages) {
    throw new Error(`Failed to write stages: ${stageError?.message ?? 'no rows returned'}`);
  }

  // Insert order is not a contract — match on slug rather than array index.
  const stageIdBySlug = new Map<string, string>(
    createdStages.map((s) => [s.slug as string, s.id as string]),
  );

  const taskRows = grouped.flatMap(({ stage, tasks }) =>
    tasks.map((task, index) => ({
      application_id: applicationId,
      stage_id: stageIdBySlug.get(stage.slug) ?? null,
      title: task.title,
      description: task.description,
      task_type: task.taskType,
      status: 'not_started',
      priority: task.priority,
      source_url: task.sourceUrl,
      confidence: confidenceToNumber(task.confidence),
      sort_order: index,
      created_by: 'ai',
    })),
  );

  if (taskRows.length > 0) {
    const { error: taskError } = await supabase.from('application_tasks').insert(taskRows);
    if (taskError) {
      throw new Error(`Failed to write tasks: ${taskError.message}`);
    }
  }

  return { stages: createdStages.length, tasks: taskRows.length };
}

/**
 * Store scholarships and official links as application sources.
 *
 * Best-effort: a failure here does not fail the job. The checklist is the point
 * of the parse, and losing a scholarship row is not worth making the student
 * sit through another retry cycle.
 */
async function writeSources(applicationId: string, extraction: CourseExtraction): Promise<void> {
  const supabase = createAdminClient();

  const scholarshipRows = extraction.scholarships.map((s) => ({
    application_id: applicationId,
    source_type: 'scholarships',
    title: s.name,
    description:
      [s.amount, s.eligibility, s.deadline ? `Deadline: ${s.deadline}` : null]
        .filter(Boolean)
        .join(' · ') || null,
    url: s.url,
    confidence: confidenceToNumber(s.confidence),
    is_official: true,
  }));

  const linkRows = Object.entries(extraction.links).flatMap(([key, url]) => {
    const mapped = LINK_SOURCE[key];
    if (!mapped || typeof url !== 'string') return [];
    return [
      {
        application_id: applicationId,
        source_type: mapped.type,
        title: mapped.title,
        description: null,
        url,
        confidence: 0.9,
        is_official: true,
      },
    ];
  });

  const rows = [...scholarshipRows, ...linkRows];
  if (rows.length === 0) return;

  // Replace rather than append, for the same reason the stages are replaced.
  await supabase.from('application_sources').delete().eq('application_id', applicationId);

  const { error } = await supabase.from('application_sources').insert(rows);
  if (error) {
    console.error('[job-processor] sources failed (non-fatal):', error.message);
  }
}

/**
 * Map the extraction onto `course_applications`.
 *
 * Only non-null values are written. A second parse that reads less than the
 * first must not blank out what the first found, and a field the student has
 * since corrected by hand should survive a re-parse.
 */
function applicationFields(
  extraction: CourseExtraction,
  sourceUrl: string,
): Record<string, unknown> {
  const { course } = extraction;
  // parse_error is cleared separately — see settleApplication for why this
  // update must not depend on that column existing.
  const fields: Record<string, unknown> = {
    parse_status: 'complete',
    import_status: 'complete',
  };

  const map: Array<[string, string | null]> = [
    ['university_name', course.universityName],
    ['course_name', course.courseName],
    ['degree_level', course.degreeLevel],
    ['subject', course.subject],
    ['study_mode', course.studyMode],
    ['intake', course.intake],
    ['country', course.country],
    ['ai_summary', course.summary],
  ];
  for (const [column, value] of map) {
    if (value) fields[column] = value;
  }

  if (course.deadline) {
    fields['deadline'] = course.deadline;
    fields['deadline_source'] = sourceUrl;
  }

  return fields;
}

/**
 * Process one claimed parse job.
 */
export async function processParseJob(job: CourseParseJob): Promise<ProcessResult> {
  try {
    await updateApplication(job.application_id, {
      parse_status: 'processing',
      progress_percentage: 20,
    });

    const result = await extractCourse(job.course_url);

    if (!result.ok) {
      const willRetry = RETRYABLE[result.reason] && job.attempts < job.max_attempts;
      await recordJobFailure(job.id, result.reason, willRetry);
      await settleApplication(
        job.application_id,
        willRetry ? 'pending' : 'failed',
        willRetry ? null : FAILURE_MESSAGE[result.reason],
      );
      return {
        applicationId: job.application_id,
        status: willRetry ? 'retry' : 'failed',
        reason: result.reason,
      };
    }

    const counts = await writeChecklist(job.application_id, result.data);
    await writeSources(job.application_id, result.data);
    await updateApplication(job.application_id, applicationFields(result.data, job.course_url));
    // Clears any message left by an earlier failed attempt.
    await updateApplication(job.application_id, { parse_error: null });

    await updateJobStatus(job.id, 'complete', {
      parsed_data: result.data as unknown as Record<string, unknown>,
    });

    console.log('[job-processor] complete', {
      applicationId: job.application_id,
      ...counts,
      confidence: result.data.confidence,
    });

    return { applicationId: job.application_id, status: 'complete' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const willRetry = job.attempts < job.max_attempts;
    await recordJobFailure(job.id, message, willRetry);
    await settleApplication(
      job.application_id,
      willRetry ? 'pending' : 'failed',
      willRetry ? null : 'Something went wrong while reading that page.',
    );
    return {
      applicationId: job.application_id,
      status: willRetry ? 'retry' : 'failed',
      reason: message,
    };
  }
}
