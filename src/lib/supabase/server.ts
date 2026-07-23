/**
 * @deprecated Moved to `@/server/db/server`.
 *
 * Kept as a re-export so the ~88 existing importers keep compiling unchanged.
 * Do not add new importers: data access should go through a feature repository
 * under `src/features/<domain>/api`, which is the only layer allowed to talk to
 * the database. See eslint.config.mjs for the enforced boundaries.
 */
export { createClient } from '@/server/db/server';
