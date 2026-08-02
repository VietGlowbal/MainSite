// ============================================================================
// scripts/repair-stranded-applications.mjs
// ----------------------------------------------------------------------------
// One-off repair for applications that claim a course-page parse is running
// when no job exists to run it.
//
// THE FAULT. `/api/applications/from-course-url` inserts the row with
// `parse_status: 'pending'` and then enqueues the parse separately.
// `createParseJob` reports a write failure by RETURNING NULL rather than
// throwing, and the enqueue sat inside a catch commented "Best-effort — don't
// fail the request" — so a failed enqueue left an application permanently
// telling its owner "GlowBal's AI is reading the course page…" with nothing
// behind it. Measured 2026-08-01: 13 of 37 live applications, the oldest
// stranded since 15 June. The route no longer swallows it; this cleans up the
// rows already in the database.
//
// WHAT IT DOES to each stranded row:
//   1. seeds the five-stage baseline checklist, so the workspace is not empty
//      (mirrors lib/course-parser/baseline-checklist.ts — see the note below on
//      why the logic is duplicated here rather than imported);
//   2. sets parse_status 'complete', so the row stops promising work nobody is
//      doing. Not 'failed': nothing failed to read, nothing was ever asked to.
//
// It does NOT touch the course name, the university, the deadline, progress, or
// any row that has a job — a genuinely queued parse is left alone.
//
// Usage:
//   node --env-file=.env.local scripts/repair-stranded-applications.mjs
//   node --env-file=.env.local scripts/repair-stranded-applications.mjs --apply
//
// Dry run by default. Nothing is written without --apply.
// ============================================================================

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    '✖ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n' +
      '  Run with: node --env-file=.env.local scripts/repair-stranded-applications.mjs',
  );
  process.exit(1);
}

const APPLY = process.argv.includes('--apply');
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

/*
 * ⚠️ DUPLICATED FROM src/lib/course-parser/baseline-checklist.ts ON PURPOSE.
 * This is a plain .mjs script run by node directly — it cannot import from
 * `src/` through the `@/` alias without a build step, and the other scripts in
 * this directory all stand alone for the same reason. The duplication is
 * tolerable because it is a one-off repair; if it ever becomes a recurring job
 * it should move behind an API route that imports the real module.
 *
 * If you change the baseline, change it there first — that module is what every
 * new application gets.
 */
const STAGES = [
  {
    key: 'research',
    name: 'Research',
    slug: 'research',
    description: 'Understand the course, the university and whether it fits your plans.',
  },
  {
    key: 'eligibility',
    name: 'Check eligibility',
    slug: 'check-eligibility',
    description: 'Confirm you meet the academic, English and test requirements.',
  },
  {
    key: 'documents',
    name: 'Prepare documents',
    slug: 'prepare-documents',
    description: 'Gather and write everything the application asks you to submit.',
  },
  {
    key: 'improve',
    name: 'Improve application',
    slug: 'improve-application',
    description: 'Strengthen the parts of your application that are weakest.',
  },
  {
    key: 'submit',
    name: 'Submit',
    slug: 'submit',
    description: 'Send the application and track its progress.',
  },
];

const BASELINE = {
  research: [
    ['Read the official course page', 'Confirm the course is the one you want: what it covers, how long it runs and where it is taught.', 'research', 'high'],
    ['Find the application deadline', 'Deadlines differ by course and by round. Note the one that applies to you and work back from it.', 'deadline', 'high'],
  ],
  eligibility: [
    ['Check the academic requirements', 'Compare your grades and subjects against what the course asks for.', 'eligibility', 'high'],
    ['Check the English language requirement', 'Find the minimum score and whether individual band scores are set separately.', 'eligibility', 'high'],
    ['Check whether any admission test is required', 'Some courses and countries require an entrance or aptitude test with its own deadline.', 'eligibility', 'medium'],
  ],
  documents: [
    ['Gather your academic transcripts', 'Official transcripts for every year of study, translated if they are not in English.', 'document', 'high'],
    ['Write your personal statement', 'Why this subject, why this university, and what you have done that shows it.', 'document', 'high'],
    ['Request your letters of recommendation', 'Ask early. Referees need time, and most portals want their details before you submit.', 'document', 'high'],
    ['Prepare your CV', 'Education, work, activities and achievements on one or two pages.', 'document', 'medium'],
  ],
  improve: [
    ['Review your personal statement', 'Read it back against the course page and cut anything that is not about this course.', 'improvement', 'medium'],
    ['Strengthen your weakest requirement', 'Whichever requirement you are furthest from meeting is the one worth the remaining time.', 'improvement', 'medium'],
  ],
  submit: [
    ['Complete the online application form', 'Fill in the university or national portal and attach every document it asks for.', 'submission', 'high'],
    ['Pay the application fee and submit', 'Keep the confirmation — it is what you quote if you need to chase the application.', 'submission', 'high'],
  ],
};

