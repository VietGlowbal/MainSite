import { sendEmail } from '@/lib/send-email';
import { formatMoney } from '@/lib/currency';
import { emailButton, escapeHtml, glowbalEmailLayout } from '@/lib/email/template';
import type { EmailTemplateId } from '@/lib/email/types';
import type { Currency } from '@/types/mentorship';

/**
 * Confirmation emails sent to both mentor and mentee after a paid booking.
 * Calendar attachments now flow through the same Resend transport as every
 * other GlowBal email, so sender identity, logging and idempotency are shared.
 */
interface MentorshipEmailContext {
  bookingId: number;
  mentorName: string;
  mentorEmail: string;
  menteeName: string;
  menteeEmail: string;
  scheduledAt: Date;
  durationMins: number;
  meetingLink: string;
  helpTopic: string | null;
  helpQuestions: string | null;
  helpOutcome: string | null;
  amountTotal: number;
  currency: Currency;
  icsContent: string;
}

function formatLondonTime(date: Date): string {
  return date.toLocaleString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/London',
  });
}

function googleCalendarUrl(opts: {
  start: Date;
  end: Date;
  title: string;
  description: string;
  location: string;
}): string {
  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: opts.title,
    dates: `${fmt(opts.start)}/${fmt(opts.end)}`,
    details: opts.description,
    location: opts.location,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function calendarLink(href: string): string {
  return `<div style="margin-top:14px;text-align:center;"><a href="${escapeHtml(href)}" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;font-weight:700;color:#FAFAFA;text-decoration:none;border-bottom:1px solid #737373;">Add to Google Calendar</a></div>`;
}

function bookingDetails(rows: Array<[string, string]>): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;background:#111114;border:1px solid #2A2A2E;border-radius:14px;text-align:left;">
      ${rows.map(([label, value], index) => `
        <tr>
          <td style="padding:${index === 0 ? '16px' : '10px 16px'} 8px ${index === rows.length - 1 ? '16px' : '10px'} 16px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#737373;white-space:nowrap;">${escapeHtml(label)}</td>
          <td style="padding:${index === 0 ? '16px' : '10px 16px'} 16px ${index === rows.length - 1 ? '16px' : '10px'} 8px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:19px;color:#FAFAFA;text-align:right;">${escapeHtml(value)}</td>
        </tr>`).join('')}
    </table>`;
}

function helpBlock(ctx: MentorshipEmailContext, mentorView: boolean): string {
  if (!ctx.helpTopic) return '';
  return `
    <div style="margin-top:22px;padding:18px;background:#111114;border-left:3px solid #E11D48;border-radius:10px;text-align:left;">
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:17px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#E11D48;">${mentorView ? 'What they want help with' : 'Your session focus'}</div>
      <div style="margin-top:7px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;font-weight:700;color:#FAFAFA;">${escapeHtml(ctx.helpTopic)}</div>
      ${ctx.helpQuestions ? `<div style="margin-top:7px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#A3A3A3;">${escapeHtml(ctx.helpQuestions)}</div>` : ''}
      ${ctx.helpOutcome ? `<div style="margin-top:7px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#737373;">Goal: ${escapeHtml(ctx.helpOutcome)}</div>` : ''}
    </div>`;
}

export async function sendEmailWithAttachments(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: { filename: string; content: string; contentType?: string }[];
  idempotencyKey?: string;
  template?: EmailTemplateId;
}): Promise<void> {
  const result = await sendEmail({
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
    attachments: opts.attachments?.map((attachment) => ({
      filename: attachment.filename,
      content: Buffer.from(attachment.content).toString('base64'),
      contentType: attachment.contentType,
    })),
    category: 'product_transactional',
    template: opts.template ?? 'mentorship-confirmation',
    idempotencyKey: opts.idempotencyKey,
    tags: { kind: opts.template ?? 'mentorship-confirmation' },
  });

  if (!result.ok) {
    throw new Error(result.error);
  }
}

export async function sendMenteeConfirmation(ctx: MentorshipEmailContext): Promise<void> {
  const end = new Date(ctx.scheduledAt.getTime() + ctx.durationMins * 60 * 1000);
  const calLink = googleCalendarUrl({
    start: ctx.scheduledAt,
    end,
    title: `GlowBal advising session with ${ctx.mentorName}`,
    description: [
      `Join: ${ctx.meetingLink}`,
      ctx.helpTopic ? `Topic: ${ctx.helpTopic}` : '',
      ctx.helpQuestions ? `Questions: ${ctx.helpQuestions}` : '',
    ].filter(Boolean).join('\n'),
    location: ctx.meetingLink,
  });

  const html = glowbalEmailLayout({
    preheader: `Your advising session with ${ctx.mentorName} is confirmed.`,
    eyebrow: 'Mentorship confirmed',
    titleHtml: 'Your advising session is booked.',
    bodyHtml: `
      <div>Thanks ${escapeHtml(ctx.menteeName)} — your session with <strong style="color:#FAFAFA;">${escapeHtml(ctx.mentorName)}</strong> is confirmed.</div>
      ${bookingDetails([
        ['When (London)', formatLondonTime(ctx.scheduledAt)],
        ['Duration', `${ctx.durationMins} minutes`],
        ['Total paid', formatMoney(ctx.amountTotal, ctx.currency)],
        ['Booking ID', `#${ctx.bookingId}`],
      ])}
      ${helpBlock(ctx, false)}`,
    actionHtml: emailButton('Join the meeting →', ctx.meetingLink),
    afterActionHtml: `${calendarLink(calLink)}<div style="margin-top:18px;font-size:12px;line-height:18px;color:#737373;">A calendar (.ics) file is attached for Apple Calendar, Outlook and other calendar apps.</div>`,
    includeSocials: false,
  });

  await sendEmailWithAttachments({
    to: ctx.menteeEmail,
    subject: `Your GlowBal advising session with ${ctx.mentorName} is confirmed`,
    html,
    text: `Your GlowBal session with ${ctx.mentorName} is confirmed for ${formatLondonTime(ctx.scheduledAt)}. Join: ${ctx.meetingLink}`,
    idempotencyKey: `mentorship-confirmation:mentee:${ctx.bookingId}`,
    attachments: [{
      filename: `glowbal-session-${ctx.bookingId}.ics`,
      content: ctx.icsContent,
      contentType: 'text/calendar',
    }],
  });
}

export async function sendMentorNotification(ctx: MentorshipEmailContext): Promise<void> {
  const end = new Date(ctx.scheduledAt.getTime() + ctx.durationMins * 60 * 1000);
  const calLink = googleCalendarUrl({
    start: ctx.scheduledAt,
    end,
    title: `Advising session: ${ctx.menteeName}`,
    description: [
      `Mentee: ${ctx.menteeName} (${ctx.menteeEmail})`,
      `Join: ${ctx.meetingLink}`,
      ctx.helpTopic ? `Topic: ${ctx.helpTopic}` : '',
      ctx.helpQuestions ? `Questions: ${ctx.helpQuestions}` : '',
    ].filter(Boolean).join('\n'),
    location: ctx.meetingLink,
  });

  const html = glowbalEmailLayout({
    preheader: `${ctx.menteeName} booked an advising session with you.`,
    eyebrow: 'New mentorship booking',
    titleHtml: 'You have a new advising session.',
    bodyHtml: `
      <div>Hi ${escapeHtml(ctx.mentorName)} — <strong style="color:#FAFAFA;">${escapeHtml(ctx.menteeName)}</strong> has booked a session with you.</div>
      ${bookingDetails([
        ['When (London)', formatLondonTime(ctx.scheduledAt)],
        ['Duration', `${ctx.durationMins} minutes`],
        ['Mentee', `${ctx.menteeName} <${ctx.menteeEmail}>`],
        ['Booking ID', `#${ctx.bookingId}`],
      ])}
      ${helpBlock(ctx, true)}`,
    actionHtml: emailButton('Join the meeting →', ctx.meetingLink),
    afterActionHtml: `${calendarLink(calLink)}<div style="margin-top:18px;font-size:12px;line-height:18px;color:#737373;">Your payout, after GlowBal's service fee, is released after the session is marked complete.</div>`,
    includeSocials: false,
  });

  await sendEmailWithAttachments({
    to: ctx.mentorEmail,
    subject: `New GlowBal advising booking from ${ctx.menteeName}`,
    html,
    text: `${ctx.menteeName} booked a GlowBal advising session for ${formatLondonTime(ctx.scheduledAt)}. Join: ${ctx.meetingLink}`,
    idempotencyKey: `mentorship-confirmation:mentor:${ctx.bookingId}`,
    attachments: [{
      filename: `glowbal-session-${ctx.bookingId}.ics`,
      content: ctx.icsContent,
      contentType: 'text/calendar',
    }],
  });
}

export { sendEmail };
