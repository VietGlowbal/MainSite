/**
 * auth — domain logic.
 *
 * Pure functions and types: no I/O, no React, no framework imports. Everything
 * here must be unit-testable without a database or a DOM.
 */
export {
  ageOn,
  contactDetailsComplete,
  hasText,
  MAX_AGE,
  MIN_AGE,
  NAME_MAX,
  normalizePhone,
  validateContactDetails,
} from './contact-details';
export type {
  ContactDetailsErrors,
  ContactDetailsInput,
  ContactDetailsRow,
} from './contact-details';
