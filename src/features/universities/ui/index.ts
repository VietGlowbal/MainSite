/**
 * universities — presentation.
 *
 * Components receive data via props or via hooks from ../hooks. They must never
 * import ../api (enforced by eslint.config.mjs).
 */
export {
  UniversityExplorerProvider,
  useExplorer,
  filterUniversities,
  type ApplicationEntry,
  type ExplorerActions,
  type ExplorerState,
  type ExplorerUniversity,
} from './explorer-context';
export { UniversityMatchResults } from './university-match-results';
