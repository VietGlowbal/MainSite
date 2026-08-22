import { z } from 'zod';
import { PROGRESS_STATUS, isPlannerDeadline, type ProgressStatus } from './recommendation';
import { contentValueSchema } from './recommendation';

/** The only student-writable state on a canonical Micro-step. */
export const plannerMicroStepExecutionPatchSchema = z
  .object({
    status: z.enum(PROGRESS_STATUS).optional(),
    deadline: z.string().nullable().optional(),
    contentValue: contentValueSchema.nullable().optional(),
  })
  .superRefine((value, context) => {
    if (value.deadline !== undefined && value.deadline !== null && !isPlannerDeadline(value.deadline)) {
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
  planningInputChanged?: boolean;
};
