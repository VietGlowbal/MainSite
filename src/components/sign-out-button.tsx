'use client';

import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useLoadingIndicator } from '@/shared/ui';

type SignOutButtonProps = {
  className?: string;
  containerClassName?: string;
  redirectTo?: string;
  children?: ReactNode;
};

export function SignOutButton({
  className,
  containerClassName,
  redirectTo = '/auth',
  children = 'Sign out',
}: SignOutButtonProps) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  useLoadingIndicator(loading, 'Signing you out');
  const [error, setError] = useState<string | null>(null);

  const handleSignOut = async () => {
    setLoading(true);
    setError(null);

    try {
      const { error: signOutError } = await supabase.auth.signOut({ scope: 'global' });
      if (signOutError) throw signOutError;

      router.replace(redirectTo);
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not sign out';
      setError(message);
      setLoading(false);
      return;
    }

    setLoading(false);
  };

  return (
    <div className={containerClassName ?? 'flex flex-col items-start gap-1'}>
      <button
        type="button"
        onClick={handleSignOut}
        disabled={loading}
        className={className}
        aria-busy={loading}
      >
        {loading ? 'Signing out…' : children}
      </button>
      {error ? <p className="text-xs text-red-500">{error}</p> : null}
    </div>
  );
}
