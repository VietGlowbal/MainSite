/**
 * Manual Course URL Paste Endpoint
 *
 * Task 19.1 / Ingestion task: Keep existing /api/applications/from-course-url endpoint.
 *
 * Feature flag:  COURSE_URL_INGESTION_PROVIDER=ingestion (default) | legacy
 *
 * When provider=ingestion:
 *   - cache hit  → attach existing data immediately, return 200
 *   - cache miss → enqueue Python ingestion job, return 202
 *
 * When provider=legacy (or flag unset in non-dev):
 *   - legacy TypeScript/OpenAI parser is used (preserved for rollback)
 *
 * This endpoint does NOT call Python or OpenAI directly.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { validateCourseUrl } from '@/lib/course-search/url-validator';
import { canAddCoursesToApply } from '@/lib/entitlements/entitlement-service';
import { createParseJob } from '@/lib/course-parser/job-queue';
import { lookupCrawlCache } from '@/lib/ingestion/cache-lookup';
import {
  createIngestionJob,
  markJobCacheHit,
} from '@/lib/ingestion/ingestion-job-queue';
import { applyCacheHitToApplication } from '@/lib/ingestion/application-mapping';
import { canonicalizeOfficialProgrammeUrl } from '@/lib/ingestion/url-utils';

const requestSchema = z.object({
  courseUrl: z.string().url('Invalid URL format'),
  universityId: z.number().optional(),
});

/** Read feature flag. Defaults to 'ingestion' in development, undefined in production. */
function getIngestionProvider(): 'ingestion' | 'legacy' {
  const env = process.env.COURSE_URL_INGESTION_PROVIDER;
  if (env === 'legacy') return 'legacy';
  if (env === 'ingestion') return 'ingestion';
  // Default: ingestion in dev/test, legacy in production until explicitly set
  return process.env.NODE_ENV === 'production' ? 'legacy' : 'ingestion';
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // 1. Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // 2. Validate request body
    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { courseUrl, universityId } = parsed.data;
    const provider = getIngestionProvider();

    // 3. Check entitlements (manual paste counts toward 5-course limit)
    const entitlementCheck = await canAddCoursesToApply(user.id, 1);

    if (!entitlementCheck.allowed) {
      return NextResponse.json(
        {
          error: entitlementCheck.reason || 'You have reached your course limit',
          upgradeRequired: entitlementCheck.upgradeRequired,
          usage: entitlementCheck.usage,
        },
        { status: 403 }
      );
    }

    // 4. Resolve university domain/seed info
    let universityName: string | null = null;
    let domain: string | null = null;
    let institutionId: string | null = null;
    let allowedDomains: string[] = [];

    if (universityId) {
      const { data: uni, error: uniError } = await supabase
        .from('universities')
        .select(
          'id, name, primary_domain, domain_candidates, domain_review_status, crawl_seed_enabled'
        )
        .eq('id', universityId)
        .single();

      if (!uniError && uni) {
        universityName = uni.name;
        domain = uni.primary_domain ?? null;
        institutionId = `supabase-${uni.id}`;
        allowedDomains = [
          ...(domain ? [domain] : []),
          ...(Array.isArray(uni.domain_candidates)
            ? uni.domain_candidates.filter(
                (item): item is string => typeof item === 'string'
              )
            : []),
        ];
        if (
          provider === 'ingestion' &&
          (uni.domain_review_status !== 'approved' ||
            uni.crawl_seed_enabled !== true ||
            !domain)
        ) {
          return NextResponse.json(
            {
              error: 'University domain is not approved for ingestion',
              errorCode: 'UNAPPROVED_DOMAIN',
            },
            { status: 400 }
          );
        }
      } else {
        if (provider === 'ingestion') {
          return NextResponse.json(
            {
              error: 'University was not found or is not available for ingestion',
              errorCode: 'UNIVERSITY_NOT_FOUND',
            },
            { status: 400 }
          );
        }
        // Legacy compatibility when domain migration has not been applied.
        const { data: uniBasic } = await supabase
          .from('universities')
          .select('id, name')
          .eq('id', universityId)
          .single();
        if (uniBasic) {
          universityName = uniBasic.name;
          institutionId = `supabase-${uniBasic.id}`;
        }
      }
    }

    // 5. Validate and canonicalize URL.
    let canonicalUrl: string | null = null;
    if (provider === 'ingestion') {
      if (!universityId || !institutionId || allowedDomains.length === 0) {
        return NextResponse.json(
          {
            error: 'A verified university is required for programme ingestion',
            errorCode: 'UNIVERSITY_REQUIRED',
          },
          { status: 400 }
        );
      }
      try {
        canonicalUrl = canonicalizeOfficialProgrammeUrl(
          courseUrl,
          allowedDomains
        );
      } catch (error) {
        return NextResponse.json(
          {
            error: 'Invalid course URL',
            errorCode: 'INVALID_URL',
            reason:
              error instanceof Error ? error.message : 'Invalid programme URL',
          },
          { status: 400 }
        );
      }
    } else {
      const validationResult = await validateCourseUrl(courseUrl, domain);
      if (!validationResult.isValid) {
        return NextResponse.json(
          {
            error: 'Invalid course URL',
            errorCode: 'INVALID_URL',
            reason: validationResult.reason,
          },
          { status: 400 }
        );
      }
    }

    // 6. Check for duplicate application using canonical URL for ingestion.
    let duplicateQuery = supabase
      .from('course_applications')
      .select('id')
      .eq('user_id', user.id)
      .neq('status', 'archived');
    duplicateQuery =
      provider === 'ingestion'
        ? duplicateQuery.eq('course_url_canonical', canonicalUrl!)
        : duplicateQuery.eq('course_url', courseUrl);
    const { data: existingApp, error: duplicateCheckError } =
      await duplicateQuery.maybeSingle();

    if (duplicateCheckError) {
      console.error('Error checking for duplicate:', duplicateCheckError);
      return NextResponse.json(
        { error: 'Failed to check for duplicate applications' },
        { status: 500 }
      );
    }
    if (existingApp) {
      return NextResponse.json(
        {
          error: 'Already in your shortlist',
          duplicate: true,
          existingApplicationId: existingApp.id,
        },
        { status: 409 }
      );
    }

    // 7. Create application row (pending)
    const { data: newApp, error: createError } = await supabase
      .from('course_applications')
      .insert({
        user_id: user.id,
        university_id: universityId ?? null,
        university_name: universityName ?? 'Unknown University',
        course_name: 'Loading course details...',
        course_url: courseUrl,
        ...(provider === 'ingestion'
          ? { course_url_canonical: canonicalUrl }
          : {}),
        status: 'researching',
        parse_status: 'pending',
        progress_percentage: 0,
      })
      .select()
      .single();

    if (createError || !newApp) {
      console.error('Error creating application:', createError);
      return NextResponse.json(
        { error: 'Failed to create application' },
        { status: 500 }
      );
    }

    // -----------------------------------------------------------------------
    // INGESTION PROVIDER PATH
    // -----------------------------------------------------------------------
    if (provider === 'ingestion') {
      try {
        // 8a. Create ingestion job record (idempotent)
        const job = await createIngestionJob({
          applicationId: newApp.id,
          userId: user.id,
          universityId: universityId ?? null,
          institutionId,
          submittedUrl: courseUrl,
          canonicalUrl: canonicalUrl!,
        });

        // 8b. Cache lookup — search existing completed crawl data
        const cacheResult = await lookupCrawlCache(canonicalUrl!);

        if (cacheResult.found) {
          // Update the application first. A failed mapping must not leave a
          // completed job attached to a still-pending application.
          await applyCacheHitToApplication({
            applicationId: newApp.id,
            runId: cacheResult.runId,
            programmeId: cacheResult.programmeId,
            courseId: cacheResult.courseId,
            jobId: job.id,
            programmeName: cacheResult.programmeName,
            degreeLevel: cacheResult.degreeLevel,
            deliveryMode: cacheResult.deliveryMode,
          });
          await markJobCacheHit(
            job.id,
            cacheResult.runId,
            cacheResult.programmeId
          );

          return NextResponse.json({
            success: true,
            status: 'complete',
            cacheHit: true,
            applicationId: newApp.id,
            programmeId: cacheResult.programmeId,
            jobId: job.id,
          });
        }

        // Cache miss: job is already enqueued; Python worker will process it.
        return NextResponse.json(
          {
            success: true,
            status: 'pending',
            cacheHit: false,
            applicationId: newApp.id,
            jobId: job.id,
            message:
              'Course added to your shortlist. Analysing programme in background...',
          },
          { status: 202 }
        );
      } catch (ingestionError) {
        console.error('Failed to initialise programme ingestion:', ingestionError);
        // Compensating rollback: the application was created in this request,
        // but no usable ingestion state can be returned. The job FK cascades.
        await supabase
          .from('course_applications')
          .delete()
          .eq('id', newApp.id)
          .eq('user_id', user.id);
        return NextResponse.json(
          { error: 'Failed to initialise programme ingestion' },
          { status: 500 }
        );
      }
    }

    // -----------------------------------------------------------------------
    // LEGACY PROVIDER PATH (preserved for rollback)
    // -----------------------------------------------------------------------
    /*
     * ⚠️ THIS USED TO BE BEST-EFFORT AND SILENT, AND IT STRANDED ROWS.
     *
     * The row is inserted `parse_status: 'pending'` above, and the enqueue below
     * used to sit in a catch commented "Best-effort — don't fail the request".
     * `createParseJob` also returns null on a write failure instead of throwing,
     * so a failed enqueue left an application permanently claiming a parse was
     * running with no job behind it. Measured 2026-08-01: 13 of 37 live
     * applications are in exactly that state, the oldest since 15 June, each one
     * rendering "GlowBal's AI is reading the course page…" forever.
     *
     * The request still succeeds — the application exists and is the thing the
     * student asked for — but the row is settled honestly so the UI stops
     * promising work nobody is doing. `scripts/repair-stranded-applications.mjs`
     * cleans up the ones already in the database.
     */
    let job: Awaited<ReturnType<typeof createParseJob>> = null;
    try {
      job = await createParseJob(newApp.id, courseUrl, universityId ?? null);
    } catch (jobError) {
      console.error('Error creating parse job (legacy):', jobError);
    }

    if (!job) {
      await supabase
        .from('course_applications')
        .update({
          parse_status: 'failed',
          parse_error: 'We could not start reading that course page. Try again from your plan.',
        })
        .eq('id', newApp.id)
        .eq('user_id', user.id);

      return NextResponse.json({
        success: true,
        applicationId: newApp.id,
        parseQueued: false,
        message: 'Course added to your shortlist, but we could not start reading the page.',
      });
    }

    return NextResponse.json({
      success: true,
      applicationId: newApp.id,
      parseQueued: true,
      message: 'Course added to your shortlist. Building checklist in background...',
    });
  } catch (error) {
    console.error('Error in from-course-url endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
