import { NextResponse } from 'next/server';

/**
 * The failure responses every Feature 2 route shares.
 *
 * WHY SHARED. Fourteen routes can fail in the same four ways: the tables are not
 * there yet, the model provider is down, the model returned nonsense, or something
 * unexpected broke. Written per route, the copy diverges and at least one route
 * ends up returning a raw provider message — which is unactionable for the
 * student and occasionally leaks internals.
 */

/**
 * A missing table becomes an actionable message rather than a generic 500.
 *
 * Migrations here are applied by hand in the Supabase SQL editor, so "relation
 * does not exist" is a genuinely likely first-run state. Reporting it as a 500
 * sends the next person to debug the route instead of to run the file.
 */
export function migrationAwareError(err: unknown, fallback: string): NextResponse {
  const message = err instanceof Error ? err.message : String(err);
  console.error('[strategy]', message);

  if (/does not exist|relation .* does not exist|42P01|42703/i.test(message)) {
    return NextResponse.json(
      {
        error:
          'Application Strategy needs a one-time database update. Run supabase-application-strategy.sql in the Supabase SQL editor, then try again.',
        code: 'migration_required',
      },
      { status: 503 },
    );
  }

  return NextResponse.json({ error: fallback }, { status: 500 });
}

/** The reason codes `callStrategyModel` returns. */
export type AiFailureReason = 'not_configured' | 'provider_failed' | 'bad_response';

/**
 * Map a model failure to a response.
 *
 * Three different statuses because the client has to behave differently for each:
 * a missing key is nobody's fault but ours and retrying will never help; a
 * provider failure is worth retrying; a malformed response is worth retrying once.
 * The messages are ours, never the provider's.
 */
export function aiFailureResponse(reason: AiFailureReason): NextResponse {
  if (reason === 'not_configured') {
    return NextResponse.json(
      { error: 'AI features are not configured on this environment.', code: 'not_configured' },
      { status: 501 },
    );
  }
  if (reason === 'provider_failed') {
    return NextResponse.json(
      { error: 'AI provider unavailable. Your work is saved — try again shortly.', code: 'provider_failed' },
      { status: 503 },
    );
  }
  return NextResponse.json(
    { error: 'The analysis came back in an unexpected shape. Please try again.', code: 'bad_response' },
    { status: 502 },
  );
}

export function badRequest(message = 'Invalid request'): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}
