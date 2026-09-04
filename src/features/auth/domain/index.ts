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
  isRealCalendarDate,
  MAX_AGE,
  MIN_AGE,
  NAME_MAX,
  normalizePhone,
  safeInternalPath,
  validateContactDetails,
} from './contact-details';
export type {
  ContactDetailsErrors,
  ContactDetailsInput,
  ContactDetailsRow,
} from './contact-details';
export {
  countBreaches,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  splitHashForRange,
  validatePassword,
} from './password';
export type { PasswordProblem } from './password';
export {
  AUTH_ERROR_MESSAGES,
  authErrorBody,
  authErrorFromResponse,
  authErrorText,
  formatAuthError,
  isAuthErrorCode,
} from './errors';
export type { AuthErrorBody, AuthErrorCode, AuthErrorState, AuthErrorVars } from './errors';
