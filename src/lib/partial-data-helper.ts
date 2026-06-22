/**
 * Partial Data Helper
 * 
 * Utilities for detecting and handling applications with incomplete/partial data
 * from the AI course parsing process.
 * 
 * Task 25.1 & 25.2: Generate verification tasks and label partial data applications
 */

import type { CourseApplication } from './apply-types';

/**
 * Key fields that should be present in a complete course application
 */
const KEY_FIELDS = [
  'tuition_fees',
  'entry_requirements',
  'deadlines',
  'application_method',
] as const;

type KeyField = typeof KEY_FIELDS[number];

/**
 * Field labels for display
 */
const FIELD_LABELS: Record<KeyField, string> = {
  tuition_fees: 'Tuition fees',
  entry_requirements: 'Entry requirements',
  deadlines: 'Application deadline',
  application_method: 'Application method',
};

/**
 * Verification task descriptions for missing fields
 */
const VERIFICATION_TASKS: Record<KeyField, { title: string; description: string }> = {
  tuition_fees: {
    title: 'Check tuition fees',
    description: 'Visit the official course page to find tuition fees and any additional costs.',
  },
  entry_requirements: {
    title: 'Check entry requirements',
    description: 'Review the official entry requirements including grades, qualifications, and prerequisites.',
  },
  deadlines: {
    title: 'Confirm application deadline',
    description: 'Find the application deadline and any important submission dates on the official course page.',
  },
  application_method: {
    title: 'Determine application method',
    description: 'Check whether you need to apply through UCAS or directly to the university.',
  },
};

/**
 * Check which key fields are missing from an application
 * 
 * Task 25.2: Identify missing fields for partial data labeling
 */
export function getMissingFields(app: Partial<CourseApplication>): KeyField[] {
  const missing: KeyField[] = [];
  
  // Check tuition fees (approximated by checking if we have any fee-related data)
  // In real implementation, this would check course.tuition_fees field
  if (!app.aiSummary?.toLowerCase().includes('fee') && !app.aiSummary?.toLowerCase().includes('tuition')) {
    missing.push('tuition_fees');
  }
  
  // Check entry requirements (approximated by aiSummary content)
  if (!app.aiSummary?.toLowerCase().includes('requirement') && !app.aiSummary?.toLowerCase().includes('grade')) {
    missing.push('entry_requirements');
  }
  
  // Check deadline
  if (!app.deadline && !app.deadlineSource) {
    missing.push('deadlines');
  }
  
  // Check application method
  if (!app.applicationMethod) {
    missing.push('application_method');
  }
  
  return missing;
}

/**
 * Check if an application has partial data (2+ key fields missing)
 * 
 * Task 25.2: Determine if "Partially generated checklist" badge should be shown
 */
export function hasPartialData(app: Partial<CourseApplication>): boolean {
  const missingFields = getMissingFields(app);
  return missingFields.length >= 2;
}

/**
 * Get human-readable list of missing fields
 * 
 * Task 25.2: Display missing fields in Application Workspace
 */
export function getMissingFieldsDisplay(app: Partial<CourseApplication>): string[] {
  const missingFields = getMissingFields(app);
  return missingFields.map(field => FIELD_LABELS[field]);
}

/**
 * Generate verification task data for missing fields
 * 
 * Task 25.1: Create tasks that link to official course page
 */
export function generateVerificationTasks(
  app: CourseApplication,
  missingFields?: KeyField[]
): Array<{
  title: string;
  description: string;
  taskType: 'verification';
  actionType: 'external_url';
  actionTarget: string;
  actionLabel: string;
  priority: 'medium';
}> {
  const fields = missingFields || getMissingFields(app);
  
  return fields.map(field => ({
    title: VERIFICATION_TASKS[field].title,
    description: VERIFICATION_TASKS[field].description,
    taskType: 'verification' as const,
    actionType: 'external_url' as const,
    actionTarget: app.courseUrl || '',
    actionLabel: 'Visit official page',
    priority: 'medium' as const,
  }));
}

/**
 * Get partial data badge info
 * 
 * Task 25.2: Badge display logic for ApplicationCard
 */
export function getPartialDataBadge(app: Partial<CourseApplication>): {
  show: boolean;
  text: string;
  color: string;
  bgColor: string;
  borderColor: string;
  missingCount: number;
} | null {
  const missingFields = getMissingFields(app);
  
  if (missingFields.length < 2) {
    return null;
  }
  
  return {
    show: true,
    text: 'Partially generated checklist',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    missingCount: missingFields.length,
  };
}
