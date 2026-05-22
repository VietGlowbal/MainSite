/**
 * Meeting link generator. We use Jitsi Meet because it works without API keys
 * or per-meeting setup — a unique URL is enough to spin up a video room.
 *
 * Swap this out for Zoom/Google Meet by replacing `generateMeetingLink` with
 * a function that hits the relevant API. The rest of the booking flow doesn't
 * care which video provider you use — it just stores the resulting URL.
 */

const MEETING_BASE_URL =
  process.env.MEETING_BASE_URL ?? 'https://meet.jit.si';

export function generateMeetingLink(bookingId: number): string {
  // Pad with random entropy so the URL isn't guessable from the booking id.
  const entropy = Math.random().toString(36).slice(2, 10);
  const slug = `glowbal-${bookingId}-${entropy}`;
  return `${MEETING_BASE_URL}/${slug}`;
}

/**
 * Build an .ics calendar invite body for a 1-hour mentorship session.
 * Returns a string suitable for `Buffer.from(...).toString('base64')` and
 * attaching to an email. We deliberately keep it simple — no recurring rules,
 * no time-zone overrides — because Jitsi sessions are one-off.
 */
export function buildIcsForBooking(opts: {
  bookingId: number;
  startsAt: Date;
  endsAt: Date;
  mentorName: string;
  menteeName: string;
  meetingLink: string;
  helpTopic: string | null;
}): string {
  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

  const uid = `booking-${opts.bookingId}@glowbal.app`;
  const summary = `Glowbal mentorship — ${opts.mentorName} & ${opts.menteeName}`;
  const description = [
    `Mentorship session via Glowbal.`,
    opts.helpTopic ? `Topic: ${opts.helpTopic}` : null,
    `Join: ${opts.meetingLink}`,
  ]
    .filter(Boolean)
    .join('\\n');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Glowbal//Mentorship//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(opts.startsAt)}`,
    `DTEND:${fmt(opts.endsAt)}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `URL:${opts.meetingLink}`,
    `LOCATION:${opts.meetingLink}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}
