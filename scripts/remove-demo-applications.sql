-- Remove demo applications from the Apply system
-- This script deletes the placeholder/demo applications that were seeded for testing

-- First, delete all related tasks for these applications
DELETE FROM application_tasks
WHERE application_id IN (
  SELECT id FROM course_applications
  WHERE course_name IN (
    'BSc Biology',
    'MEng Engineering',
    'BSc Computer Science',
    'BSc Business Administration'
  )
  AND university_name IN (
    'The University of Manchester',
    'University of Cambridge',
    'VinUniversity'
  )
);

-- Then delete all related stages
DELETE FROM application_stages
WHERE application_id IN (
  SELECT id FROM course_applications
  WHERE course_name IN (
    'BSc Biology',
    'MEng Engineering',
    'BSc Computer Science',
    'BSc Business Administration'
  )
  AND university_name IN (
    'The University of Manchester',
    'University of Cambridge',
    'VinUniversity'
  )
);

-- Finally, delete the applications themselves
DELETE FROM course_applications
WHERE course_name IN (
  'BSc Biology',
  'MEng Engineering',
  'BSc Computer Science',
  'BSc Business Administration'
)
AND university_name IN (
  'The University of Manchester',
  'University of Cambridge',
  'VinUniversity'
);

-- Verify deletion
SELECT 
  COUNT(*) as remaining_applications,
  STRING_AGG(DISTINCT course_name, ', ') as courses
FROM course_applications;
