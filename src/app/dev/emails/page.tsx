import { notFound } from 'next/navigation';
import { signupConfirmationEmail } from '@/lib/emails/signup-confirmation';
import { welcomeEmail } from '@/lib/emails/welcome';
import { newsletterWelcomeEmail } from '@/lib/emails/newsletter-welcome';
import {
  deadlineReminderEmail,
  onboardingCompleteEmail,
  onboardingReminderEmail,
  reportReadyEmail,
} from '@/lib/emails/lifecycle';
import { renderManualOutcomeEmail } from '@/server/payments/manual-email-templates';
import { SITE_URL } from '@/lib/site-url';

export const dynamic = 'force-dynamic';

type Preview = {
  name: string;
  subject: string;
  html: string;
};

export default function EmailPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  const paymentOutcome = renderManualOutcomeEmail({
    confirmed: true,
    recipientName: 'Nguyễn Văn A',
    reference: 'GLOWMANUAL123',
    productLabel: 'GlowBal Plus Pro',
    statusUrl: `${SITE_URL}/payment/manual/status?reference=GLOWMANUAL123`,
  });

  const previews: Preview[] = [
    {
      name: 'Payment Confirmation (Community Access)',
      subject: paymentOutcome.subject,
      html: paymentOutcome.html,
    },
    {
      name: 'Confirm account',
      subject: 'Confirm your GlowBal account',
      html: signupConfirmationEmail('https://example.test/auth/confirm?token=preview', 'August'),
    },
    {
      name: 'Welcome',
      subject: 'Welcome to GlowBal — you’re in',
      html: welcomeEmail({ firstName: 'August', nextUrl: `${SITE_URL}/onboarding` }),
    },
    {
      name: 'Onboarding reminder',
      subject: 'Continue your GlowBal profile',
      html: onboardingReminderEmail({ firstName: 'August', continueUrl: `${SITE_URL}/onboarding` }),
    },
    {
      name: 'Onboarding complete',
      subject: 'Your GlowBal profile is ready',
      html: onboardingCompleteEmail({ firstName: 'August', discoveryUrl: `${SITE_URL}/universities` }),
    },
    {
      name: 'Matching Report ready',
      subject: 'Your Cambridge Engineering match is ready',
      html: reportReadyEmail({
        kind: 'matching',
        url: `${SITE_URL}/ai-strategy`,
        firstName: 'August',
        university: 'University of Cambridge',
        programme: 'Engineering',
        score: 82,
        outstandingActions: 3,
      }),
    },
    {
      name: 'Strategy ready',
      subject: 'Your GlowBal strategy is ready',
      html: reportReadyEmail({
        kind: 'strategy',
        url: `${SITE_URL}/ai-strategy`,
        firstName: 'August',
        university: 'University of Cambridge',
        programme: 'Engineering',
        outstandingActions: 7,
      }),
    },
    {
      name: 'Deadline reminder',
      subject: 'Cambridge Engineering closes in 7 days',
      html: deadlineReminderEmail({
        university: 'University of Cambridge',
        programme: 'Engineering',
        deadlineLabel: '22 August 2026',
        daysRemaining: 7,
        url: `${SITE_URL}/apply`,
        readinessScore: 84,
        remainingTasks: 2,
      }),
    },
    {
      name: 'Newsletter welcome',
      subject: 'Welcome to the GlowBal newsletter',
      html: newsletterWelcomeEmail({
        firstName: 'August',
        newsUrl: `${SITE_URL}/news`,
        unsubscribeUrl: `${SITE_URL}/newsletter/unsubscribe?email=august@example.test`,
      }),
    },
  ];

  return (
    <main className="min-h-screen bg-neutral-100 px-6 py-10 text-neutral-950">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-bold">GlowBal email previews</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Development only. These previews use fixture data and never send mail.
        </p>
        <div className="mt-8 grid gap-10">
          {previews.map((preview) => (
            <section key={preview.name} className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
              <div className="border-b border-neutral-200 px-5 py-4">
                <h2 className="font-semibold">{preview.name}</h2>
                <p className="mt-1 text-sm text-neutral-500">Subject: {preview.subject}</p>
              </div>
              <div className="grid gap-4 p-4 lg:grid-cols-[1fr_390px]">
                <iframe
                  title={`${preview.name} desktop preview`}
                  srcDoc={preview.html}
                  className="h-[820px] w-full rounded-xl border border-neutral-200 bg-black"
                />
                <iframe
                  title={`${preview.name} mobile preview`}
                  srcDoc={preview.html}
                  className="h-[820px] w-full rounded-xl border border-neutral-200 bg-black"
                />
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
