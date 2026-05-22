import { sendEmail } from '@/lib/send-email';
import { formatMoney } from '@/lib/currency';
import type { Currency } from '@/types/mentorship';

/**
 * Send confirmation emails to both the mentor and the mentee after a booking
 * is paid. Includes meeting link, .ics calendar attachment, and the help
 * request the mentee filled in.
 *
 * The Resend API supports inline base64 attachments via `attachments[]`.
 * We extend `sendEmail` here because the existing helper doesn't support
 * attachments — see `sendEmailWithAttachments` below.
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

async function sendEmailWithAttachments(opts: {
  to: string;
  subject: string;
  html: string;
  attachments?: { filename: string; content: string; contentType?: string }[];
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.WAITLIST_FROM_EMAIL ?? 'mentorship@glowbal.com';

  if (!apiKey || apiKey.startsWith('re_your_')) {
    console.warn('[mentorship-email] RESEND_API_KEY not configured — skipping', opts.to);
    return;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      attachments: opts.attachments?.map((a) => ({
        filename: a.filename,
        content: Buffer.from(a.content).toString('base64'),
      })),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error('[mentorship-email] Resend error:', res.status, body);
  }
}

export async function sendMenteeConfirmation(
  ctx: MentorshipEmailContext,
): Promise<void> {
  const end = new Date(ctx.scheduledAt.getTime() + ctx.durationMins * 60 * 1000);
  const calLink = googleCalendarUrl({
    start: ctx.scheduledAt,
    end,
    title: `Glowbal mentorship with ${ctx.mentorName}`,
    description: [
      `Join: ${ctx.meetingLink}`,
      ctx.helpTopic ? `Topic: ${ctx.helpTopic}` : '',
      ctx.helpQuestions ? `Questions: ${ctx.helpQuestions}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    location: ctx.meetingLink,
  });

  const html = `
    <div style="font-family:ui-sans-serif,system-ui,Arial; max-width:560px; margin:0 auto; padding:24px; color:#0f172a">
      <h1 style="font-size:22px; font-weight:600; margin:0 0 12px">Your mentorship session is booked 🎉</h1>
      <p style="color:#475569; line-height:1.6">
        Thanks ${escapeHtml(ctx.menteeName)} — your session with
        <strong>${escapeHtml(ctx.mentorName)}</strong> is confirmed.
      </p>

      <table style="margin:20px 0; width:100%; border-collapse:collapse;">
        <tr><td style="padding:8px 0; color:#64748b">When</td><td style="padding:8px 0">${escapeHtml(formatLondonTime(ctx.scheduledAt))}</td></tr>
        <tr><td style="padding:8px 0; color:#64748b">Duration</td><td style="padding:8px 0">${ctx.durationMins} minutes</td></tr>
        <tr><td style="padding:8px 0; color:#64748b">Total paid</td><td style="padding:8px 0">${formatMoney(ctx.amountTotal, ctx.currency)}</td></tr>
        <tr><td style="padding:8px 0; color:#64748b">Booking ID</td><td style="padding:8px 0">#${ctx.bookingId}</td></tr>
      </table>

      <p style="margin:20px 0">
        <a href="${ctx.meetingLink}" style="display:inline-block; background:linear-gradient(135deg,#FF3D9A,#FF85B3); color:#fff; padding:12px 22px; border-radius:999px; text-decoration:none; font-weight:600">Join the meeting</a>
        <a href="${calLink}" style="display:inline-block; margin-left:8px; padding:12px 22px; border:1px solid #e2e8f0; border-radius:999px; color:#0f172a; text-decoration:none; font-weight:600">Add to Google Calendar</a>
      </p>

      ${
        ctx.helpTopic
          ? `<div style="margin-top:24px; padding:16px; background:#f8fafc; border-radius:12px;">
               <p style="margin:0 0 8px; color:#64748b; font-size:13px">What you wanted help with</p>
               <p style="margin:0 0 6px; font-weight:600">${escapeHtml(ctx.helpTopic)}</p>
               ${ctx.helpQuestions ? `<p style="margin:6px 0; color:#475569">${escapeHtml(ctx.helpQuestions)}</p>` : ''}
               ${ctx.helpOutcome ? `<p style="margin:6px 0; color:#475569"><em>Goal: ${escapeHtml(ctx.helpOutcome)}</em></p>` : ''}
             </div>`
          : ''
      }

      <p style="margin-top:28px; color:#94a3b8; font-size:13px">
        The .ics file attached lets you add this session to any calendar app.
      </p>
    </div>
  `;

  await sendEmailWithAttachments({
    to: ctx.menteeEmail,
    subject: `Your Glowbal mentorship with ${ctx.mentorName} is confirmed`,
    html,
    attachments: [
      {
        filename: `glowbal-session-${ctx.bookingId}.ics`,
        content: ctx.icsContent,
        contentType: 'text/calendar',
      },
    ],
  });
}

export async function sendMentorNotification(
  ctx: MentorshipEmailContext,
): Promise<void> {
  const end = new Date(ctx.scheduledAt.getTime() + ctx.durationMins * 60 * 1000);
  const calLink = googleCalendarUrl({
    start: ctx.scheduledAt,
    end,
    title: `Mentorship: ${ctx.menteeName}`,
    description: [
      `Mentee: ${ctx.menteeName} (${ctx.menteeEmail})`,
      `Join: ${ctx.meetingLink}`,
      ctx.helpTopic ? `Topic: ${ctx.helpTopic}` : '',
      ctx.helpQuestions ? `Questions: ${ctx.helpQuestions}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    location: ctx.meetingLink,
  });

  const html = `
    <div style="font-family:ui-sans-serif,system-ui,Arial; max-width:560px; margin:0 auto; padding:24px; color:#0f172a">
      <h1 style="font-size:22px; font-weight:600; margin:0 0 12px">New mentorship booking</h1>
      <p style="color:#475569; line-height:1.6">
        Hi ${escapeHtml(ctx.mentorName)} — <strong>${escapeHtml(ctx.menteeName)}</strong> just booked
        a session with you.
      </p>

      <table style="margin:20px 0; width:100%; border-collapse:collapse;">
        <tr><td style="padding:8px 0; color:#64748b">When</td><td style="padding:8px 0">${escapeHtml(formatLondonTime(ctx.scheduledAt))}</td></tr>
        <tr><td style="padding:8px 0; color:#64748b">Duration</td><td style="padding:8px 0">${ctx.durationMins} minutes</td></tr>
        <tr><td style="padding:8px 0; color:#64748b">Mentee</td><td style="padding:8px 0">${escapeHtml(ctx.menteeName)} &lt;${escapeHtml(ctx.menteeEmail)}&gt;</td></tr>
        <tr><td style="padding:8px 0; color:#64748b">Booking ID</td><td style="padding:8px 0">#${ctx.bookingId}</td></tr>
      </table>

      ${
        ctx.helpTopic
          ? `<div style="margin-top:16px; padding:16px; background:#f8fafc; border-radius:12px;">
               <p style="margin:0 0 8px; color:#64748b; font-size:13px">What they want help with</p>
               <p style="margin:0 0 6px; font-weight:600">${escapeHtml(ctx.helpTopic)}</p>
               ${ctx.helpQuestions ? `<p style="margin:6px 0; color:#475569">${escapeHtml(ctx.helpQuestions)}</p>` : ''}
               ${ctx.helpOutcome ? `<p style="margin:6px 0; color:#475569"><em>Goal: ${escapeHtml(ctx.helpOutcome)}</em></p>` : ''}
             </div>`
          : ''
      }

      <p style="margin:24px 0">
        <a href="${ctx.meetingLink}" style="display:inline-block; background:linear-gradient(135deg,#FF3D9A,#FF85B3); color:#fff; padding:12px 22px; border-radius:999px; text-decoration:none; font-weight:600">Join the meeting</a>
        <a href="${calLink}" style="display:inline-block; margin-left:8px; padding:12px 22px; border:1px solid #e2e8f0; border-radius:999px; color:#0f172a; text-decoration:none; font-weight:600">Add to Google Calendar</a>
      </p>

      <p style="margin-top:28px; color:#94a3b8; font-size:13px">
        Your payout (after Glowbal&rsquo;s 10% service fee) will be released after the session is marked complete.
      </p>
    </div>
  `;

  await sendEmailWithAttachments({
    to: ctx.mentorEmail,
    subject: `New Glowbal mentorship booking from ${ctx.menteeName}`,
    html,
    attachments: [
      {
        filename: `glowbal-session-${ctx.bookingId}.ics`,
        content: ctx.icsContent,
        contentType: 'text/calendar',
      },
    ],
  });
}

// ── Send a generic mentorship email (kept exported for tests) ──────────────

export { sendEmailWithAttachments };
export { sendEmail };

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
