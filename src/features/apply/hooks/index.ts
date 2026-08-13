/**
 * apply — client state.
 *
 * Per-concern hooks. Prefer several small hooks over one context exposing a
 * dozen unrelated fields, so a component re-renders only for the slice it uses.
 */
export { useParseRefresh } from './use-parse-refresh';
export { useHashScrollTarget } from './use-hash-scroll-target';

/**
 * Document upload now lives in `src/shared/hooks`, re-exported here.
 *
 * WHY IT MOVED. The Application Strategy CV import needs it, and eslint forbids
 * one feature importing another — correctly, because the alternative is a web of
 * feature-to-feature dependencies that nobody can untangle later. The rule's own
 * instruction is to lift shared code into `src/shared`, so it was lifted.
 *
 * WHY THE RE-EXPORT STAYS. Three callers in `src/app` import it from here and
 * there is no behavioural reason to touch them. New callers should import from
 * `@/shared/hooks` directly.
 */
export {
  ACCEPTED_DOCUMENT_TYPES,
  MAX_UPLOAD_BYTES,
  useDocumentUpload,
} from '@/shared/hooks';
export type { DocumentKind, UploadItem } from '@/shared/hooks';
