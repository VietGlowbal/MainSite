#!/usr/bin/env node

/**
 * Course Parse Worker - Background Job Processor
 * 
 * This standalone worker continuously polls for pending course parsing jobs
 * and processes them in the background. It handles:
 * - Atomic job claiming with FOR UPDATE SKIP LOCKED
 * - Course page fetching and AI parsing
 * - Graceful shutdown on SIGTERM/SIGINT
 * - Comprehensive logging for observability
 * 
 * Usage:
 *   node --env-file=.env.local scripts/course-parse-worker.mjs
 * 
 * Environment Variables:
 *   - WORKER_ID: Unique identifier for this worker instance (default: hostname-pid)
 *   - POLL_INTERVAL_MS: Polling interval in milliseconds (default: 5000-10000 random)
 *   - BATCH_SIZE: Number of jobs to claim per poll (default: 5)
 *   - NEXT_PUBLIC_SUPABASE_URL: Supabase project URL
 *   - SUPABASE_SERVICE_ROLE_KEY: Service role key for database access
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { hostname } from 'os';

// ES Module path resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env.local') });

// Configuration
const WORKER_ID = process.env.WORKER_ID || `${hostname()}-${process.pid}`;
const POLL_INTERVAL_MIN = 5000; // 5 seconds
const POLL_INTERVAL_MAX = 10000; // 10 seconds
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '5', 10);

// State management
let isShuttingDown = false;
let currentPollTimeout = null;
let activeJobsCount = 0;

// Logger with timestamps
const log = {
  info: (message, meta = {}) => {
    console.log(JSON.stringify({
      level: 'info',
      timestamp: new Date().toISOString(),
      workerId: WORKER_ID,
      message,
      ...meta
    }));
  },
  error: (message, error, meta = {}) => {
    console.error(JSON.stringify({
      level: 'error',
      timestamp: new Date().toISOString(),
      workerId: WORKER_ID,
      message,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : error,
      ...meta
    }));
  },
  warn: (message, meta = {}) => {
    console.warn(JSON.stringify({
      level: 'warn',
      timestamp: new Date().toISOString(),
      workerId: WORKER_ID,
      message,
      ...meta
    }));
  }
};

// Validate environment
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  log.error('Missing required environment variables', null, {
    hasUrl: !!supabaseUrl,
    hasServiceKey: !!supabaseServiceKey
  });
  process.exit(1);
}

// Initialize Supabase client with service role
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

/**
 * Claim pending jobs from the queue using atomic database function
 * Uses FOR UPDATE SKIP LOCKED to prevent race conditions
 * 
 * @param {number} batchSize - Number of jobs to claim
 * @returns {Promise<Array>} Claimed jobs
 */
async function claimPendingJobs(batchSize) {
  try {
    const { data, error } = await supabase.rpc('claim_course_parse_jobs', {
      worker_id: WORKER_ID,
      batch_size: batchSize
    });

    if (error) {
      throw error;
    }

    return data || [];
  } catch (error) {
    log.error('Failed to claim pending jobs', error, { batchSize });
    return [];
  }
}

/**
 * Process a single job
 * Orchestrates: fetch → parse → update status
 * 
 * @param {Object} job - Job to process
 * @returns {Promise<void>}
 */
