import { LoadingScreen } from '@/shared/ui';

/**
 * The app-wide loading UI.
 *
 * Because this sits at the root, every segment that does not define its own
 * `loading.tsx` inherits it — which is what makes the globe loader show up on
 * a hard navigation to any route in the app, not just the handful that were
 * given a bespoke skeleton.
 *
 * Segments that *do* define their own (universities, my-universities, profile)
 * keep it: a skeleton shaped like the page it is about to become is better
 * than a centred card, so those show the skeleton with the loader floated over
 * it rather than instead of it.
 */
export default function Loading() {
  return <LoadingScreen />;
}
