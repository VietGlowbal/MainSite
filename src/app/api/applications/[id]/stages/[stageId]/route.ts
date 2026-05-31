import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * PATCH /api/applications/:id/stages/:stageId
 * 
 * Update a stage's status.
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; stageId: string }> }
) {
  try {
    const { id, stageId } = await context.params;
    const supabase = await createClient();
    
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { status } = body;

    if (!status || !['not_started', 'in_progress', 'completed', 'blocked'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be one of: not_started, in_progress, completed, blocked' },
        { status: 400 }
      );
    }

    // Verify the application belongs to the user
    const { data: application, error: appError } = await supabase
      .from('course_applications')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (appError || !application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    // Verify the stage belongs to the application
    const { data: stage, error: stageError } = await supabase
      .from('application_stages')
      .select('id')
      .eq('id', stageId)
      .eq('application_id', id)
      .single();

    if (stageError || !stage) {
      return NextResponse.json({ error: 'Stage not found' }, { status: 404 });
    }

    // Update the stage status
    const { error: updateError } = await supabase
      .from('application_stages')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', stageId);

    if (updateError) {
      console.error('Error updating stage:', updateError);
      return NextResponse.json(
        { error: 'Failed to update stage' },
        { status: 500 }
      );
    }

    // Recalculate application progress
    const { data: allStages } = await supabase
      .from('application_stages')
      .select('status')
      .eq('application_id', id);

    if (allStages) {
      const completedStages = allStages.filter(s => s.status === 'completed').length;
      const totalStages = allStages.length;
      const progressPercentage = totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0;

      await supabase
        .from('course_applications')
        .update({ 
          progress_percentage: progressPercentage,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);
    }

    return NextResponse.json({ success: true, status });
  } catch (error) {
    console.error('Error in PATCH /api/applications/[id]/stages/[stageId]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
