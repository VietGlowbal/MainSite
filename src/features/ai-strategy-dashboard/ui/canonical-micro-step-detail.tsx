'use client';

import Link from 'next/link';
import { getPlannerMicroSteps, PROGRESS_STATUS, PROGRESS_STATUS_LABEL, type PlannerReadModel } from '../domain';
import { ContentBlockInput } from './content-block';
import { DeadlineControl } from './planner-shared';
import { PlannerFeedback } from './planner-feedback';
import { useApplicationPlanner } from './use-application-planner';
import { Container, Panel } from '@/shared/ui';

export function CanonicalMicroStepDetail({ applicationId, planner, microStepId }: { applicationId: string; planner: PlannerReadModel; microStepId: string }) {
  const controller = useApplicationPlanner(applicationId, planner);
  const task = getPlannerMicroSteps(controller.planner).find((item) => item.id === microStepId);
  if (!task) return null;
  return <Container className="max-w-3xl py-gb-7xl"><div className="flex flex-col gap-gb-3xl"><Link href={`/ai-strategy/${applicationId}/planner`} className="self-start text-gb-sm font-semibold text-fg-brand hover:underline">← Back to planner</Link><div><p className="text-gb-sm text-fg-tertiary">{task.phaseTitle} · {task.stepTitle}</p><h1 className="mt-gb-xs font-display text-gb-display-sm font-semibold text-fg">{task.title}</h1></div>{controller.error ? <p role="alert" className="text-gb-sm text-fg-error">{controller.error}</p> : null}<Panel><div className="flex flex-wrap gap-gb-lg"><label className="flex flex-col gap-gb-xs text-gb-sm font-semibold text-fg">Status<select aria-label={`Status for ${task.title}`} value={task.status} onChange={(event) => void controller.updateMicroStepStatus(task.id, event.target.value as typeof task.status)} className="rounded-gb-lg border border-line bg-surface px-gb-lg py-gb-sm">{PROGRESS_STATUS.map((status) => <option key={status} value={status}>{PROGRESS_STATUS_LABEL[status]}</option>)}</select></label><DeadlineControl deadline={task.deadline} label={`Deadline for ${task.title}`} onChange={(deadline) => controller.updateMicroStepDeadline(task.id, deadline)} /></div></Panel>{task.contentSchema ? <Panel><p className="mb-gb-lg text-gb-sm font-semibold text-fg">Task content</p><ContentBlockInput applicationId={applicationId} recommendationId={task.id} schema={task.contentSchema} value={task.contentValue} onSave={(contentValue) => controller.updateMicroStepContent(task.id, contentValue)} /></Panel> : null}<Panel><p className="text-gb-sm font-semibold text-fg">Supporting evidence</p><p className="mt-gb-xs text-gb-sm text-fg-tertiary">{task.executionEvidence.length > 0 ? `${task.executionEvidence.length} evidence item${task.executionEvidence.length === 1 ? '' : 's'} recorded.` : 'Evidence upload is not available for canonical micro-steps yet.'}</p><PlannerFeedback applicationId={applicationId} targetType="micro_step" targetId={task.id} /></Panel></div></Container>;
}