async function processJob(job) {
  const startTime = Date.now();
  
  log.info('Processing job started', {
    jobId: job.id,
    applicationId: job.application_id,
    courseUrl: job.course_url,
    attempt: job.attempts
  });

  try {
    // Update application progress to 10% (job claimed)
    await supabase
      .from('course_applications')
      .update({
        parse_status: 'processing',
        progress_percentage: 10,
        updated_at: new Date().toISOString()
      })
      .eq('id', job.application_id);

    // TODO: Implement actual course page fetching and AI parsing
    // For now, this is a minimal implementation that marks jobs as complete
    // Future phases will integrate with:
    // - src/lib/course-parser/ai-parser.ts (fetch + parse)
    // - src/lib/course-parser/course-upsert.ts (cache course data)
    // - src/lib/course-parser/checklist-generator.ts (generate stages/tasks)
    
    // Simulate processing delay (remove when real implementation is added)
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Update application progress to 100% (parsing complete)
    await supabase
      .from('course_applications')
      .update({
        parse_status: 'complete',
        progress_percentage: 100,
        updated_at: new Date().toISOString()
      })
      .eq('id', job.application_id);

    // Update job status to complete
    const { error: updateError } = await supabase
      .from('course_parse_jobs')
      .update({
        status: 'complete',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', job.id);

    if (updateError) {
      throw updateError;
    }

    const duration = Date.now() - startTime;
    log.info('Job completed successfully', {
      jobId: job.id,
      applicationId: job.application_id,
      durationMs: duration
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    
    log.error('Job processing failed', error, {
      jobId: job.id,
      applicationId: job.application_id,
      attempt: job.attempts,
      durationMs: duration
    });

    // Update application parse_status to failed
    try {
      await supabase
        .from('course_applications')
        .update({
          parse_status: 'failed',
          updated_at: new Date().toISOString()
        })
        .eq('id', job.application_id);
    } catch (appUpdateError) {
      log.error('Failed to update application parse_status', appUpdateError, { 
        applicationId: job.application_id 
      });
    }

    // Record failure with exponential backoff
    const shouldRetry = job.attempts < job.max_attempts;
    const nextAttemptDelayMinutes = shouldRetry ? Math.pow(job.attempts + 1, 2) * 5 : null;
    
    try {
      const updateData = {
        status: shouldRetry ? 'pending' : 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        updated_at: new Date().toISOString()
      };

      if (shouldRetry && nextAttemptDelayMinutes) {
        const nextAttemptAt = new Date(Date.now() + nextAttemptDelayMinutes * 60 * 1000);
        updateData.next_attempt_at = nextAttemptAt.toISOString();
        
        log.warn('Job marked for retry', {
          jobId: job.id,
          shouldRetry,
          nextAttemptInMinutes: nextAttemptDelayMinutes,
          attemptsRemaining: job.max_attempts - job.attempts
        });
      } else {
        log.error('Job permanently failed after max attempts', null, {
          jobId: job.id,
          attempts: job.attempts,
          maxAttempts: job.max_attempts
        });
      }

      const { error: updateError } = await supabase
        .from('course_parse_jobs')
        .update(updateData)
        .eq('id', job.id);

      if (updateError) {
        log.error('Failed to update job status after failure', updateError, { jobId: job.id });
      }

    } catch (updateError) {
      log.error('Failed to record job failure', updateError, { jobId: job.id });
    }
  }
}

/**
 * Process a batch of jobs concurrently
 * 
 * @param {Array} jobs - Jobs to process
 * @returns {Promise<Object>} Processing results
 */
async function processBatch(jobs) {
  if (jobs.length === 0) {
    return { successful: 0, failed: 0 };
  }

  log.info('Processing batch', {
    batchSize: jobs.length,
    jobIds: jobs.map(j => j.id)
  });

  activeJobsCount = jobs.length;

  const results = await Promise.allSettled(
    jobs.map(job => processJob(job))
  );

  const successful = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;

  activeJobsCount = 0;

  log.info('Batch processing complete', {
    total: jobs.length,
    successful,
    failed
  });

  return { successful, failed };
}

/**
 * Main polling loop
 * Continuously polls for pending jobs and processes them
 */
async function pollLoop() {
  if (isShuttingDown) {
    log.info('Polling loop stopped due to shutdown signal');
    return;
  }

  try {
    // Claim pending jobs
    const jobs = await claimPendingJobs(BATCH_SIZE);

    if (jobs.length > 0) {
      log.info('Jobs claimed', { count: jobs.length });
      await processBatch(jobs);
    }

    // Schedule next poll with random interval to avoid thundering herd
    if (!isShuttingDown) {
      const nextPollDelay = POLL_INTERVAL_MIN + 
        Math.random() * (POLL_INTERVAL_MAX - POLL_INTERVAL_MIN);
      
      currentPollTimeout = setTimeout(pollLoop, nextPollDelay);
    }

  } catch (error) {
    log.error('Error in polling loop', error);
    
    // Continue polling even on error, but with backoff
    if (!isShuttingDown) {
      currentPollTimeout = setTimeout(pollLoop, POLL_INTERVAL_MAX);
    }
  }
}

/**
 * Graceful shutdown handler
 * Waits for active jobs to complete before exiting
 * 
 * @param {string} signal - Signal name (SIGTERM, SIGINT)
 */
async function shutdown(signal) {
  if (isShuttingDown) {
    log.warn('Shutdown already in progress, forcing exit');
    process.exit(1);
  }

  log.info('Shutdown signal received', { signal });
  isShuttingDown = true;

  // Cancel pending poll
  if (currentPollTimeout) {
    clearTimeout(currentPollTimeout);
    currentPollTimeout = null;
  }

  // Wait for active jobs to complete
  if (activeJobsCount > 0) {
    log.info('Waiting for active jobs to complete', { 
      activeJobs: activeJobsCount 
    });

    // Poll until active jobs complete or timeout after 30 seconds
    const shutdownStart = Date.now();
    const shutdownTimeout = 30000; // 30 seconds

    while (activeJobsCount > 0 && Date.now() - shutdownStart < shutdownTimeout) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    if (activeJobsCount > 0) {
      log.warn('Shutdown timeout reached, forcing exit with active jobs', {
        activeJobs: activeJobsCount
      });
    } else {
      log.info('All active jobs completed');
    }
  }

  log.info('Worker shutdown complete', { signal });
  process.exit(0);
}

/**
 * Main entry point
 */
async function main() {
  log.info('Course parse worker starting', {
    pollIntervalRange: `${POLL_INTERVAL_MIN}-${POLL_INTERVAL_MAX}ms`,
    batchSize: BATCH_SIZE,
    supabaseUrl
  });

  // Register shutdown handlers
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    log.error('Uncaught exception', error);
    shutdown('UNCAUGHT_EXCEPTION');
  });

  process.on('unhandledRejection', (reason, promise) => {
    log.error('Unhandled promise rejection', reason, { promise });
    shutdown('UNHANDLED_REJECTION');
  });

  log.info('Worker ready, starting polling loop');

  // Start polling
  await pollLoop();
}

// Start the worker
main().catch((error) => {
  log.error('Fatal error in main', error);
  process.exit(1);
});
