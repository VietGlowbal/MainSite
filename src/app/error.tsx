'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App error:', error);
  }, [error]);

  return (
    <main className="min-h-screen bg-transparent px-6 py-16 md:px-10">
      <div className="mx-auto max-w-lg">
        <div className="glow-card text-center space-y-5 py-12">
          <div className="text-5xl">💫</div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Something went off-orbit</h1>
            <p className="mt-2 text-sm text-slate-500 leading-relaxed">
              An unexpected error happened on this page. Try again, and if the issue persists, head back to the home page.
            </p>
          </div>
          {error.digest && (
            <p className="text-xs text-slate-400 font-mono">Error ID: {error.digest}</p>
          )}
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={reset}
              className="glow-button-primary text-sm px-5 py-2.5"
            >
              Try again
            </button>
            <Link
              href="/"
              className="glow-button-secondary text-sm px-5 py-2.5"
            >
              Back home
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
