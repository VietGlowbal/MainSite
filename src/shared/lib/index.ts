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
/**
 * The route registry — where things are, read by both the breadcrumbs and the
 * application sub-navigation so the two cannot disagree.
 */
export {
  APPLICATION_LABEL_KEY,
  activeSubNavKey,
  applicationIdFromPath,
  applicationSubNav,
  breadcrumbTrail,
  matchRoute,
  type Crumb,
  type SubNavItem,
} from './app-routes';
