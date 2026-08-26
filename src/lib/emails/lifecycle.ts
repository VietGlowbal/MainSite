import { emailButton, escapeHtml, glowbalEmailLayout, metricRow } from '@/lib/email/template';

export function onboardingReminderEmail(input: {
  firstName?: string;
  continueUrl: string;
  finalReminder?: boolean;
}): string {
  const name = input.firstName?.trim();
  return glowbalEmailLayout({
    preheader: 'Finish your GlowBal profile to unlock personalised matching and strategy.',
    eyebrow: input.finalReminder ? 'Your profile is still waiting' : 'Pick up where you left off',
    titleHtml: name
      ? `${escapeHtml(name)}, your GlowBal profile is waiting.`
      : 'Your GlowBal profile is waiting.',
    bodyHtml:
      'Complete your profile to unlock university matching, scholarship matching, your Personal Report and a personalised application strategy. Your answers are saved, so you can continue from where you stopped.',
    actionHtml: emailButton(input.finalReminder ? 'Finish my profile →' : 'Continue my profile →', input.continueUrl),
    footerNote: 'You can control product reminders from your GlowBal email preferences.',
  });
}

export function onboardingCompleteEmail(input: { firstName?: string; discoveryUrl: string }): string {
  const name = input.firstName?.trim();
  return glowbalEmailLayout({
    preheader: 'Your GlowBal profile is ready. Start discovering options that fit you.',
    eyebrow: 'Profile complete',
    titleHtml: name
      ? `Your GlowBal profile is ready, <span style="color:#E11D48;">${escapeHtml(name)}</span>.`
      : 'Your GlowBal profile is ready.',
    bodyHtml:
      'GlowBal now has enough context to start comparing universities, programmes and scholarships against you — not just rankings.',
    actionHtml: emailButton('Find my universities →', input.discoveryUrl),
  });
}

export type GlowbalReportKind = 'personal' | 'matching' | 'strategy' | 'evaluation';

const REPORT_COPY: Record<GlowbalReportKind, { eyebrow: string; title: string; action: string }> = {
  personal: {
    eyebrow: 'Personal Report ready',
    title: 'See what makes your profile stand out.',
    action: 'View my Personal Report →',
  },
  matching: {
    eyebrow: 'Matching Report ready',
    title: 'Your university match is ready.',
    action: 'View my match →',
  },
  strategy: {
    eyebrow: 'Strategy Master',
    title: 'Your GlowBal strategy is ready.',
    action: 'Start my strategy →',
  },
  evaluation: {
    eyebrow: 'Evaluation ready',
    title: 'See how ready your application is.',
    action: 'See what to improve →',
  },
};

export function reportReadyEmail(input: {
  kind: GlowbalReportKind;
  url: string;
  firstName?: string;
  university?: string;
  programme?: string;
  score?: number;
  outstandingActions?: number;
}): string {
  const copy = REPORT_COPY[input.kind];
  const context = [input.university, input.programme].filter(Boolean).join(' · ');
  const metrics: Array<{ label: string; value: string }> = [];
  if (typeof input.score === 'number') metrics.push({ label: input.kind === 'evaluation' ? 'Readiness' : 'Current match', value: `${Math.round(input.score)}%` });
  if (typeof input.outstandingActions === 'number') metrics.push({ label: 'Recommended actions', value: String(input.outstandingActions) });

  const strategyBody = input.kind === 'strategy'
    ? 'We turned your profile, target options, strengths and gaps into a concrete action plan. The important part is not the report — it is what you should do next.'
    : input.kind === 'evaluation'
      ? 'GlowBal has reviewed the current state of your application and identified what is complete, what is still weak and what should happen next.'
      : input.kind === 'matching'
        ? `GlowBal has compared your profile against this option${context ? `: <strong style="color:#FAFAFA;">${escapeHtml(context)}</strong>` : ''}.`
        : 'Your applicant profile has been analysed across your academics, achievements, direction and application evidence.';

  return glowbalEmailLayout({
    preheader: copy.title,
    eyebrow: copy.eyebrow,
    titleHtml: copy.title,
    hero: input.kind === 'strategy',
    bodyHtml: `${strategyBody}${metricRow(metrics)}`,
    actionHtml: emailButton(copy.action, input.url),
  });
}

