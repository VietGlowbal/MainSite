import './server-only-guard';
import { createClient } from '@supabase/supabase-js';

/** CI's placeholder build config must not attempt a network request. */
export function isPlaceholderSupabaseConfig(): boolean {
  return process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() === 'https://placeholder.supabase.co';
}

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
