import { z } from 'zod';
import { PROGRESS_STATUS, type ProgressStatus } from './recommendation';
import { contentValueSchema } from './recommendation';

/** The only student-writable state on a canonical Micro-step. */
export const plannerMicroStepExecutionPatchSchema = z
  .object({
    status: z.enum(PROGRESS_STATUS).optional(),
    deadline: z.string().nullable().optional(),
    contentValue: contentValueSchema.nullable().optional(),
  })
  .superRefine((value, context) => {
    if (value.deadline !== undefined && value.deadline !== null && !isDateOnly(value.deadline)) {
      context.addIssue({ code: 'custom', path: ['deadline'], message: 'Expected a valid YYYY-MM-DD date' });
    }
    if (value.status === undefined && value.deadline === undefined && value.contentValue === undefined) {
      context.addIssue({ code: 'custom', message: 'Provide a status, deadline, or content value' });
    }
  });

export type PlannerMicroStepExecutionPatch = z.infer<typeof plannerMicroStepExecutionPatchSchema>;

export type PlannerMicroStepExecutionState = {
  id: string;
  status: ProgressStatus;
  deadline: string | null;
  contentValue: z.infer<typeof contentValueSchema> | null;
};

function isDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