export function deadlineReminderEmail(input: {
  university: string;
  programme?: string;
  deadlineLabel: string;
  daysRemaining: number;
  url: string;
  readinessScore?: number;
  remainingTasks?: number;
}): string {
  const option = [input.university, input.programme].filter(Boolean).join(' · ');
  const metrics: Array<{ label: string; value: string }> = [];
  if (typeof input.readinessScore === 'number') metrics.push({ label: 'Application readiness', value: `${Math.round(input.readinessScore)}%` });
  if (typeof input.remainingTasks === 'number') metrics.push({ label: 'Tasks remaining', value: String(input.remainingTasks) });

  return glowbalEmailLayout({
    preheader: `${option} deadline: ${input.deadlineLabel}`,
    eyebrow: input.daysRemaining <= 0
      ? 'Deadline today'
      : input.daysRemaining === 1
        ? 'Deadline tomorrow'
        : `${input.daysRemaining} days to go`,
    titleHtml: `${escapeHtml(option)} is getting close.`,
    bodyHtml: `
      <div>The deadline is <strong style="color:#FAFAFA;">${escapeHtml(input.deadlineLabel)}</strong>.</div>
      ${metricRow(metrics)}
      <div style="margin-top:20px;">Open your planner to focus on the work that matters before submission.</div>`,
    actionHtml: emailButton('Finish my application →', input.url),
    includeSocials: false,
    footerNote: 'You can turn deadline reminders off in your GlowBal email preferences.',
  });
}

type DigestTask = { title: string; dueLabel: string };

function digestSectionHtml(label: string, tasks: DigestTask[]): string {
  if (!tasks.length) return '';
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:26px;text-align:left;">
      <tr>
        <td style="padding-bottom:2px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:16px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#E11D48;text-align:left;">${escapeHtml(label)}</td>
      </tr>
      ${tasks
        .map(
          (task) => `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #242428;text-align:left;">
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:21px;font-weight:700;color:#FAFAFA;">${escapeHtml(task.title)}</div>
            <div style="margin-top:3px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#a3a3a3;">${escapeHtml(task.dueLabel)}</div>
          </td>
        </tr>`,
        )
        .join('')}
    </table>`;
}

/**
 * Weekly planner digest: one email summarising overdue + upcoming planner
 * tasks per week instead of one email per task. docs/email-system.md §"Planner
 * and deadlines" prefers a weekly strategy digest because per-task mail trains
 * students to ignore product email; the digest keeps a single useful
 * return-to-product moment per week.
 *
 * Rendering contract:
 * - Overdue renders before upcoming. Each row pairs a task title with its due
 *   label. Deduplication across sections is the CALLER's job — if the same
 *   title is passed to both arrays, this template honestly renders it in both.
 * - Every dynamic string passes through escapeHtml before interpolation, so
 *   student/AI-generated titles can never inject markup. Long titles simply
 *   wrap; there are no width assumptions or truncation.
 * - An all-empty digest still renders valid HTML with an explicit
 *   nothing-scheduled body. Whether to send zero-task digests is decided by
 *   the caller/cron, not by this template.
 * - English copy only today, consistent with the other templates here;
 *   Vietnamese localisation rides on preferred_language handling later — no
 *   i18n mechanism is invented here.
 */
export function weeklyStrategyDigestEmail(input: {
  url: string; // canonical deep link into the planner (already application-scoped by the caller)
  weekLabel: string; // e.g. 'Aug 24 – Aug 30' — caller-localized; template renders verbatim
  overdue: Array<{ title: string; dueLabel: string }>;
  upcoming: Array<{ title: string; dueLabel: string }>;
  readinessPercent?: number;
}): string {
  const metrics: Array<{ label: string; value: string }> = [];
  if (typeof input.readinessPercent === 'number') {
    metrics.push({ label: 'Readiness', value: `${Math.round(input.readinessPercent)}%` });
  }
  const hasTasks = input.overdue.length > 0 || input.upcoming.length > 0;

  const listHtml = hasTasks
    ? `${digestSectionHtml('Overdue', input.overdue)}${digestSectionHtml('Coming up', input.upcoming)}`
    : '<div style="margin-top:18px;">There is nothing scheduled this week — enjoy the calm, or get ahead on your applications.</div>';

  return glowbalEmailLayout({
    preheader: `Your GlowBal plan for ${input.weekLabel}`,
    eyebrow: 'Weekly strategy digest',
    titleHtml: `Your plan for ${escapeHtml(input.weekLabel)}.`,
    bodyHtml: `
      <div>Here is where your applications stand for <strong style="color:#FAFAFA;">${escapeHtml(input.weekLabel)}</strong>.</div>
      ${metricRow(metrics)}
      ${listHtml}`,
    actionHtml: emailButton('Open my planner →', input.url),
    includeSocials: false,
    footerNote: 'You can turn the weekly strategy digest off in your GlowBal email preferences.',
  });
}

export function contactConfirmationEmail(input: { firstName?: string; siteUrl: string }): string {
  return glowbalEmailLayout({
    preheader: 'GlowBal received your request.',
    eyebrow: 'Request received',
    titleHtml: input.firstName?.trim()
      ? `Thanks, ${escapeHtml(input.firstName.trim())}. We'll take it from here.`
      : "Thanks. We'll take it from here.",
    bodyHtml:
      'Your request has reached the GlowBal team. We will review the details you sent and follow up using the contact information you provided.',
    actionHtml: emailButton('Back to GlowBal →', input.siteUrl),
  });
}
