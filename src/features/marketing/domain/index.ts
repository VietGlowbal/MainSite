/**
 * marketing/domain — pure data and helpers behind the public-facing pages.
 * No React, no data fetching: anything here must be safe to import from a
 * server component and a client component alike.
 */
export {
  destinationLabel,
  flattenGuide,
  guideArea,
  GUIDE_STEP_COUNT,
  STRATEGY_GUIDE,
  stepIndexForPath,
} from './strategy-guide';
export type { FlatGuideStep, GuideArea, GuideStep } from './strategy-guide';
