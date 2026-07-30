import { Suspense } from 'react';
import { AuthForm } from './auth-form';

/**
 * /auth — rebuilt from Figma 105:8004 / 105:8037.
 *
 * A single centered card on a plain surface. The old page paired the form with a
 * 3D globe hero and a feature list behind ~18 legacy `auth-*` classes; the
 * redesign drops all of it, so this shell is just the centering frame and the
 * form owns everything visible.
 *
 * `gb-page-full-bleed` removes the app sidebar gutter and mobile header offset —
 * /auth has no global nav — so the card can truly centre.
 */
function AuthFormFallback() {
  return (
    <div className="w-full animate-pulse space-y-gb-xl" aria-hidden>
      <div className="mx-auto h-gb-2xl w-40 rounded-gb-md bg-surface-muted" />
      <div className="h-gb-6xl rounded-gb-md bg-surface-muted" />
      <div className="h-gb-6xl rounded-gb-md bg-surface-muted" />
      <div className="h-gb-6xl rounded-gb-md bg-surface-muted" />
    </div>
  );
}

export default function AuthPage() {
  return (
    <div className="gb-page-full-bleed flex min-h-screen flex-col bg-surface">
      <main className="flex flex-1 items-center justify-center px-gb-xl py-gb-6xl">
        <div className="w-full max-w-[400px]">
          <Suspense fallback={<AuthFormFallback />}>
            <AuthForm />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
