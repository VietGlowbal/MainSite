import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/legal-page';

export const metadata: Metadata = {
  title: 'Terms of Service | GlowBal',
  description:
    'The terms that govern your use of GlowBal — the platform for discovering universities, scholarships, and building application strategies.',
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      lastUpdated="June 2026"
      intro={
        <p>
          These terms govern your use of GlowBal. By creating an account or
          using the platform, you agree to them. Please read them carefully.
        </p>
      }
      sections={[
        {
          heading: 'Using GlowBal',
          body: (
            <p>
              You may use GlowBal to search universities, discover scholarships,
              save opportunities, and generate application strategies. You agree
              to provide accurate information and to use the service lawfully and
              respectfully.
            </p>
          ),
        },
        {
          heading: 'Accounts',
          body: (
            <p>
              You are responsible for keeping your account credentials secure and
              for activity that happens under your account. You must be old enough
              to consent to use the service in your country.
            </p>
          ),
        },
        {
          heading: 'Free and Plus plans',
          body: (
            <p>
              GlowBal offers free features, including a limited number of AI
              strategy suggestions, and a paid GlowBal Plus plan with additional
              capabilities. Paid features and limits are described at checkout and
              may change over time.
            </p>
          ),
        },
        {
          heading: 'No guarantee of admission or funding',
          body: (
            <p>
              GlowBal helps you discover opportunities and prepare stronger
              applications, but we do not guarantee admission or scholarship
              outcomes. Final decisions are made by universities and scholarship
              providers.
            </p>
          ),
        },
        {
          heading: 'Content and AI output',
          body: (
            <p>
              AI strategy suggestions are generated to assist your planning and
              may contain errors. Always verify eligibility, deadlines, and
              requirements with the official source before applying.
            </p>
          ),
        },
        {
          heading: 'Contact',
          body: (
            <p>
              Questions about these terms? Email us at{' '}
              <a href="mailto:hello@glowbal.com" className="font-semibold text-pink-600">hello@glowbal.com</a>.
            </p>
          ),
        },
      ]}
    />
  );
}
