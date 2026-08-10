export type {
  Application,
  ConfidenceLevel,
  DemoState,
  Phase,
  PhaseStatus,
  ReflectionAnswers,
  Task,
  TaskStatus,
  TaskType,
  UpNextCopy,
} from './types';
export { DEMO_STATES, isDemoState } from './types';
export {
  DEMO_REFLECTION_ANSWERS,
  DEMO_STUDENT_NAME,
  alertsForState,
  baseProgressForState,
  buildApplication,
  buildApplicationShapes,
  daysLeftForState,
  deriveStatuses,
  findCurrentTaskId,
} from './data';
export type { PhaseShape, TaskShape } from './data';
export * from './copy';
export * from './content';
