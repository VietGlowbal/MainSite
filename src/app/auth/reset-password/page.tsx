import { Suspense } from 'react';
import { ResetPasswordForm } from './reset-password-form';

/**
 * /auth/reset-password — the destination of the link in the reset email.
 *
 * Shares the centring shell of /auth deliberately: this is the same card in the
 * same flow, and there is no Figma frame for it to diverge from
 * (`docs/known-issues.md §0i`). It inherits `robots: PRIVATE_ROBOTS` from
 * `src/app/auth/layout.tsx`, which matters here — the URL carries a recovery
 * token and must never be indexed.
 */
function FormFallback() {
  return (
    <div className="w-full animate-pulse space-y-gb-xl" aria-hidden>
      <div className="mx-auto h-gb-2xl w-40 rounded-gb-md bg-surface-muted" />
      <div className="h-gb-6xl rounded-gb-md bg-surface-muted" />
      <div className="h-gb-6xl rounded-gb-md bg-surface-muted" />
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="gb-page-full-bleed flex min-h-screen flex-col bg-surface">
      <main className="flex flex-1 items-center justify-center px-gb-xl py-gb-6xl">
        <div className="w-full max-w-[400px]">
          <Suspense fallback={<FormFallback />}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
