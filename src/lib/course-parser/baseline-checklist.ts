/**
 * The checklist every application starts with.
 *
 * WHY THIS EXISTS. Until now the only thing that ever wrote stages or tasks was
 * `writeChecklist()` in job-processor.ts, from an AI extraction of a course
 * page. That was survivable while applications were created by pasting a course
 * URL, because there was always a page to read. Since applications are created
 * from a saved university and the subject the student chose, there usually is
 * not: 24 of the 106 universities have a programme catalogue with real links,
 * and only 20 of those clear the ingestion domain gate (measured 2026-08-01).
 * For the other 82 an application would otherwise open as an empty workspace
 * with a donut frozen at 0% — which is what the old dashboard already did, and
 * the reason the workspace was described as "empty" in job-processor's header.
 *
 * WHAT IT IS NOT. It is not a guess at the university's requirements. Every task
 * here is a step that is true of applying anywhere — read the course page, check
 * the English requirement, write the statement, submit — and none of them names
 * a document, a score or a deadline that this particular university asks for.
 * Where the AI *can* read the course page, `writeChecklist` adds the specific
 * tasks on top; see the note there on why it no longer deletes these.
 *
 * ⚠️ THE STAGES ARE NOT REDEFINED HERE. They are `STAGE_TEMPLATE` from
 * extract-course.ts, the same five the extraction classifies into. Two lists
 * would drift, and the whole point of the template is that stage structure is
 * deterministic rather than the model's job.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { STAGE_TEMPLATE, type StageKey } from './extract-course';

/** One universal step. `type` maps onto `application_tasks.task_type`. */
type BaselineTask = {
  title: string;
  description: string;
  type: string;
  priority: 'high' | 'medium' | 'low';
};

/**
 * The baseline, keyed by the stage it belongs to.
 *
 * Deliberately short. A checklist a student cannot finish is not a plan, and
 * every line here has to survive being read next to a real university's own
 * requirements once the extraction lands on top of it.
 */
const BASELINE: Record<StageKey, BaselineTask[]> = {
  research: [
    {
      title: 'Read the official course page',
      description:
        'Confirm the course is the one you want: what it covers, how long it runs and where it is taught.',
      type: 'research',
      priority: 'high',
    },
    {
      title: 'Find the application deadline',
      description:
        'Deadlines differ by course and by round. Note the one that applies to you and work back from it.',
      type: 'deadline',
      priority: 'high',
    },
  ],
  eligibility: [
    {
      title: 'Check the academic requirements',
      description: 'Compare your grades and subjects against what the course asks for.',
      type: 'eligibility',
      priority: 'high',
    },
    {
      title: 'Check the English language requirement',
      description:
        'Find the minimum score and whether individual band scores are set separately.',
      type: 'eligibility',
      priority: 'high',
    },
    {
      title: 'Check whether any admission test is required',
      description: 'Some courses and countries require an entrance or aptitude test with its own deadline.',
      type: 'eligibility',
      priority: 'medium',
    },
  ],
  documents: [
    {
      title: 'Gather your academic transcripts',
      description: 'Official transcripts for every year of study, translated if they are not in English.',
      type: 'document',
      priority: 'high',
    },
    {
      title: 'Write your personal statement',
      description: 'Why this subject, why this university, and what you have done that shows it.',
      type: 'document',
      priority: 'high',
    },
    {
      title: 'Request your letters of recommendation',
      description: 'Ask early. Referees need time, and most portals want their details before you submit.',
      type: 'document',
      priority: 'high',
    },
    {
      title: 'Prepare your CV',
      description: 'Education, work, activities and achievements on one or two pages.',
      type: 'document',
      priority: 'medium',
    },
  ],
  improve: [
    {
      title: 'Review your personal statement',
      description: 'Read it back against the course page and cut anything that is not about this course.',
      type: 'improvement',
      priority: 'medium',
    },
    {
      title: 'Strengthen your weakest requirement',
      description:
        'Whichever requirement you are furthest from meeting is the one worth the remaining time.',
      type: 'improvement',
      priority: 'medium',
    },
  ],
  submit: [
    {
      title: 'Complete the online application form',
      description: 'Fill in the university or national portal and attach every document it asks for.',
      type: 'submission',
      priority: 'high',
    },
    {
      title: 'Pay the application fee and submit',
      description: 'Keep the confirmation — it is what you quote if you need to chase the application.',
      type: 'submission',
      priority: 'high',
    },
  ],
};

