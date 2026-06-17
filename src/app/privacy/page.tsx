import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/legal-page';

export const metadata: Metadata = {
  title: 'Privacy Policy | GlowBal',
  description:
    'How GlowBal collects, uses, and protects your personal information when you discover universities, scholarships, and build your application plan.',
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      lastUpdated="June 2026"
      intro={
        <p>
          GlowBal helps students find universities, discover scholarships, and
          build application strategies. This policy explains what information we
          collect, why we collect it, and the choices you have.
        </p>
      }
      sections={[
        {
          heading: 'Information we collect',
          body: (
            <ul className="list-disc space-y-1 pl-5">
              <li>Account details you provide: name, email, phone number, and date of birth.</li>
              <li>Profile information: intended study level, target country, subject, current school, and any documents you upload.</li>
              <li>Activity such as universities you view, scholarships you save, and AI strategies you generate.</li>
              <li>Basic technical data (device, browser, and usage analytics) to keep the service reliable.</li>
            </ul>
          ),
        },
        {
          heading: 'How we use your information',
          body: (
            <ul className="list-disc space-y-1 pl-5">
              <li>To show relevant universities and scholarships and save your plan.</li>
              <li>To generate personalised AI application strategies.</li>
              <li>To send updates you ask for, such as scholarship reminders.</li>
              <li>To improve and secure the platform.</li>
            </ul>
          ),
        },
        {
          heading: 'Sharing',
          body: (
            <p>
              We do not sell your personal information. We share data only with
              service providers that help us operate GlowBal (for example,
              hosting, email, and payment processing) under appropriate
              safeguards, or where required by law.
            </p>
          ),
        },
        {
          heading: 'Your choices',
          body: (
            <p>
              You can access, update, or delete your profile information at any
              time from your account settings, or by contacting us. You can
              unsubscribe from non-essential emails using the link in any
              message.
            </p>
          ),
        },
        {
          heading: 'Contact',
          body: (
            <p>
              Questions about privacy? Email us at{' '}
              <a href="mailto:hello@glowbal.com" className="font-semibold text-pink-600">hello@glowbal.com</a>.
            </p>
          ),
        },
      ]}
    />
  );
}
