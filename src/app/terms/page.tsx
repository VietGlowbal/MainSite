import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/legal-page';

export const metadata: Metadata = {
  title: 'Terms and Conditions of Use | GlowBal Education',
  description:
    'Terms and Conditions of Use for the GlowBal Education Platform — The terms that govern your use of GlowBal platform and services.',
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms and Conditions of Use"
      lastUpdated="August 15, 2026"
      intro={
        <p className="leading-relaxed">
          By accessing, registering for, or using the GlowBal Education platform (“GlowBal”, “Platform”, “we”, “us”), including the website, applications, and related services (“Services”), the User (“You”, “User”) confirms that they have read, understood, and agreed to comply with these Terms and Conditions of Use (“Terms”). If you do not agree with any part of these Terms, please do not use the Services.
        </p>
      }
      sections={[
        {
          heading: '1. Acceptance of Terms',
          body: (
            <p>
              By accessing, registering for, or using the GlowBal Education platform, you acknowledge and agree to be bound by these Terms and Conditions of Use.
            </p>
          ),
        },
        {
          heading: '2. Definitions',
          body: (
            <ul className="list-disc pl-5 space-y-1.5">
              <li><b>“Platform”</b>: the website, application, and technology ecosystem operated by GlowBal Education.</li>
              <li><b>“Services”</b>: all features, digital tools, mentoring connections, and guidance products provided on the Platform.</li>
              <li><b>“Content”</b>: information, data, copy, images, videos, software, documents, and resources available on the Platform.</li>
              <li><b>“User”</b>: any individual who registers or uses the Services, whether free or paid.</li>
              <li><b>“Mentor / Advisor”</b>: individuals or organizations offering advisory guidance and feedback through the Platform.</li>
              <li><b>“Educational Institution”</b>: universities, colleges, scholarship organizations, and academic entities referenced on the Platform.</li>
            </ul>
          ),
        },
        {
          heading: '3. Eligibility and Account Terms',
          body: (
            <div className="space-y-2">
              <p>GlowBal is intended for users aged 16 and above. Users confirm they possess legal capacity, provide truthful details, and maintain security over their accounts.</p>
              <p>Users between 16 and 18 years of age are encouraged to use the Platform under parental or guardian supervision, especially for paid plans or direct mentor sessions.</p>
            </div>
          ),
        },
        {
          heading: '4. Scope of Services',
          body: (
            <div className="space-y-2">
              <p>GlowBal provides technology tools to guide students through the university and scholarship application journey:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><b>GlowBal Matcher:</b> intelligent discovery for target universities, scholarships, and mentors;</li>
                <li><b>Strategy Master:</b> profile diagnostics, strategic narratives, milestone timelines, CV, essays, and recommendation letters support;</li>
                <li><b>My Portal:</b> centralized selection tracker, application portfolio, and document vault;</li>
                <li>Comprehensive database of global universities and scholarships with AI assistance tools.</li>
              </ul>
              <p className="text-xs text-slate-500 italic">Services are designed for preparation and guidance and do not constitute formal legal or financial advice.</p>
            </div>
          ),
        },
        {
          heading: '5. Role of GlowBal',
          body: (
            <p>
              GlowBal is a technology and educational guidance platform. GlowBal is not a university, scholarship provider, admissions committee, or visa authority, and does not make final admission or visa determinations. All admissions and funding decisions belong solely to the respective institutions and authorities.
            </p>
          ),
        },
        {
          heading: '6. No Guarantee of Outcomes',
          body: (
            <p>
              GlowBal does not guarantee university admission, scholarship awards, visa approval, or specific score improvements. Recommendations are advisory and analytical. Users are responsible for independently verifying all dates, requirements, and official instructions.
            </p>
          ),
        },
        {
          heading: '7. User Responsibilities',
          body: (
            <p>
              Users agree to provide genuine materials, refrain from submitting fraudulent records, track deadlines independently, and preserve platform security and integrity.
            </p>
          ),
        },
        {
          heading: '8. Refund Policy',
          body: (
            <div className="space-y-2 rounded-xl border border-rose-100 bg-rose-50/50 p-4">
              <p><b>8.1. Timeframe:</b> Refund requests must be submitted within 24 hours of payment.</p>
              <p><b>8.2. Refund Rate:</b> 90% of the paid fee is refunded (10% is retained to cover payment gateway processing and operating costs).</p>
              <p><b>8.3. Request Process:</b> Send an email to <b>glowbal.edu@gmail.com</b> with subject line <code>[REFUND REQUEST] – Full Name – Account Email</code> along with transaction details.</p>
              <p><b>8.4. Processing Time:</b> 07–14 business days back to the original payment method or a verified alternative.</p>
              <p><b>8.5. Ineligibility:</b> Requests sent after 24 hours, unverified transactions, fraudulent activity, or violations of Terms are non-refundable.</p>
            </div>
          ),
        },
        {
          heading: '9. Account Deferral Policy',
          body: (
            <p>
              Users may request an account deferral for up to 06 months from the payment date. Account benefits and subscriptions are strictly non-transferable.
            </p>
          ),
        },
        {
          heading: '10. Intellectual Property',
          body: (
            <p>
              All software, content, branding, designs, frameworks, and digital assets on the Platform belong exclusively to GlowBal Education or its lawful licensors and are protected under international intellectual property law.
            </p>
          ),
        },
        {
          heading: '11. Privacy and Data Protection',
          body: (
            <p>
              GlowBal processes personal data in accordance with our Privacy Policy published on the Platform, maintaining technical and organizational security standards.
            </p>
          ),
        },
        {
          heading: '12. Limitation of Liability',
          body: (
            <p>
              To the maximum extent permitted by applicable law, GlowBal’s total liability to any User shall not exceed the total fees paid by such User to GlowBal in the preceding 06 months.
            </p>
          ),
        },
        {
          heading: '13. Force Majeure',
          body: (
            <p>
              GlowBal is not liable for service delays or interruptions caused by events beyond reasonable control, including natural disasters, third-party infrastructure outages, or third-party AI/API policy modifications.
            </p>
          ),
        },
        {
          heading: '14 - 19. Suspension, Termination & Governing Law',
          body: (
            <p>
              GlowBal reserves the right to suspend or terminate accounts in breach of these Terms. These Terms are governed by the laws of the Socialist Republic of Vietnam. Any dispute will first be resolved through friendly mutual negotiation.
            </p>
          ),
        },
        {
          heading: '20. Contact Information',
          body: (
            <div className="space-y-1 font-medium">
              <p><b>GLOWBAL EDUCATION</b></p>
              <p>📧 Email: <a href="mailto:glowbal.edu@gmail.com" className="text-[#E11D48] underline">glowbal.edu@gmail.com</a></p>
              <p>🌐 Website: <a href="https://glowbal-education.com" className="text-[#E11D48] underline">GlowBal Education</a></p>
              <p className="mt-2 text-slate-500">GO GLOW – GO GLOBAL ✈️🌍</p>
            </div>
          ),
        },
      ]}
    />
  );
}
