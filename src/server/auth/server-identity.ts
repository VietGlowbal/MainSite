import { cache } from 'react';
import { createClient } from '@/server/db/server';

export type ServerIdentity = {
  id: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  userMetadata: Record<string, unknown>;
};

export function identityFromClaims(claims: Record<string, unknown>): ServerIdentity | null {
  if (typeof claims.sub !== 'string' || !claims.sub) return null;
  const email = typeof claims.email === 'string' ? claims.email : null;
  const userMetadata =
    claims.user_metadata && typeof claims.user_metadata === 'object' && !Array.isArray(claims.user_metadata)
      ? (claims.user_metadata as Record<string, unknown>)
      : {};
  const metadataName =
    typeof userMetadata.full_name === 'string'
      ? userMetadata.full_name
      : typeof userMetadata.name === 'string'
        ? userMetadata.name
        : null;

  return {
    id: claims.sub,
    email,
    name: metadataName || email?.split('@')[0] || null,
    avatarUrl: typeof userMetadata.avatar_url === 'string' ? userMetadata.avatar_url : null,
    userMetadata,
  };
}

export const getServerIdentity = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const identity = error || !data?.claims
    ? null
    : identityFromClaims(data.claims as unknown as Record<string, unknown>);
  return { supabase, identity };
});
