import { describe, expect, it } from 'vitest';
import { plannerMicroStepExecutionPatchSchema } from './planner-micro-step-execution';

describe('plannerMicroStepExecutionPatchSchema', () => {
  it('accepts independently patchable status, date-only deadline, and content value', () => {
    expect(plannerMicroStepExecutionPatchSchema.safeParse({ status: 'completed' }).success).toBe(true);
    expect(plannerMicroStepExecutionPatchSchema.safeParse({ deadline: '2026-10-01' }).success).toBe(true);
    expect(plannerMicroStepExecutionPatchSchema.safeParse({ deadline: null }).success).toBe(true);
    expect(plannerMicroStepExecutionPatchSchema.safeParse({ contentValue: { type: 'checklist', checkedItems: ['Upload'] } }).success).toBe(true);
  });

  it('rejects invalid execution values and Core 3 planning fields', () => {
    expect(plannerMicroStepExecutionPatchSchema.safeParse({ status: 'waiting' }).success).toBe(false);
    expect(plannerMicroStepExecutionPatchSchema.safeParse({ deadline: '2026-02-30' }).success).toBe(false);
    // A native date input reports the first digit of a hand-typed year as
    // year 2, in otherwise perfect YYYY-MM-DD. The window is what rejects it.
    expect(plannerMicroStepExecutionPatchSchema.safeParse({ deadline: '0002-03-03' }).success).toBe(false);
    expect(plannerMicroStepExecutionPatchSchema.safeParse({ deadline: '1998-03-03' }).success).toBe(false);
    expect(plannerMicroStepExecutionPatchSchema.safeParse({ title: 'Overwrite Core 3' }).success).toBe(false);
    expect(plannerMicroStepExecutionPatchSchema.safeParse({}).success).toBe(false);
  });
});
