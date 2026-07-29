import { describe, expect, it } from 'vitest';
import type { ApplicationStage, ApplicationTask, TaskStatus } from '@/lib/apply-types';
import { activeStageIndex, stageProgressLabel, summariseTasks } from './progress';

function task(status: TaskStatus, id = Math.random().toString(36)): ApplicationTask {
  return {
    id,
    applicationId: 'app',
    title: 'A task',
    taskType: 'general',
    status,
    priority: 'medium',
    confidence: 0.7,
    sortOrder: 0,
    createdBy: 'ai',
    createdAt: '',
    updatedAt: '',
  };
}

function stage(
  name: string,
  tasks: ApplicationTask[],
  status: ApplicationStage['status'] = 'not_started',
): ApplicationStage {
  return {
    id: name,
    applicationId: 'app',
    name,
    slug: name.toLowerCase(),
    orderNum: 1,
    status,
    isRequired: true,
    aiGenerated: true,
    confidence: 0.7,
    createdAt: '',
    updatedAt: '',
    tasks,
  };
}

describe('summariseTasks', () => {
  it('never reports a negative count', () => {
    // The live bug: the sidebar hardcoded "in progress" as 1 and derived
    // "not started" as total - completed - 1, so an application with no
    // checklist rendered "Not started -1".
    const counts = summariseTasks([]);
    expect(counts).toEqual({
      completed: 0,
      inProgress: 0,
      notStarted: 0,
      parked: 0,
      total: 0,
      percent: 0,
    });

    for (const value of Object.values(counts)) {
      expect(value).toBeGreaterThanOrEqual(0);
    }
  });

  it('does not invent an in-progress task', () => {
    const counts = summariseTasks([stage('Research', [task('not_started'), task('not_started')])]);
    expect(counts.inProgress).toBe(0);
    expect(counts.notStarted).toBe(2);
  });

  it('is 0% with no checklist, not 100%', () => {
    // Legacy rows carry progress_percentage = 100 with no tasks at all, which
    // is what put "100%" above "Completed 0/0" on the live page.
    expect(summariseTasks([]).percent).toBe(0);
    expect(summariseTasks([stage('Research', [])]).percent).toBe(0);
  });

  it('counts across every stage', () => {
    const counts = summariseTasks([
      stage('Research', [task('completed'), task('completed')]),
      stage('Documents', [task('in_progress'), task('not_started')]),
    ]);

    expect(counts).toMatchObject({ completed: 2, inProgress: 1, notStarted: 1, total: 4 });
    expect(counts.percent).toBe(50);
  });

  it('keeps parked tasks out of the percentage', () => {
    // Marking something not-applicable should move a student forward, not
    // leave them stuck below 100 forever.
    const counts = summariseTasks([
      stage('Research', [task('completed'), task('not_applicable'), task('blocked')]),
    ]);

    expect(counts.parked).toBe(2);
    expect(counts.total).toBe(3);
    expect(counts.percent).toBe(100);
  });

  it('reaches exactly 100 when everything countable is done', () => {
    const counts = summariseTasks([stage('Submit', [task('completed'), task('completed')])]);
    expect(counts.percent).toBe(100);
  });
});

describe('activeStageIndex', () => {
  it('signals "no checklist" rather than pointing at nothing', () => {
    expect(activeStageIndex([])).toBe(-1);
  });

  it('prefers the stage already in progress', () => {
    const stages = [
      stage('Research', [task('completed')], 'completed'),
      stage('Eligibility', [task('not_started')], 'in_progress'),
      stage('Documents', [task('not_started')]),
    ];
    expect(activeStageIndex(stages)).toBe(1);
  });

  it('otherwise lands on the first stage with unfinished work', () => {
    const stages = [
      stage('Research', [task('completed')]),
      stage('Eligibility', [task('completed')]),
      stage('Documents', [task('not_started')]),
    ];
    expect(activeStageIndex(stages)).toBe(2);
  });

  it('stays on the last stage once everything is done', () => {
    // Sending a finished application back to the top would read as a reset.
    const stages = [
      stage('Research', [task('completed')]),
      stage('Submit', [task('completed')]),
    ];
    expect(activeStageIndex(stages)).toBe(1);
  });

  it('starts at the top when the stages exist but have no tasks yet', () => {
    /*
     * The parse worker writes the stages first and the tasks afterwards, so
     * every stage is briefly empty. "No stage has an unfinished task" is
     * vacuously true there, and treating it as "everything is done" drew the
     * whole stepper complete and landed the student on Submit.
     */
    const stages = [stage('Research', []), stage('Eligibility', []), stage('Submit', [])];
    expect(activeStageIndex(stages)).toBe(0);
  });

  it('still honours an in-progress stage that has no tasks yet', () => {
    const stages = [stage('Research', []), stage('Eligibility', [], 'in_progress')];
    expect(activeStageIndex(stages)).toBe(1);
  });

  it('does not let one empty stage drag a finished application back to the top', () => {
    // Some tasks exist, so the "everything done" branch is the right one — the
    // empty trailing stage must not be mistaken for an unwritten checklist.
    const stages = [stage('Research', [task('completed')]), stage('Submit', [])];
    expect(activeStageIndex(stages)).toBe(1);
  });
});

describe('stageProgressLabel', () => {
  it('distinguishes "no tasks" from "none done"', () => {
    expect(stageProgressLabel(stage('Research', []))).toBeNull();
    expect(stageProgressLabel(stage('Research', [task('not_started')]))).toBe('0/1 done');
  });

  it('counts only completed tasks', () => {
    const s = stage('Documents', [task('completed'), task('in_progress'), task('not_started')]);
    expect(stageProgressLabel(s)).toBe('1/3 done');
  });
});
