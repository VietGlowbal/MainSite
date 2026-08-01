/**
 * POST /api/applications/from-saved-university
 *
 * Turn a saved university into a tracked application. This is the way
 * applications are created since the redesign: the student ticks a university on
 * the saved list, optionally attaches a scholarship, and presses "Plan my
 * application". The paste-a-course-URL bar that used to be the entry point is
 * gone from /apply.
 *
 * WHY THIS IS NOT `from-course-url` WITH A DIFFERENT BODY. That endpoint is
 * organised around a URL it can read: it validates the URL, canonicalises it
 * against the university's approved domains, and creates a row whose course name
 * is the literal "Loading course details..." until a parse fills it in. None of
 * that is available here. 24 of the 106 universities have a programme catalogue
 * carrying real course links, and only 20 of those clear the ingestion domain
 * gate (measured 2026-08-01) — so for most saved rows there is no URL, and the
 * application has to be worth opening anyway. It is, because:
 *
 *   - every field is real from the moment of insert. The university, its
 *     country and the subject the student chose are things we already hold, so
 *     nothing is a placeholder waiting on a worker;
 *   - the checklist is seeded from the baseline (lib/course-parser/
 *     baseline-checklist.ts) rather than left empty;
 *   - `parse_status` says 'pending' only when a job was genuinely queued. An
 *     application with nothing to parse is 'complete', so the row never claims
 *     the AI is reading a page that does not exist. Thirteen live rows have been
 *     making exactly that claim since 15 June — see the note on the enrichment
 *     step below.
 *
 * It also fixes a long-standing data problem by construction: 29 of 37 existing
 * applications carry no `university_id`, because a pasted URL is matched to the
 * directory by hostname and usually misses. Every row created here has one, so
 * the tracker's crest stops falling back to initials.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { canAddCoursesToApply } from '@/lib/entitlements/entitlement-service';
import { seedBaselineChecklist, BaselineNotEnabledError } from '@/lib/course-parser/baseline-checklist';
import { createParseJob } from '@/lib/course-parser/job-queue';
import { createClient } from '@/lib/supabase/server';

const requestSchema = z.object({
  universityId: z.number().int().positive(),
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 },
      );
    }
    const { universityId } = parsed.data;

    /*
     * The saved row, not the university. Planning an application for a
     * university the student never saved would be creating something they did
     * not ask for, and the subject lives on this row.
     *
     * `select('*')` rather than naming `program` / `program_url`: those columns
     * come from supabase-saved-program.sql, and naming them makes the whole read
     * fail on an environment where it has not been applied. Same call the saved
     * list and the subject picker already make.
     */
    const { data: savedRow, error: savedError } = await supabase
      .from('user_universities')
      .select('*')
      .eq('user_id', user.id)
      .eq('university_id', universityId)
      .maybeSingle();

    if (savedError) {
      console.error('from-saved-university: reading user_universities failed:', savedError.message);
      return NextResponse.json({ error: 'Failed to read your saved list' }, { status: 500 });
    }
    if (!savedRow) {
      return NextResponse.json(
        { error: 'That university is not on your saved list', errorCode: 'NOT_SAVED' },
        { status: 404 },
      );
    }

    const saved = savedRow as { program?: string | null; program_url?: string | null };
    const program = saved.program?.trim() || null;
    const programUrl = saved.program_url?.trim() || null;

    /*
     * No subject, no application. An application is "I am applying to study X at
     * Y" — without X there is nothing to track, nothing to name the row, and
     * nothing for a checklist to be about. The client turns this into a trip to
     * the subject picker and comes back through ?planFor.
     */
    if (!program) {
      return NextResponse.json(
        {
          error: 'Choose a subject for this university first',
          errorCode: 'SUBJECT_REQUIRED',
          universityId,
        },
        { status: 409 },
      );
    }

    const entitlementCheck = await canAddCoursesToApply(user.id, 1);
    if (!entitlementCheck.allowed) {
      return NextResponse.json(
        {
          error: entitlementCheck.reason || 'You have reached your course limit',
          upgradeRequired: entitlementCheck.upgradeRequired,
          usage: entitlementCheck.usage,
        },
        { status: 403 },
      );
    }

    /*
     * Duplicate is (university, subject), not (course URL) as on the other
     * endpoint — there may be no URL, and a student applying to two different
     * subjects at one university is two applications, not one.
     */
    const { data: existingApp, error: duplicateError } = await supabase
      .from('course_applications')
      .select('id')
      .eq('user_id', user.id)
      .eq('university_id', universityId)
      .eq('course_name', program)
      .neq('status', 'archived')
      .maybeSingle();

    if (duplicateError) {
      console.error('from-saved-university: duplicate check failed:', duplicateError.message);
      return NextResponse.json({ error: 'Failed to check your applications' }, { status: 500 });
    }
    if (existingApp) {
      /*
       * 409, and the client treats it as success: "Plan my application" means
       * "make sure this is on my plan", and it already is. The id lets the page
       * point at it.
       */
      return NextResponse.json(
        {
          error: 'Already on your plan',
          duplicate: true,
          existingApplicationId: existingApp.id,
        },
        { status: 409 },
      );
    }

    const { data: university, error: universityError } = await supabase
      .from('universities')
      .select('id, name, country')
      .eq('id', universityId)
      .maybeSingle();

    if (universityError || !university) {
      return NextResponse.json(
        { error: 'University not found', errorCode: 'UNIVERSITY_NOT_FOUND' },
        { status: 404 },
      );
    }

    /*
     * DELIBERATELY NO DEADLINE. `universities.application_deadline` is free
     * prose describing the institution ("UCAS: Jan 15 | Oxford deadline: Oct 15
     * | Graduate: Dec–Jan"), while `course_applications.deadline` is a date
     * column describing one course. Squeezing the first into the second would
     * put a confident date on the row that the university never said about this
     * subject. The tracker already renders "No deadline set" honestly, and the
     * parse fills the column in when it can read a real course page.
     */
    const { data: newApp, error: createError } = await supabase
      .from('course_applications')
      .insert({
        user_id: user.id,
        university_id: universityId,
        university_name: university.name,
        // The subject IS the course here. No placeholder: unlike the pasted-URL
        // path there is nothing pending that would overwrite it.
        course_name: program,
        subject: program,
        course_url: programUrl,
        country: university.country ?? null,
        status: 'researching',
        parse_status: 'complete',
        progress_percentage: 0,
      })
      .select('id')
      .single();

    if (createError || !newApp) {
      console.error('from-saved-university: creating application failed:', createError?.message);
      return NextResponse.json({ error: 'Failed to create the application' }, { status: 500 });
    }

    /*
     * The checklist, before anything else can go wrong. An application with no
     * stages opens as an empty workspace with the donut stuck at 0%, which is
     * the state this whole endpoint exists to stop producing — so a failure here
     * rolls the row back rather than shipping a hollow one.
     */
    try {
      await seedBaselineChecklist(newApp.id);
    } catch (error) {
      console.error('from-saved-university: seeding the baseline checklist failed:', error);
      await supabase.from('course_applications').delete().eq('id', newApp.id).eq('user_id', user.id);
      return NextResponse.json(
        {
          error:
            error instanceof BaselineNotEnabledError
              ? error.message
              : 'Failed to build your checklist',
        },
        { status: 500 },
      );
    }

    /*
     * Enrichment, when there is a page to read. The AI's tasks land on top of
     * the baseline — `writeChecklist` matches the spine by slug and replaces
     * only `created_by = 'ai'` tasks, so nothing the student has already ticked
     * is lost.
     *
     * ⚠️ NOT BEST-EFFORT-SILENT, and that is the whole point. `from-course-url`
     * wraps this same call in a catch commented "Best-effort — don't fail the
     * request", which is how 13 live applications ended up marked
     * `parse_status = 'pending'` with no job row behind them, the oldest
     * stranded since 15 June, each one telling its owner the AI was still
     * reading. Here the row only claims a parse is running once a job actually
     * exists; if the queue refuses, the application keeps its baseline and stays
     * honest about not being enriched.
     *
     * The legacy queue rather than the ingestion pipeline: `course_parse_jobs`
     * is what the cron worker in vercel.json drains, and it is the path that has
     * demonstrably produced checklists (22 complete jobs). `programme_ingestion_jobs`
     * has never had a row. The ingestion route remains reachable through
     * from-course-url for the 20 domain-approved universities.
     */
    let enrichment: 'queued' | 'none' | 'unavailable' = 'none';
    if (programUrl) {
      /* try/catch rather than `.catch()`: `createParseJob` reports a write
         failure by returning null, and only throws for something unexpected.
         Both have to land in the same place. */
      let job: Awaited<ReturnType<typeof createParseJob>> = null;
      try {
        job = await createParseJob(newApp.id, programUrl, universityId);
      } catch (error) {
        console.error('from-saved-university: queueing the parse failed:', error);
      }

      if (job) {
        enrichment = 'queued';
        const { error: statusError } = await supabase
          .from('course_applications')
          .update({ parse_status: 'pending' })
          .eq('id', newApp.id)
          .eq('user_id', user.id);
        if (statusError) {
          // The job will still run; the row simply will not show the
          // "reading the course page" state. Better than the reverse.
          console.error(
            'from-saved-university: marking the application pending failed:',
            statusError.message,
          );
        }
      } else {
        enrichment = 'unavailable';
      }
    }

    return NextResponse.json({
      success: true,
      applicationId: newApp.id,
      universityId,
      program,
      enrichment,
    });
  } catch (error) {
    console.error('from-saved-university: unhandled error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
