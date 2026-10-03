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
export {
  CONSULTATION_PACKAGES,
  consultationNotes,
  dialCodeFor,
  validateConsultation,
} from './consultation';
export type {
  ConsultationFieldErrors,
  ConsultationInput,
  ConsultationPackage,
  ConsultationRequest,
} from './consultation';
export type { GlobeCountry } from './home-globe';
