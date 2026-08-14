/**
 * apply — presentation.
 *
 * Components receive data via props or via hooks from ../hooks. They must never
 * import ../api (enforced by eslint.config.mjs).
 */
export { ReflectionSection, ReflectionShell } from './reflection-shell';
export {
  DisplayModeToggle,
  QuestionCard,
  QuestionTracker,
  SaveIndicator,
  questionIcon,
} from './question-chrome';
export { NotSureNote, OptionCards, SelectionCard } from './option-cards';
export { AspirationQuestion, SubjectMotivationQuestion } from './written-answer';
export { BudgetQuestion } from './budget-question';
export { NationalityPicker } from './nationality-picker';
export { EnglishQuestion, GpaQuestion } from './score-input';
export { IntakePicker } from './intake-picker';
export { localizeIntakeCopy, localizeIntakeOption } from './intake-copy';
export { SearchableMultiSelectGrid } from './searchable-grid';
export type { GridItem } from './searchable-grid';
export { PersonalReportV2View } from './personal-report-v2-view';
export { MatchingReportView } from './matching-report-view';
export { ResearchProgress, ResearchingInline } from './research-progress';
export { AchievementCard, ActivityCard } from './achievement-cards';
export type { AchievementCardValue, ActivityCardValue } from './achievement-cards';
export {
  EvidenceEmptyState,
  EvidenceGrid,
  EvidenceSortSelect,
  EvidenceTabs,
} from './evidence-grid';
export type { EvidenceSort, EvidenceTabKey } from './evidence-grid';
export { DocumentPanel } from './document-panel';
export type { ProcessingState } from './document-panel';
export { DocumentPreviewDrawer } from './document-preview-drawer';
export { EditEvidenceModal } from './edit-evidence-modal';
export type { EvidenceDraft } from './edit-evidence-modal';
export { AddTypeChooser, RemoveConfirmDialog } from './evidence-dialogs';
export { ReviewFlowDrawer } from './review-flow';
export { DuplicatePrompt } from './duplicate-prompt';
