/**
 * Public API of the onboarding feature.
 *
 * Everything another slice is allowed to use is re-exported here. Deep imports
 * past this barrel are a lint error — see eslint.config.mjs.
 */
export * from './domain';
export * from './hooks';
export * from './ui';
