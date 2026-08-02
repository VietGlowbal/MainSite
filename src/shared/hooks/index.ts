/**
 * shared — client hooks.
 *
 * A leaf, like `shared/ui`: nothing here may import from `features`, `app` or
 * `server`. A hook earns a place here by being needed by more than one feature;
 * anything used by exactly one belongs in that feature's own `hooks` slice.
 */
export {
  ACCEPTED_DOCUMENT_TYPES,
  MAX_UPLOAD_BYTES,
  useDocumentUpload,
} from './use-document-upload';
export type { DocumentKind, UploadItem } from './use-document-upload';
