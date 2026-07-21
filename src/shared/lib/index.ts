/**
 * Framework-agnostic helpers shared across features (currency, dates, strings).
 * Nothing here may import React, Next, or a database client.
 */
export { TID, testId, type TestId } from './testids';
export {
  clampPage,
  clampPageSize,
  pageOffset,
  toPage,
  type Page,
} from './pagination';
