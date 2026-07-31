/**
 * Backwards-compatible entry point for the existing onboarding route.
 *
 * The implementation now lives in the onboarding feature. Keeping this export
 * avoids breaking any legacy imports while the route migrates to the feature
 * barrel.
 */
export { OnboardingContainer as OnboardingSinglePage } from '@/features/onboarding';
