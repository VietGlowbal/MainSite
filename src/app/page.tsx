import { LandingShowcase } from '@/components/landing-showcase';
import { createAdminClient } from '@/lib/supabase/admin';
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
    const { error } = await supabase.from('waitlist_signups').upsert(
      { email, first_name: firstName || null, notes: notes || null, source: 'website_waitlist' },
      { onConflict: 'email', ignoreDuplicates: false },
    );

    if (!error) return { status: 'ok', message: "You're on the list. We'll keep you posted." };

    if (error.code === '42P01') {
      return { status: 'error', message: 'The waitlist table is not set up yet. Create `waitlist_signups` in Supabase.' };
    }

    return { status: 'error', message: 'Something went wrong saving your signup. Please try again.' };
  } catch {
    return { status: 'error', message: 'Something went wrong saving your signup. Please try again.' };
  }
}

export default function Home() {
  return <LandingShowcase action={joinWaitlist} />;
}
