import { describe, expect, it } from 'vitest';
import { verifiedApplicationId } from './verified-application-id';

function buildSupabase(options: { owned?: boolean } = {}) {
  const owned = options.owned ?? true;
  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: async () => ({ data: owned ? { id: 'app-1' } : null, error: null }),
  };
  return { from: () => builder };
}

describe('verifiedApplicationId', () => {
  it('returns undefined when no applicationId is given, without querying anything', async () => {
    let queried = false;
    const supabase = { from: () => ((queried = true), buildSupabase().from()) };
    const result = await verifiedApplicationId(supabase as never, 'user-1', undefined);
    expect(result).toBeUndefined();
    expect(queried).toBe(false);
  });

  it('returns the applicationId when the user owns it', async () => {
    const supabase = buildSupabase({ owned: true });
    const result = await verifiedApplicationId(supabase as never, 'user-1', 'app-1');
    expect(result).toBe('app-1');
  });

  it('returns undefined for an applicationId the user does not own', async () => {
    const supabase = buildSupabase({ owned: false });
    const result = await verifiedApplicationId(supabase as never, 'user-1', 'not-mine');
    expect(result).toBeUndefined();
  });
});
