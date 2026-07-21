/**
 * Database clients. The only place in the codebase that constructs a Supabase
 * client. Reachable from src/server, route handlers, and feature repositories —
 * never directly from a page or component (enforced by eslint.config.mjs).
 */
export { createClient } from './server';
export { createAdminClient } from './admin';
