/**
 * apply — client state.
 *
 * Per-concern hooks. Prefer several small hooks over one context exposing a
 * dozen unrelated fields, so a component re-renders only for the slice it uses.
 */
export { anyParsePending, useParseRefresh } from './use-parse-refresh';
