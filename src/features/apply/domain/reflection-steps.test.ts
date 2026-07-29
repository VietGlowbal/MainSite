import { describe, expect, it } from 'vitest';
import {
  REFLECTION_STEPS,
  REFLECTION_STEP_COUNT,
  reflectionProgress,
  reflectionStep,
} from './reflection-steps';
import { ACHIEVEMENT_CATEGORIES, ACTIVITY_CATEGORIES } from './reflection';

describe('reflection steps', () => {
  it('is a two-step flow, documents excluded', () => {
    // The third step in the mockups' larger count was documents, which already
    // have their own profile page — including them would add an invisible step
    // duplicating a screen the student can reach anyway.
    expect(REFLECTION_STEP_COUNT).toBe(2);
    expect(REFLECTION_STEPS.map((s) => s.key)).toEqual(['about', 'evidence']);
  });

  it('puts achievements last', () => {
    expect(reflectionStep('about').number).toBe(1);
    expect(reflectionStep('evidence').number).toBe(2);
  });

  it('fills the bar in proportion to the step, not to nothing', () => {
    /*
     * The bug this pins: the mockup's achievements page was badged "1/2" while
     * drawing a full progress bar — a finished-looking bar on the screen where
     * the student has done the least. Progress is derived from the step number
     * so the label and the bar cannot disagree.
     */
    expect(reflectionProgress('about')).toBe(0.5);
    expect(reflectionProgress('evidence')).toBe(1);
  });

  it('numbers the steps contiguously from one', () => {
    // Guards against a step being added to the list without renumbering, which
    // would silently produce a bar past 100% or a gap in the count.
    expect(REFLECTION_STEPS.map((s) => s.number)).toEqual(
      REFLECTION_STEPS.map((_, index) => index + 1),
    );
  });

  it('gives every step a distinct route', () => {
    const paths = new Set(REFLECTION_STEPS.map((s) => s.path));
    expect(paths.size).toBe(REFLECTION_STEP_COUNT);
  });
});

describe('achievement and activity taxonomies', () => {
  it('does not reproduce the mockup duplicate', () => {
    // The mockup listed "Certificates & Recognitions" twice under slightly
    // different Vietnamese labels. Confirmed a slip.
    const labels = ACHIEVEMENT_CATEGORIES.map((c) => c.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('separates competitions from general academic awards', () => {
    // An Olympiad placing is the most common Vietnamese academic credential;
    // filing it under "Academic award" loses what a reader cares about.
    const values = ACHIEVEMENT_CATEGORIES.map((c) => c.value);
    expect(values).toContain('academic_award');
    expect(values).toContain('competition');
  });

  it('files mentoring as an activity, never as an award', () => {
    // Tutoring a younger year is something you did, not something you won.
    expect(ACHIEVEMENT_CATEGORIES.map((c) => c.value)).not.toContain('mentoring');
    expect(ACTIVITY_CATEGORIES.map((c) => c.value)).toContain('mentoring');
  });

  it('keeps "other" last in both lists', () => {
    // A catch-all in the middle of a list reads as a real option.
    expect(ACHIEVEMENT_CATEGORIES.at(-1)?.value).toBe('other');
    expect(ACTIVITY_CATEGORIES.at(-1)?.value).toBe('other');
  });
});
