/**
 * apply — presentation.
 *
 * Components receive data via props or via hooks from ../hooks. They must never
 * import ../api (enforced by eslint.config.mjs).
 */
export { EvidenceExtractionPreview } from './evidence-extraction-preview';
export { ReflectionSection, ReflectionShell } from './reflection-shell';
export {
  DisplayModeToggle,
  QuestionCard,
  QuestionTracker,
  SaveIndicator,
  questionIcon,
} from './question-chrome';
export { NotSureNote, OptionCards, SelectionCard } from './option-cards';
export { NationalityPicker } from './nationality-picker';
export { EnglishQuestion, GpaQuestion } from './score-input';
export { IntakePicker } from './intake-picker';
export { SearchableMultiSelectGrid } from './searchable-grid';
export type { GridItem } from './searchable-grid';
export { PersonalReportView } from './personal-report-view';
export { MatchingReportView } from './matching-report-view';
export { ResearchProgress, ResearchingInline } from './research-progress';
