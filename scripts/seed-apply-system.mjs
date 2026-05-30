#!/usr/bin/env node

/**
 * Seed script for Apply System
 * 
 * This script seeds the database with the three mock applications
 * from the original mock data, including all stages and tasks.
 * 
 * Usage:
 *   node --env-file=.env.local scripts/seed-apply-system.mjs
 *   node --env-file=.env.local scripts/seed-apply-system.mjs --cleanup
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

// Mock user ID - replace with actual user ID from your auth.users table
const MOCK_USER_ID = 'de9b3654-9e29-4381-93d8-0ab9ca78b186';

const DEFAULT_STAGES = [
  {
    name: 'Research',
    order_num: 1,
    description: 'Learn about the course, the university, and the application process.',
    is_required: true,
  },
  {
    name: 'Check eligibility',
    order_num: 2,
    description: 'Confirm you meet all the academic, language, and subject requirements.',
    is_required: true,
  },
  {
    name: 'Prepare documents',
    order_num: 3,
    description: 'Gather transcripts, references, and supporting documents.',
    is_required: true,
  },
  {
    name: 'Improve application',
    order_num: 4,
    description: 'Strengthen your personal statement, CV, and supporting materials.',
    is_required: true,
  },
  {
    name: 'Submit',
    order_num: 5,
    description: 'Complete and submit your application.',
    is_required: true,
  },
  {
    name: 'Interview',
    order_num: 6,
    description: 'Prepare for and attend any interviews or assessments.',
    is_required: false,
  },
  {
    name: 'Decision',
    order_num: 7,
    description: 'Track your application outcome and respond to offers.',
    is_required: true,
  },
];

const MOCK_APPLICATIONS = [
  {
    id: 'app_1',
    user_id: MOCK_USER_ID,
    university_name: 'The University of Manchester',
    course_name: 'BSc Computer Science',
    course_url: 'https://www.manchester.ac.uk/study/undergraduate/courses/2027/00560/bsc-computer-science/',
    degree_level: 'Undergraduate',
    subject: 'Computer Science',
    study_mode: 'Full-time',
    intake: 'Sep 2027',
    country: 'United Kingdom',
    country_flag: '🇬🇧',
    application_method: 'UCAS',
    application_code: 'G400',
    deadline: '2027-01-15',
    tuition_fee: '£28,000 / year',
    entry_requirements_summary: 'A*AA including Mathematics',
    status: 'preparing',
    progress_percentage: 42,
    match_score: 73,
    next_action: 'Upload your personal statement draft',
    image_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Main_Building%2C_The_University_of_Manchester.jpg/1280px-Main_Building%2C_The_University_of_Manchester.jpg',
    source_confidence: 'high',
    created_at: '2025-05-01T10:00:00Z',
    updated_at: '2025-05-20T14:30:00Z',
    tasks: {
      'Research': [
        {
          title: 'Review course overview and structure',
          description: 'Read the official course page and check the modules and teaching style.',
          due_date: '2026-10-01',
          priority: 'medium',
          type: 'recommended',
          status: 'completed',
          source_url: 'https://www.manchester.ac.uk/study/undergraduate/courses/2027/00560/bsc-computer-science/',
          confidence: 'high',
          created_by: 'ai',
          created_at: '2025-05-01T10:00:00Z',
          updated_at: '2025-05-10T12:00:00Z',
        },
        {
          title: 'Watch: An intro to studying Computer Science at Manchester',
          description: 'Find the department video or open day recording.',
          due_date: '2026-10-12',
          priority: 'low',
          type: 'recommended',
          status: 'not_started',
          confidence: 'medium',
          created_by: 'ai',
          created_at: '2025-05-01T10:00:00Z',
          updated_at: '2025-05-01T10:00:00Z',
        },
        {
          title: 'Attend an online open day or webinar',
          description: 'Register and attend an official open day event to learn more.',
          priority: 'low',
          type: 'recommended',
          status: 'not_started',
          source_url: 'https://www.manchester.ac.uk/study/undergraduate/visit/',
          confidence: 'high',
          created_by: 'ai',
          created_at: '2025-05-01T10:00:00Z',
          updated_at: '2025-05-01T10:00:00Z',
        },
      ],
      'Check eligibility': [
        {
          title: 'Confirm academic requirements',
          description: 'Check your predicted or achieved grades against the offer requirements.',
          priority: 'high',
          type: 'required',
          status: 'completed',
          source_url: 'https://www.manchester.ac.uk/study/undergraduate/courses/2027/00560/bsc-computer-science/entry-requirements/',
          confidence: 'high',
          created_by: 'ai',
          created_at: '2025-05-01T10:00:00Z',
          updated_at: '2025-05-15T09:00:00Z',
        },
        {
          title: 'Confirm English language requirements',
          description: 'Check IELTS or equivalent test requirements for international students.',
          priority: 'medium',
          type: 'required',
          status: 'completed',
          source_url: 'https://www.manchester.ac.uk/study/international/english-language-requirements/',
          confidence: 'high',
          created_by: 'ai',
          created_at: '2025-05-01T10:00:00Z',
          updated_at: '2025-05-15T09:00:00Z',
        },
      ],
      'Prepare documents': [
        {
          title: 'Prepare your academic transcript',
          description: 'Obtain official transcripts from your school or previous institution.',
          priority: 'high',
          type: 'required',
          status: 'completed',
          confidence: 'high',
          created_by: 'ai',
          created_at: '2025-05-01T10:00:00Z',
          updated_at: '2025-05-18T10:00:00Z',
        },
        {
          title: 'Request academic reference',
          description: 'Ask your teacher or academic supervisor for a reference letter.',
          priority: 'high',
          type: 'required',
          status: 'in_progress',
          confidence: 'high',
          created_by: 'ai',
          created_at: '2025-05-01T10:00:00Z',
          updated_at: '2025-05-20T10:00:00Z',
        },
        {
          title: 'Upload your personal statement draft',
          description: 'Write and refine your personal statement aligned to Computer Science.',
          priority: 'high',
          type: 'required',
          status: 'not_started',
          support_tool_type: 'sop_maximiser',
          confidence: 'high',
          created_by: 'ai',
          created_at: '2025-05-01T10:00:00Z',
          updated_at: '2025-05-01T10:00:00Z',
        },
      ],
      'Improve application': [
        {
          title: 'Run SOP through SOP Maximiser',
          description: 'Use Glowbal\'s AI tool to get feedback aligned to this specific course.',
          priority: 'high',
          type: 'recommended',
          status: 'not_started',
          support_tool_type: 'sop_maximiser',
          confidence: 'high',
          created_by: 'ai',
          created_at: '2025-05-01T10:00:00Z',
          updated_at: '2025-05-01T10:00:00Z',
        },
        {
          title: 'Get mentor feedback on application',
          description: 'Book a session with a current Manchester student to review your application.',
          priority: 'medium',
          type: 'recommended',
          status: 'not_started',
          support_tool_type: 'mentor',
          confidence: 'medium',
          created_by: 'ai',
          created_at: '2025-05-01T10:00:00Z',
          updated_at: '2025-05-01T10:00:00Z',
        },
      ],
    },
  },
  {
    id: 'app_2',
    user_id: MOCK_USER_ID,
    university_name: 'University of Cambridge',
    course_name: 'MEng Engineering',
    course_url: 'https://www.undergraduate.study.cam.ac.uk/courses/engineering',
    degree_level: 'Undergraduate',
    subject: 'Engineering',
    study_mode: 'Full-time',
    intake: 'Oct 2027',
    country: 'United Kingdom',
    country_flag: '🇬🇧',
    application_method: 'UCAS',
    application_code: 'H100',
    deadline: '2026-10-22',
    tuition_fee: '£9,535 / year',
    entry_requirements_summary: 'A*A*A including Maths and Physics',
    status: 'preparing',
    progress_percentage: 28,
    match_score: 61,
    next_action: 'Register for admissions test',
    image_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/63/King%27s_College%2C_Cambridge_%28cropped%29.jpg/1280px-King%27s_College%2C_Cambridge_%28cropped%29.jpg',
    source_confidence: 'high',
    created_at: '2025-05-05T09:00:00Z',
    updated_at: '2025-05-22T11:00:00Z',
    tasks: {},
  },
  {
    id: 'app_3',
    user_id: MOCK_USER_ID,
    university_name: 'VinUniversity',
    course_name: 'BSc Business Administration',
    course_url: 'https://vinuni.edu.vn/programs/business-administration/',
    degree_level: 'Undergraduate',
    subject: 'Business',
    study_mode: 'Full-time',
    intake: 'Aug 2027',
    country: 'Vietnam',
    country_flag: '🇻🇳',
    application_method: 'Direct Apply',
    deadline: '2027-04-30',
    tuition_fee: '$12,000 / year',
    entry_requirements_summary: 'GPA 3.0+, SAT or equivalent',
    status: 'preparing',
    progress_percentage: 60,
    match_score: 82,
    next_action: 'Request academic reference',
    image_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/Hanoi_panorama.jpg/1280px-Hanoi_panorama.jpg',
    source_confidence: 'medium',
    created_at: '2025-04-20T08:00:00Z',
    updated_at: '2025-05-25T16:00:00Z',
    tasks: {},
  },
];

async function cleanup() {
  console.log('🧹 Cleaning up existing apply system data...');
  
  // Delete in reverse order due to foreign key constraints
  const { error: tasksError } = await supabase
    .from('application_tasks')
    .delete()
    .eq('application_id', 'app_1')
    .or('application_id.eq.app_2,application_id.eq.app_3');
  
  if (tasksError) console.warn('⚠️  Tasks cleanup:', tasksError.message);
  
  const { error: stagesError } = await supabase
    .from('application_stages')
    .delete()
    .eq('application_id', 'app_1')
    .or('application_id.eq.app_2,application_id.eq.app_3');
  
  if (stagesError) console.warn('⚠️  Stages cleanup:', stagesError.message);
  
  const { error: appsError } = await supabase
    .from('course_applications')
    .delete()
    .in('id', ['app_1', 'app_2', 'app_3']);
  
  if (appsError) console.warn('⚠️  Applications cleanup:', appsError.message);
  
  console.log('✅ Cleanup complete\n');
}

async function seed() {
  console.log('🌱 Seeding apply system...\n');
  
  for (const appData of MOCK_APPLICATIONS) {
    const { tasks, ...applicationData } = appData;
    
    console.log(`📝 Creating application: ${applicationData.course_name}`);
    
    // Insert application
    const { data: app, error: appError } = await supabase
      .from('course_applications')
      .insert(applicationData)
      .select()
      .single();
    
    if (appError) {
      console.error(`❌ Failed to create application:`, appError);
      continue;
    }
    
    console.log(`   ✓ Application created: ${app.id}`);
    
    // Insert stages
    for (const stageTemplate of DEFAULT_STAGES) {
      const { data: stage, error: stageError } = await supabase
        .from('application_stages')
        .insert({
          application_id: app.id,
          ...stageTemplate,
        })
        .select()
        .single();
      
      if (stageError) {
        console.error(`   ❌ Failed to create stage ${stageTemplate.name}:`, stageError);
        continue;
      }
      
      // Insert tasks for this stage if they exist
      const stageTasks = tasks[stageTemplate.name] || [];
      if (stageTasks.length > 0) {
        const tasksToInsert = stageTasks.map(task => ({
          application_id: app.id,
          stage_id: stage.id,
          ...task,
        }));
        
        const { error: tasksError } = await supabase
          .from('application_tasks')
          .insert(tasksToInsert);
        
        if (tasksError) {
          console.error(`   ❌ Failed to create tasks for ${stageTemplate.name}:`, tasksError);
        } else {
          console.log(`   ✓ Stage "${stageTemplate.name}" with ${stageTasks.length} tasks`);
        }
      } else {
        console.log(`   ✓ Stage "${stageTemplate.name}" (no tasks)`);
      }
    }
    
    console.log('');
  }
  
  console.log('✅ Seeding complete!');
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--cleanup')) {
    await cleanup();
  } else {
    await cleanup();
    await seed();
  }
  
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
