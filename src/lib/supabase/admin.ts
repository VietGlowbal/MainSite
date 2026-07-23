/**
 * @deprecated Moved to `@/server/db/admin`.
 *
 * Kept as a re-export so the existing importers keep compiling unchanged.
 * This client uses the service-role key and therefore BYPASSES row-level
 * security — it belongs in `src/server`, a route handler, or a repository,
 * never in a page or component. The five page components that still use it are
 * frozen in the ADMIN_CLIENT_DEBT list in eslint.config.mjs; that list may
 * shrink but never grow.
 */
export { createAdminClient } from '@/server/db/admin';
