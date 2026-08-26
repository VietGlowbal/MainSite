import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { welcomeEmail } from '../src/lib/emails/welcome';

/**
 * One-off test send for the v2 welcome email. Run:
 *   npx tsx --env-file=.env.local scripts/send-test-welcome.ts
 * Images are attached inline (CID) so the recipient sees them without
 * needing the assets deployed to a public URL yet.
 */

const apiKey = process.env.RESEND_API_KEY?.trim();
if (!apiKey || apiKey.startsWith('re_your_')) {
  throw new Error('RESEND_API_KEY missing in .env.local');
}

const to = process.env.EMAIL_TO_TEST?.trim() || 'taduchien314@gmail.com';
const from = process.env.EMAIL_FROM_TEST?.trim() || 'GlowBal <support@glowbal-education.com>';
const subject = process.env.EMAIL_SUBJECT_TEST?.trim() || 'Welcome to GlowBal — you’re in (v2 test)';

const files = ['progress.jpg', 'benefits.png', 'mentor.png'];
const placeholderBase = 'https://glowbal.test.invalid';

let html = welcomeEmail({
  firstName: 'Chiến',
  nextUrl: 'https://glowbal-education.com',
  onboardingComplete: false,
  assetsBaseUrl: placeholderBase,
});

const attachments = files.map((file) => {
  const contentId = file;
  html = html.replaceAll(`${placeholderBase}/glowbal/${file}`, `cid:${contentId}`);
  return {
    filename: file,
    content: readFileSync(join(process.cwd(), 'public', 'glowbal', file)).toString('base64'),
    content_id: contentId,
  };
});

async function main() {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: [to], subject, html, attachments }),
  });

  const body = (await response.json().catch(() => ({}))) as { id?: string; message?: string };
  console.log('status:', response.status, JSON.stringify(body));
  if (!response.ok || !body.id) process.exit(1);
  console.log('sent to', to, 'id:', body.id);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
