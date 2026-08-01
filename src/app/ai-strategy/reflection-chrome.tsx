import type { User } from '@supabase/supabase-js';
import { StrategyChrome } from './strategy-chrome';

/**
 * The header/footer wrapper both reflection steps share.
 *
 * `/ai-strategy/*` is suppressed in nav-reveal, so these pages carry their own
 * chrome — the same arrangement as /apply and /universities.
 *
 * This is now a thin alias over `StrategyChrome`, which the Application Strategy
 * pages also use. It was extracted when the second set of pages arrived: the
 * reason the chrome was pulled out of the two reflection steps in the first
 * place was that two copies drift, and adding a third copy for the strategy
 * subtree would have reintroduced exactly that. Kept as a named component rather
 * than deleted so the reflection pages read as before and the width they were
 * designed at stays pinned here.
 */
export function ReflectionChrome({
  user,
  children,
}: {
  user: User | null;
  children: React.ReactNode;
}) {
  return (
    <StrategyChrome user={user} containerWidth="narrow">
      {children}
    </StrategyChrome>
  );
}
