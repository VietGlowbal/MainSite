import { vi } from 'vitest';

/**
 * Shared test helpers for the add-courses route tests.
 *
 * The completed route (Tasks 13.1–13.9) runs a full pipeline:
 *   idempotency lookup -> session verification -> fetch results ->
 *   duplicate detection -> URL validation -> entitlement check ->
 *   atomic RPC create -> idempotency store -> usage refresh
 *
 * These helpers build a Supabase mock that satisfies every table/RPC the
 * route touches so individual tests only need to specify the data they care
 * about.
 */

interface ChainConfig {
  listData?: unknown;
  listError?: unknown;
  singleData?: unknown;
  singleError?: unknown;
}

/**
 * Build a chainable query-builder mock. Every filter method (select/eq/in/...)
 * returns the same object so calls can be chained in any order. The object is
 * thenable, so awaiting a terminal filter resolves to the list result, while
 * `.single()` resolves to the single result.
 */
export function makeChain(config: ChainConfig = {}) {
  const {
    listData = null,
    listError = null,
    singleData = null,
    singleError = null,
  } = config;

  const obj: Record<string, unknown> = {};
  const chainMethods = ['select', 'eq', 'in', 'neq', 'gte', 'lte', 'order', 'limit', 'match'];
  for (const method of chainMethods) {
    obj[method] = vi.fn(() => obj);
  }
  obj.single = vi.fn(() => Promise.resolve({ data: singleData, error: singleError }));
  obj.maybeSingle = vi.fn(() => Promise.resolve({ data: singleData, error: singleError }));
  obj.upsert = vi.fn(() => Promise.resolve({ error: null }));
  obj.insert = vi.fn(() => Promise.resolve({ data: null, error: null }));
  obj.update = vi.fn(() => obj);
  // Thenable: awaiting a terminal filter resolves to the list result.
  obj.then = (resolve: (value: { data: unknown; error: unknown }) => unknown) =>
    resolve({ data: listData, error: listError });
  return obj;
}

export interface SupabaseMockOptions {
  user?: { id: string } | null;
  authError?: unknown;
  session?: unknown;
  sessionError?: unknown;
  results?: unknown[];
  resultsError?: unknown;
  existingApps?: unknown[];
  existingAppsError?: unknown;
  university?: unknown;
  rpcError?: unknown;
  /** Override the RPC response. By default it echoes the payload as created applications. */
  rpcApplications?: unknown;
}

/**
 * Build a complete Supabase client mock for the add-courses route.
 */
export function buildAddCoursesSupabase(options: SupabaseMockOptions = {}) {
  const {
    user = { id: 'user-123' },
    authError = null,
    session,
    sessionError = null,
    results = [],
    resultsError = null,
    existingApps = [],
    existingAppsError = null,
    university = { primary_domain: 'university.edu' },
    rpcError = null,
    rpcApplications,
  } = options;

  const from = vi.fn((table: string) => {
    switch (table) {
      case 'idempotency_keys':
        // Cache miss by default.
        return makeChain({ singleData: null, singleError: { code: 'PGRST116' } });
      case 'course_search_sessions':
        return makeChain({ singleData: session, singleError: sessionError });
      case 'course_search_session_results':
        return makeChain({ listData: results, listError: resultsError });
      case 'course_applications':
        return makeChain({ listData: existingApps, listError: existingAppsError });
      case 'universities':
        return makeChain({ singleData: university });
      default:
        return makeChain({});
    }
  });

  const rpc = vi.fn((_fnName: string, args: { p_results?: Array<Record<string, unknown>> }) => {
    if (rpcError) {
      return Promise.resolve({ data: null, error: rpcError });
    }
    const applications_created =
      rpcApplications !== undefined
        ? rpcApplications
        : (args?.p_results || []).map((r) => ({
            application_id: `app-${r.result_id}`,
            course_name: r.course_name,
            course_url: r.course_url,
            parse_status: 'pending',
          }));
    return Promise.resolve({ data: { applications_created }, error: null });
  });

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error: authError,
      }),
    },
    from,
    rpc,
  };
}

/**
 * Standard entitlement-service mock factory for tests that need the user to be
 * allowed to add courses.
 */
export function allowedEntitlement(overrides: Partial<{
  coursesAdded: number;
  courseAddLimit: number;
  plan: string;
}> = {}) {
  return {
    allowed: true,
    usage: {
      plan: overrides.plan ?? 'free',
      courseSearchLimit: 3,
      courseSearchesUsed: 0,
      courseAddLimit: overrides.courseAddLimit ?? 5,
      coursesAdded: overrides.coursesAdded ?? 0,
    },
  };
}
