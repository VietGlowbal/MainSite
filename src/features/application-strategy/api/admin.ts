import { createAdminClient } from '@/server/db';

/**
 * The service-role client, reached through the feature's repository slice.
 *
 * WHY THIS ONE-LINE FILE EXISTS. eslint forbids a route from importing
 * `@/server/db` directly — pages and routes go through a feature's own `api`
 * slice — and that rule is worth keeping rather than suppressing: it stops fourteen
 * route handlers from each building their own client and reasoning about RLS
 * independently.
 *
 * WHY THE ADMIN CLIENT IS NEEDED AT ALL. Exactly one operation in this feature
 * escapes RLS: `assembleStrategyContext` downloads an uploaded document from
 * storage and caches the extracted text back to `uploaded_documents.parsed_text`.
 * Storage reads are not covered by a table policy, so this is the narrow, named
 * exception rather than a general-purpose back door. Nothing else here should use
 * it, and no repository function takes it implicitly — the caller passes it, so
 * the grant is visible at the call site.
 */
export function strategyAdminClient() {
  return createAdminClient();
}
