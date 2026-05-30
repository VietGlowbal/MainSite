import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * PATCH /api/applications/:id/tasks/:taskId
 * 
 * Update a task's status and recalculate application progress.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const { id: applicationId, taskId } = await params;
    const body = await request.json();
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Verify the application belongs to the user
    const { data: application, error: appError } = await supabase
      .from('course_applications')
      .select('id')
      .eq('id', applicationId)
      .eq('user_id', user.id)
      .single();
    
    if (appError || !application) {
      return NextResponse.json(
        { error: 'Application not found' },
        { status: 404 }
      );
    }
    
    // Update the task
    const updateData: Record<string, unknown> = {};
    if (body.status !== undefined) updateData.status = body.status;
    if (body.notes !== undefined) updateData.notes = body.notes;
    
    const { data: task, error: taskError } = await supabase
      .from('application_tasks')
      .update(updateData)
      .eq('id', taskId)
      .eq('application_id', applicationId)
      .select()
      .single();
    
    if (taskError || !task) {
      console.error('Error updating task:', taskError);
      return NextResponse.json(
        { error: 'Failed to update task' },
        { status: 500 }
      );
    }
    
    // Recalculate progress
    const { data: allTasks, error: tasksError } = await supabase
      .from('application_tasks')
      .select('status')
      .eq('application_id', applicationId);
    
    if (tasksError) {
      console.error('Error fetching tasks for progress calculation:', tasksError);
      // Don't fail the request, just skip progress update
    } else if (allTasks && allTasks.length > 0) {
      const completedCount = allTasks.filter(t => t.status === 'completed').length;
      const progressPercentage = Math.round((completedCount / allTasks.length) * 100);
      
      // Update application progress
      await supabase
        .from('course_applications')
        .update({ progress_percentage: progressPercentage })
        .eq('id', applicationId);
    }
    
    // Update stage status based on tasks
    const { data: stageTasks, error: stageTasksError } = await supabase
      .from('application_tasks')
      .select('status')
      .eq('stage_id', task.stage_id);
    
    if (!stageTasksError && stageTasks && stageTasks.length > 0) {
      const allCompleted = stageTasks.every(t => t.status === 'completed');
      const anyInProgress = stageTasks.some(t => t.status === 'in_progress');
      const anyStarted = stageTasks.some(t => t.status !== 'not_started');
      
      let stageStatus = 'not_started';
      if (allCompleted) {
        stageStatus = 'completed';
      } else if (anyInProgress || anyStarted) {
        stageStatus = 'in_progress';
      }
      
      await supabase
        .from('application_stages')
        .update({ status: stageStatus })
        .eq('id', task.stage_id);
    }
    
    return NextResponse.json({ 
      success: true,
      task: {
        id: task.id,
        status: task.status,
        notes: task.notes,
        updatedAt: task.updated_at,
      }
    });
  } catch (error) {
    console.error('Unexpected error in PATCH /api/applications/:id/tasks/:taskId:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
