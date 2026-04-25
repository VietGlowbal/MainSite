import { DesignCosmos } from '@/components/landing/design-cosmos';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/send-email';
import { waitlistConfirmationEmail } from '@/lib/emails/waitlist-confirmation';
import type { WaitlistState } from '@/lib/types';

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
    const { error, data } = await supabase.from('waitlist_signups').upsert(
      { email, first_name: firstName || null, notes: notes || null, source: 'website_waitlist' },
      { onConflict: 'email', ignoreDuplicates: true, returning: 'representation' },
    );

    if (error) {
      if (error.code === '42P01') {
        return { status: 'error', message: 'The waitlist table is not set up yet. Create `waitlist_signups` in Supabase.' };
      }
      return { status: 'error', message: 'Something went wrong saving your signup. Please try again.' };
    }

    // Only send confirmation email on a fresh signup (not a duplicate)
    const isNew = Array.isArray(data) && data.length > 0;
    if (isNew) {
      await sendEmail({
        to: email,
        subject: "You're on the Glowbal waitlist 🌍",
        html: waitlistConfirmationEmail(firstName),
      });
    }

    return { status: 'ok', message: "You're on the list. We'll keep you posted." };
  } catch {
    return { status: 'error', message: 'Something went wrong saving your signup. Please try again.' };
  }
}

export default function Home() {
  return <DesignCosmos action={joinWaitlist} />;
}