async function main() {
  console.log(`Repairing stranded applications${APPLY ? '' : ' (DRY RUN — nothing will be written)'}…\n`);

  const { data: pending, error: pendingError } = await supabase
    .from('course_applications')
    .select('id, university_name, course_name, created_at')
    .eq('parse_status', 'pending');

  if (pendingError) {
    console.error('✖ Could not read applications:', pendingError.message);
    process.exit(1);
  }

  // Both queues, because either one legitimately explains a pending row.
  const [{ data: parseJobs }, { data: ingestionJobs }] = await Promise.all([
    supabase.from('course_parse_jobs').select('application_id'),
    supabase.from('programme_ingestion_jobs').select('application_id'),
  ]);

  const queued = new Set([
    ...(parseJobs ?? []).map((j) => j.application_id),
    ...(ingestionJobs ?? []).map((j) => j.application_id),
  ]);

  const stranded = (pending ?? []).filter((app) => !queued.has(app.id));

  console.log(`  parse_status = 'pending' : ${pending?.length ?? 0}`);
  console.log(`  ...with a job behind them: ${(pending?.length ?? 0) - stranded.length}`);
  console.log(`  ...STRANDED              : ${stranded.length}\n`);

  if (stranded.length === 0) {
    console.log('Nothing to repair.');
    return;
  }

  for (const app of stranded) {
    const age = Math.round((Date.now() - new Date(app.created_at).getTime()) / 86_400_000);
    console.log(`  ${app.id}  ${String(app.university_name).slice(0, 40).padEnd(40)} stranded ${age}d`);
  }
  console.log('');

  if (!APPLY) {
    console.log(`Dry run. Re-run with --apply to repair these ${stranded.length}.`);
    return;
  }

  let repaired = 0;
  let failed = 0;

  for (const app of stranded) {
    try {
      await seedBaseline(app.id);

      const { error: statusError } = await supabase
        .from('course_applications')
        .update({
          parse_status: 'complete',
          // Clear any half-written reason: nothing failed here, the job simply
          // never existed.
          parse_error: null,
        })
        .eq('id', app.id);

      if (statusError) throw new Error(statusError.message);
      repaired += 1;
      console.log(`  ✔ ${app.id}`);
    } catch (error) {
      failed += 1;
      console.error(`  ✖ ${app.id}: ${error.message}`);
    }
  }

  console.log(`\nRepaired ${repaired}, failed ${failed}, of ${stranded.length}.`);
  if (failed > 0) process.exitCode = 1;
}

/** Idempotent: matches stages on slug and only fills stages that have no task. */
async function seedBaseline(applicationId) {
  const { data: existingStages, error: readError } = await supabase
    .from('application_stages')
    .select('id, slug')
    .eq('application_id', applicationId);
  if (readError) throw new Error(readError.message);

  const idBySlug = new Map((existingStages ?? []).map((s) => [s.slug, s.id]));
  const missing = STAGES.filter((s) => !idBySlug.has(s.slug));

  if (missing.length > 0) {
    const { data: created, error: stageError } = await supabase
      .from('application_stages')
      .insert(
        missing.map((stage) => ({
          application_id: applicationId,
          name: stage.name,
          slug: stage.slug,
          description: stage.description,
          order_num: STAGES.findIndex((s) => s.slug === stage.slug) + 1,
          status: 'not_started',
          is_required: true,
          ai_generated: false,
        })),
      )
      .select('id, slug');
    if (stageError) throw new Error(stageError.message);
    for (const stage of created ?? []) idBySlug.set(stage.slug, stage.id);
  }

  const { data: existingTasks, error: taskReadError } = await supabase
    .from('application_tasks')
    .select('stage_id')
    .eq('application_id', applicationId);
  if (taskReadError) throw new Error(taskReadError.message);

  const filled = new Set((existingTasks ?? []).map((t) => t.stage_id));

  const rows = STAGES.flatMap((stage) => {
    const stageId = idBySlug.get(stage.slug);
    if (!stageId || filled.has(stageId)) return [];
    return (BASELINE[stage.key] ?? []).map(([title, description, type, priority], index) => ({
      application_id: applicationId,
      stage_id: stageId,
      title,
      description,
      task_type: type,
      status: 'not_started',
      priority,
      confidence: null,
      sort_order: index,
      created_by: 'system',
    }));
  });

  if (rows.length === 0) return;

  const { error: taskError } = await supabase.from('application_tasks').insert(rows);
  if (taskError) {
    if (taskError.code === '23514') {
      throw new Error(
        "application_tasks.created_by does not accept 'system' — apply supabase-apply-baseline-checklist.sql first",
      );
    }
    throw new Error(taskError.message);
  }
}

main().catch((error) => {
  console.error('✖ Unhandled error:', error);
  process.exit(1);
});
