import type { Metadata } from 'next';
import { HomeLanding } from '@/components/landing/home/home-landing';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/send-email';
import { waitlistConfirmationEmail } from '@/lib/emails/waitlist-confirmation';
import type { WaitlistState } from '@/lib/types';

export const metadata: Metadata = {
  title: 'GlowBal | Find Universities, Scholarships & Study Abroad Support',
  description:
    'GlowBal helps students discover global universities, find scholarships, and build application strategies with AI and real student supporters.',
  keywords: [
    'study abroad scholarships',
    'university scholarships',
    'international student scholarships',
    'find universities abroad',
    'AI scholarship application strategy',
    'study abroad support',
    'scholarships for Vietnamese students',
    'global university search',
  ],
};

// The landing roster (team) rarely changes; ISR keeps the page prerendered
// while letting the cached Supabase team query refresh in the background.
export const revalidate = 43200;

async function joinWaitlist(_prevState: WaitlistState, formData: FormData): Promise<WaitlistState> {
  'use server';

  const email = String(formData.get('email') || '').trim().toLowerCase();
  const firstName = String(formData.get('firstName') || '').trim();
  const notes = String(formData.get('notes') || '').trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: 'error', message: 'Please enter a valid email address.' };
  }

  try {
    const supabase = createAdminClient();

    // Try insert first — if it succeeds it's a new signup, send the email
    const { error: insertError } = await supabase.from('waitlist_signups').insert(
      { email, first_name: firstName || null, notes: notes || null, source: 'website_waitlist' },
    );

    const isNew = !insertError;

    // If duplicate, update notes/name silently
    if (insertError && insertError.code === '23505') {
      await supabase.from('waitlist_signups').update(
        { first_name: firstName || null, notes: notes || null },
      ).eq('email', email);
    } else if (insertError) {
      if (insertError.code === '42P01') {
        return { status: 'error', message: 'The waitlist table is not set up yet. Create `waitlist_signups` in Supabase.' };
      }
      return { status: 'error', message: 'Something went wrong saving your signup. Please try again.' };
    }

    if (isNew) {
      await sendEmail({
        to: email,
        subject: "You're on the GLOWBAL waitlist",
        html: waitlistConfirmationEmail(firstName),
      });
    }

    return { status: 'ok', message: "You're on the list. We'll keep you posted." };
  } catch {
    return { status: 'error', message: 'Something went wrong saving your signup. Please try again.' };
  }
}

export default function Home() {
  return <HomeLanding action={joinWaitlist} />;
}
