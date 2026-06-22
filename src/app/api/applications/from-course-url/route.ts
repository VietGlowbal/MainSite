/**
 * Manual Course URL Paste Endpoint
 * 
 * Task 19.1: Keep existing /api/applications/from-course-url endpoint
 * 
 * This is the fallback/manual entry point for adding courses to Apply.
 * - Does NOT count as a course search session
 * - DOES count toward the 5 active shortlist courses limit
 * 
 * Primary flow is now: course_search_sessions + apply-shortlist/add-courses
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { validateCourseUrl } from '@/lib/course-search/url-validator';
import { canAddCoursesToApply } from '@/lib/entitlements/entitlement-service';
import { createParseJob } from '@/lib/course-parser/job-queue';

const requestSchema = z.object({
  courseUrl: z.string().url('Invalid URL format'),
  universityId: z.number().optional(),
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    // 1. Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
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
    
    // 4. Check for duplicate application
    const { data: existingApp, error: duplicateCheckError } = await supabase
      .from('course_applications')
      .select('id')
      .eq('user_id', user.id)
      .eq('course_url', courseUrl)
      .neq('status', 'archived')
      .maybeSingle();
    
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
    
    // 5. Get university domain if universityId provided
    let primaryDomain: string | null = null;
    let universityName: string | null = null;
    let universityData = null;
    
    if (universityId) {
      const { data: uni, error: uniError } = await supabase
        .from('universities')
        .select('id, name, primary_domain')
        .eq('id', universityId)
        .single();
      
      if (!uniError && uni) {
        primaryDomain = uni.primary_domain;
        universityName = uni.name;
        universityData = uni;
      }
    }
    
    // 6. Validate URL
    const validationResult = await validateCourseUrl(courseUrl, primaryDomain);
    
    if (!validationResult.isValid) {
      return NextResponse.json(
        {
          error: 'Invalid course URL',
          reason: validationResult.reason,
        },
        { status: 400 }
      );
    }
    
    // 7. Create application with pending parse status
    const { data: newApp, error: createError } = await supabase
      .from('course_applications')
      .insert({
        user_id: user.id,
        university_id: universityId || null,
        university_name: universityName || 'Unknown University',
        course_name: 'Loading course details...',
        course_url: courseUrl,
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
    
    // 8. Create parse job to extract course details in background
    try {
      await createParseJob(
        newApp.id,
        courseUrl,
        universityId || null
      );
    } catch (jobError) {
      console.error('Error creating parse job:', jobError);
      // Don't fail the request - job creation is best-effort
    }
    
    // 9. Return success
    return NextResponse.json({
      success: true,
      applicationId: newApp.id,
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