/** How many tasks a baseline is, without building one. Used by tests and logs. */
export const BASELINE_TASK_COUNT = Object.values(BASELINE).reduce(
  (sum, tasks) => sum + tasks.length,
  0,
);

export type SeedResult = { stages: number; tasks: number };

/**
 * Thrown when the database has not had supabase-apply-baseline-checklist.sql
 * applied. Named rather than generic for the same reason the subject picker
 * names its missing-column case: a caller retrying a write that can never
 * succeed is worse than one told why.
 */
export class BaselineNotEnabledError extends Error {
  constructor(detail: string) {
    super(
      `Baseline checklists are not switched on for this database yet — ${detail}. ` +
        'Apply supabase-apply-baseline-checklist.sql.',
    );
    this.name = 'BaselineNotEnabledError';
  }
}

/**
 * Write the five stages and the baseline tasks onto an application.
 *
 * IDEMPOTENT BY SLUG. Re-running does not duplicate the spine: stages are
 * matched on `slug`, which is stable and canonical, and tasks are only inserted
 * for stages that had none. That matters because this runs both at creation and
 * from the repair script, and a stranded application must not come back with two
 * of everything.
 *
 * Admin client, like `writeChecklist`: this runs inside a route that has already
 * established the application belongs to the caller, and the parse worker has no
 * session at all.
 */
export async function seedBaselineChecklist(applicationId: string): Promise<SeedResult> {
  const supabase = createAdminClient();

  const { data: existingStages, error: readError } = await supabase
    .from('application_stages')
    .select('id, slug')
    .eq('application_id', applicationId);

  if (readError) {
    throw new Error(`Failed to read existing stages: ${readError.message}`);
  }

  const stageIdBySlug = new Map<string, string>(
    (existingStages ?? []).map((s) => [s.slug as string, s.id as string]),
  );

  const missing = STAGE_TEMPLATE.filter((stage) => !stageIdBySlug.has(stage.slug));

  if (missing.length > 0) {
    const { data: created, error: stageError } = await supabase
      .from('application_stages')
      .insert(
        missing.map((stage) => ({
          application_id: applicationId,
          name: stage.name,
          slug: stage.slug,
          description: stage.description,
          order_num: STAGE_TEMPLATE.findIndex((s) => s.slug === stage.slug) + 1,
          status: 'not_started',
          is_required: true,
          /* NOT ai_generated. These five are the product's own spine, and the
             flag is what tells a later parse it is enriching rather than
             replacing. */
          ai_generated: false,
        })),
      )
      .select('id, slug');

    if (stageError || !created) {
      throw new Error(`Failed to write baseline stages: ${stageError?.message ?? 'no rows returned'}`);
    }
    for (const stage of created) stageIdBySlug.set(stage.slug as string, stage.id as string);
  }

  /* Only stages that carry no task at all get the baseline. A stage the parse
     has already filled does not want a generic "read the course page" under a
     specific requirement list. */
  const { data: existingTasks, error: taskReadError } = await supabase
    .from('application_tasks')
    .select('stage_id')
    .eq('application_id', applicationId);

  if (taskReadError) {
    throw new Error(`Failed to read existing tasks: ${taskReadError.message}`);
  }

  const stagesWithTasks = new Set((existingTasks ?? []).map((t) => t.stage_id as string | null));

  const taskRows = STAGE_TEMPLATE.flatMap((stage) => {
    const stageId = stageIdBySlug.get(stage.slug);
    if (!stageId || stagesWithTasks.has(stageId)) return [];
    return (BASELINE[stage.key] ?? []).map((task, index) => ({
      application_id: applicationId,
      stage_id: stageId,
      title: task.title,
      description: task.description,
      task_type: task.type,
      status: 'not_started',
      priority: task.priority,
      /* No confidence: nothing here was inferred, so a number would imply a
         judgement that was never made. */
      confidence: null,
      sort_order: index,
      created_by: 'system',
    }));
  });

  if (taskRows.length > 0) {
    const { error: taskError } = await supabase.from('application_tasks').insert(taskRows);
    if (taskError) {
      /* 23514 is Postgres's check_violation. The only check this insert can trip
         is valid_created_by, on a database that has not had 'system' added. */
      if ((taskError as { code?: string }).code === '23514') {
        throw new BaselineNotEnabledError(
          "application_tasks.created_by does not accept 'system'",
        );
      }
      throw new Error(`Failed to write baseline tasks: ${taskError.message}`);
    }
  }

  return { stages: missing.length, tasks: taskRows.length };
}
