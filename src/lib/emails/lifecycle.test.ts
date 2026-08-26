import { describe, expect, it } from 'vitest';
import { escapeHtml } from '../email/template';
import { deadlineReminderEmail, weeklyStrategyDigestEmail } from './lifecycle';

describe('weeklyStrategyDigestEmail', () => {
  const plannerUrl = 'https://glowbal.example.com/planner?week=2026-W34';
  const weekLabel = 'Aug 24 – Aug 30';

  const overdueA = { title: 'Draft SOP paragraph two', dueLabel: 'Was due Mon, Aug 24' };
  const overdueB = { title: 'Request transcript from school', dueLabel: 'Was due Tue, Aug 25' };
  const upcomingA = { title: 'Submit scholarship essay', dueLabel: 'Due Thu, Aug 27' };
  const upcomingB = { title: 'Book IELTS speaking practice', dueLabel: 'Due Sat, Aug 29' };

  const sampleInput = {
    url: plannerUrl,
    weekLabel,
    overdue: [overdueA, overdueB],
    upcoming: [upcomingA, upcomingB],
  };

  it('renders the overdue section before the upcoming section', () => {
    const html = weeklyStrategyDigestEmail(sampleInput);

    const overdueAt = html.indexOf('Overdue');
    const upcomingAt = html.indexOf('Coming up');
    expect(overdueAt).toBeGreaterThan(-1);
    expect(upcomingAt).toBeGreaterThan(overdueAt);
    expect(html.indexOf(overdueA.title)).toBeLessThan(html.indexOf(upcomingA.title));
  });

  it('shows every task exactly once in its own section, paired with its due label', () => {
    const html = weeklyStrategyDigestEmail(sampleInput);

    const overdueSlice = html.slice(html.indexOf('Overdue'), html.indexOf('Coming up'));
    const upcomingSlice = html.slice(html.indexOf('Coming up'));

    for (const task of sampleInput.overdue) {
      // Exactly one occurrence in the whole email…
      expect(html.split(escapeHtml(task.title))).toHaveLength(2);
      // …inside the overdue section, next to its due label…
      expect(overdueSlice).toContain(escapeHtml(task.title));
      expect(overdueSlice).toContain(escapeHtml(task.dueLabel));
      // …and never in the upcoming section.
      expect(upcomingSlice).not.toContain(escapeHtml(task.title));
    }
    for (const task of sampleInput.upcoming) {
      expect(html.split(escapeHtml(task.title))).toHaveLength(2);
      expect(upcomingSlice).toContain(escapeHtml(task.title));
      expect(upcomingSlice).toContain(escapeHtml(task.dueLabel));
      expect(overdueSlice).not.toContain(escapeHtml(task.title));
    }
  });

  it('links a single CTA to the canonical planner URL', () => {
    const html = weeklyStrategyDigestEmail(sampleInput);

    expect(html).toContain('Open my planner');
    expect(html).toContain(`href="${plannerUrl}"`);
    // The deep link exists only as the button target.
    expect(html.split(plannerUrl)).toHaveLength(2);
  });

  it('includes the week label in the preheader and title area', () => {
    const html = weeklyStrategyDigestEmail(sampleInput);

    // Once in the hidden preheader, once in the visible headline.
    expect(html.split(weekLabel).length - 1).toBeGreaterThanOrEqual(2);
  });

  it('escapes hostile task titles instead of emitting script tags', () => {
    const html = weeklyStrategyDigestEmail({
      ...sampleInput,
      overdue: [{ title: '<script>alert(1)</script>', dueLabel: 'Was due Mon, Aug 24' }],
      upcoming: [],
    });

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('returns the full escaped text for very long titles', () => {
    const longTitle = `${'L'.repeat(260)} & <quoted> "bits" ${'R'.repeat(260)}`;
    const html = weeklyStrategyDigestEmail({
      ...sampleInput,
      overdue: [{ title: longTitle, dueLabel: 'Was due Mon, Aug 24' }],
      upcoming: [],
    });

    expect(typeof html).toBe('string');
    expect(html).toContain(escapeHtml(longTitle));
  });

  it('shows the readiness metric only when a percentage is provided', () => {
    const withReadiness = weeklyStrategyDigestEmail({ ...sampleInput, readinessPercent: 72 });
    expect(withReadiness).toContain('>72%<');
    expect(withReadiness).toContain('Readiness');

    const withoutReadiness = weeklyStrategyDigestEmail(sampleInput);
    expect(withoutReadiness).not.toContain('Readiness');
    expect(withoutReadiness).not.toContain('>72%<');
  });

  it('renders the nothing-scheduled state when both lists are empty', () => {
    const html = weeklyStrategyDigestEmail({ ...sampleInput, overdue: [], upcoming: [] });

    expect(html).toContain('nothing scheduled this week');
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('</html>');
    expect(html).not.toContain('Overdue');
    expect(html).not.toContain('Coming up');
  });

  it('omits an empty section instead of rendering an empty heading', () => {
    const html = weeklyStrategyDigestEmail({
      ...sampleInput,
      overdue: [],
      upcoming: [upcomingA],
    });

    expect(html).not.toContain('Overdue');
    expect(html).toContain('Coming up');
    expect(html).toContain(escapeHtml(upcomingA.title));
    expect(html).toContain(escapeHtml(upcomingA.dueLabel));
  });
});

describe('deadlineReminderEmail', () => {
  const base = {
    university: 'University of Melbourne',
    deadlineLabel: 'Thu, Oct 15',
    url: 'https://glowbal.example.com/ai-strategy/app-9/planner',
  };

  it('says the deadline is today when nothing remains, not tomorrow', () => {
    const html = deadlineReminderEmail({ ...base, daysRemaining: 0 });

    expect(html).toContain('Deadline today');
    expect(html).not.toContain('Deadline tomorrow');
  });

  it('says the deadline is tomorrow at exactly one day out and counts further days', () => {
    expect(deadlineReminderEmail({ ...base, daysRemaining: 1 })).toContain('Deadline tomorrow');
    expect(deadlineReminderEmail({ ...base, daysRemaining: 7 })).toContain('7 days to go');
  });
});
