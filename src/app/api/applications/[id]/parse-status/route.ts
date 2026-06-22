import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  try {
    const supabase = await createClient();
    
    // Get the authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Fetch the application with parse_status
    const { data: application, error: fetchError } = await supabase
      .from('course_applications')
      .select('id, parse_status, progress_percentage, user_id')
      .eq('id', id)
      .single();
    
    if (fetchError || !application) {
      return NextResponse.json(
        { error: 'Application not found' },
        { status: 404 }
      );
    }
    
    // Verify the application belongs to the user
    if (application.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }
    
    // Return the parse status and progress (camelCase for client)
    return NextResponse.json({
      id: application.id,
      parseStatus: application.parse_status,
      progressPercentage: application.progress_percentage,
    });
  } catch (error) {
    console.error('Error fetching parse status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
