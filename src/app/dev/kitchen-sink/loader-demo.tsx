'use client';

import { useState } from 'react';
import { Button } from '@/shared/ui';
import { useLoadingIndicator } from '@/shared/ui/loading-overlay';

/**
 * Drives the real global overlay from the kitchen sink, so the busy state can
 * be looked at without having to catch a genuinely slow request in the act.
 *
 * Goes through `useLoadingIndicator` — the same hook the forty-odd real call
 * sites use — rather than rendering a GlobeLoader directly, so this also
 * exercises the store, the show-delay and the minimum-visible clamp.
 */
export function LoaderDemo() {
  const [busy, setBusy] = useState(false);
  useLoadingIndicator(busy, 'Saving your profile');

  return (
    <Button
      onClick={() => {
        setBusy(true);
        setTimeout(() => setBusy(false), 6000);
      }}
      disabled={busy}
    >
      Show the loading overlay for 6s
    </Button>
  );
}
