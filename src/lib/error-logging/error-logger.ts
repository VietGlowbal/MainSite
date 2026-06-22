/**
 * Error Logging Service
 * 
 * Task 22.2: Add error logging
 * 
 * Logs errors with context for debugging and monitoring.
 * Currently logs to console - can be upgraded to database logging later.
 * 
 * Includes context:
 * - error type, message, stack trace
 * - user action
 * - courseUrl, universityId, sessionId where relevant
 */

export type ErrorType = 
  | 'search_failure'
  | 'search_timeout'
  | 'url_validation_failure'
  | 'parsing_timeout'
  | 'parsing_failure'
  | 'quota_exceeded'
  | 'authentication_error'
  | 'network_error'
  | 'unknown_error';

export interface ErrorLogContext {
  errorType: ErrorType;
  message: string;
  userAction?: string;
  courseUrl?: string;
  universityId?: number;
  sessionId?: string;
  userId?: string;
  stackTrace?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Log an error with context
 * 
 * Task 22.2: Log all errors for debugging and monitoring
 * 
 * @param context - Error context with type, message, and relevant data
 */
export function logError(context: ErrorLogContext): void {
  const timestamp = new Date().toISOString();
  
  // Structure the log entry
  const logEntry = {
    timestamp,
    level: 'error',
    ...context,
  };
  
  // Log to console (can be replaced with database insert later)
  console.error('[ERROR]', JSON.stringify(logEntry, null, 2));
  
  // In production, you would also:
  // 1. Insert into application_events or error_logs table
  // 2. Send to monitoring service (Sentry, LogRocket, etc.)
  // 3. Alert on critical errors
  
  // Example database insert (when table is created):
  // await supabase.from('application_events').insert({
  //   event_type: 'error',
  //   error_type: context.errorType,
  //   error_message: context.message,
  //   user_id: context.userId,
  //   course_url: context.courseUrl,
  //   university_id: context.universityId,
  //   session_id: context.sessionId,
  //   user_action: context.userAction,
  //   stack_trace: context.stackTrace,
  //   metadata: context.metadata,
  //   created_at: new Date(),
  // });
}

/**
 * Log a search error
 */
export function logSearchError(params: {
  message: string;
  universityId: number;
  query: string;
  userId?: string;
  statusCode?: number;
  error?: Error;
}): void {
  logError({
    errorType: params.statusCode === 408 ? 'search_timeout' : 'search_failure',
    message: params.message,
    userAction: 'search_courses',
    universityId: params.universityId,
    userId: params.userId,
    stackTrace: params.error?.stack,
    metadata: {
      query: params.query,
      statusCode: params.statusCode,
    },
  });
}

/**
 * Log a URL validation error
 */
export function logUrlValidationError(params: {
  message: string;
  courseUrl: string;
  userId?: string;
  reason?: string;
}): void {
  logError({
    errorType: 'url_validation_failure',
    message: params.message,
    userAction: 'paste_course_url',
    courseUrl: params.courseUrl,
    userId: params.userId,
    metadata: {
      reason: params.reason,
    },
  });
}

/**
 * Log a parsing error
 */
export function logParsingError(params: {
  message: string;
  courseUrl: string;
  applicationId: string;
  userId?: string;
  isTimeout: boolean;
  error?: Error;
}): void {
  logError({
    errorType: params.isTimeout ? 'parsing_timeout' : 'parsing_failure',
    message: params.message,
    userAction: 'parse_course_page',
    courseUrl: params.courseUrl,
    userId: params.userId,
    stackTrace: params.error?.stack,
    metadata: {
      applicationId: params.applicationId,
    },
  });
}

/**
 * Log a quota exceeded error
 */
export function logQuotaExceededError(params: {
  message: string;
  userId: string;
  limitType: 'search' | 'courses';
  currentUsage: number;
  limit: number;
}): void {
  logError({
    errorType: 'quota_exceeded',
    message: params.message,
    userAction: params.limitType === 'search' ? 'search_courses' : 'add_courses',
    userId: params.userId,
    metadata: {
      limitType: params.limitType,
      currentUsage: params.currentUsage,
      limit: params.limit,
    },
  });
}
