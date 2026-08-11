'use client';

import type { ReflectionAnswers, Task } from '../domain';
import { ActionListWorkspace } from './action-list-workspace';
import { AchievementWorkspace } from './achievement-workspace';
import { CvWorkspace } from './cv-workspace';
import { DocumentReviewWorkspace } from './document-review-workspace';
import { MatchWorkspace } from './match-workspace';
import { ProfileConfirmWorkspace } from './profile-confirm-workspace';
import { ReadinessWorkspace } from './readiness-workspace';
import { ReflectionWorkspace } from './reflection-workspace';
import { RecommendationWorkspace } from './recommendation-workspace';
import { ReportWorkspace } from './report-workspace';
import { ScholarshipWorkspace } from './scholarship-workspace';
import { StatementWorkspace } from './statement-workspace';
import { StrategyWorkspace } from './strategy-workspace';

const EVIDENCE_FOCUS_BY_TASK: Record<string, 'engineering' | 'leadership' | 'wording' | 'gaps'> = {
  'p3-evidence-engineering': 'engineering',
  'p3-evidence-leadership': 'leadership',
  'p3-evidence-wording': 'wording',
  'p3-gaps': 'gaps',
};

const READINESS_CHECKLIST_BY_TASK: Record<string, 'requirements' | 'completeness' | 'consistency' | 'final'> = {
  'p5-requirements': 'requirements',
  'p5-completeness': 'completeness',
  'p5-consistency': 'consistency',
  'p5-readiness': 'final',
};

/** The GenUI-style task renderer: dispatches on `task.type` (spec §12, §23). */
export function TaskWorkspace({
  task,
  onBack,
  onCompleteReflection,
  onCompleteTask,
  onSelectTask,
}: {
  task: Task;
  onBack: () => void;
  onCompleteReflection: (answers: ReflectionAnswers) => void;
  onCompleteTask: (taskId: string) => void;
  onSelectTask: (taskId: string) => void;
}) {
  const onComplete = () => onCompleteTask(task.id);

  switch (task.type) {
    case 'reflection':
      return <ReflectionWorkspace onBack={onBack} onComplete={onCompleteReflection} />;
    case 'achievement':
      return <AchievementWorkspace onBack={onBack} onComplete={onComplete} />;
    case 'personal-report':
      return <ReportWorkspace reviewOnly={task.id === 'p2-review-personal-report'} onBack={onBack} onComplete={onComplete} />;
    case 'matching-report':
      return (
        <MatchWorkspace
          reviewOnly={task.id === 'p2-review-matching-report'}
          onBack={onBack}
          onComplete={onComplete}
          onBuildStrategy={() => onSelectTask('p2-strategy')}
        />
      );
    case 'strategy':
      return <StrategyWorkspace choosingPriorities={task.id === 'p2-choose-priorities'} onBack={onBack} onComplete={onComplete} />;
    case 'evidence-builder':
      return <ActionListWorkspace focus={EVIDENCE_FOCUS_BY_TASK[task.id] ?? 'engineering'} onBack={onBack} onComplete={onComplete} />;
    case 'scholarship':
      return <ScholarshipWorkspace onBack={onBack} onComplete={onComplete} />;
    case 'cv':
      return <CvWorkspace onBack={onBack} onComplete={onComplete} />;
    case 'personal-statement':
      return <StatementWorkspace onBack={onBack} onComplete={onComplete} />;
    case 'recommendation':
      return <RecommendationWorkspace onBack={onBack} onComplete={onComplete} />;
    case 'document-review':
      return <DocumentReviewWorkspace onBack={onBack} onComplete={onComplete} />;
    case 'readiness-review':
      return <ReadinessWorkspace checklist={READINESS_CHECKLIST_BY_TASK[task.id] ?? 'final'} onBack={onBack} onComplete={onComplete} />;
    case 'profile-confirm':
      return <ProfileConfirmWorkspace onBack={onBack} />;
    default:
      return null;
  }
}
