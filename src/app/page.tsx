import { WaitlistForm } from '@/components/waitlist-form';
import { createAdminClient } from '@/lib/supabase/admin';

const featureCards = [
  {
    title: 'Explore with confidence',
    description:
      'Glowbal is being built to help students move from vague ambition to real direction with less stress and more clarity.',
  },
  {
    title: 'Understand the why',
    description:
      'Recommendations should feel personal and explainable, with reasons that actually help people choose well.',
  },
  {
    title: 'Move faster without guessing',
    description:
      'The goal is a smoother route from curiosity to shortlist, without the chaos of scattered tabs and conflicting advice.',
  },
];

const launchPoints = [
  'A cleaner, more guided first experience',
  'Better-fit country and course discovery',
  'Shortlists that feel clearer and more human',
];

type WaitlistState = {
  status: 'idle' | 'ok' | 'error';
  message: string;
};

async function joinWaitlist(_prevState: WaitlistState, formData: FormData): Promise<WaitlistState> {
  'use server';

  const email = String(formData.get('email') || '').trim().toLowerCase();
  const firstName = String(formData.get('firstName') || '').trim();
  const notes = String(formData.get('notes') || '').trim();

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!emailOk) {
    return { status: 'error', message: 'Please enter a valid email address.' };
  }

  try {
    const supabase = createAdminClient();
    const payload = {
      email,
      first_name: firstName || null,
      notes: notes || null,
      source: 'website_waitlist',
    };

    const { error } = await supabase.from('waitlist_signups').upsert(payload, {
      onConflict: 'email',
      ignoreDuplicates: false,
    });

    if (!error) {
      return { status: 'ok', message: 'You’re on the list. We’ll keep you posted.' };
    }

    if (error.code === '42P01') {
      return {
        status: 'error',
        message:
          'The waitlist table is not set up yet. Create `waitlist_signups` in Supabase and this form is ready to go.',
      };
    }

    return { status: 'error', message: 'Something went wrong saving your signup. Please try again.' };
  } catch {
    return { status: 'error', message: 'Something went wrong saving your signup. Please try again.' };
  }
}

export default function Home() {
  return (
    <main className="glowbal-waitlist-page text-slate-800">
      <section className="glowbal-hero-shell mx-auto max-w-6xl px-6 pb-8 pt-8 md:px-10 lg:px-12 lg:pb-12">
        <div className="glowbal-hero-card overflow-hidden rounded-[2.25rem] border border-white/45 bg-white/70 shadow-[0_24px_80px_rgba(22,33,62,0.12)] backdrop-blur-xl">
          <div className="grid lg:grid-cols-[1.08fr_0.92fr]">
            <div className="relative min-h-[420px] overflow-hidden lg:min-h-[680px]">
              <div className="glowbal-hero-image" />
              <div className="glowbal-hero-overlay" />
              <div className="relative z-10 flex h-full flex-col justify-end p-8 md:p-10 lg:p-12">
                <span className="inline-flex w-fit rounded-full border border-white/35 bg-white/14 px-4 py-1 text-sm font-semibold text-white/95 backdrop-blur">
                  Glowbal is opening soon
                </span>
                <div className="mt-6 max-w-2xl space-y-5 text-white">
                  <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl lg:text-6xl">
                    A cleaner, calmer way to discover where life after school could take you.
                  </h1>
                  <p className="max-w-xl text-base leading-7 text-white/86 md:text-lg">
                    Glowbal is being rebuilt to help students explore countries, courses, and next steps with more
                    confidence, more warmth, and much less overwhelm.
                  </p>
                  <div className="flex flex-wrap gap-3 text-sm text-white/90">
                    <span className="inline-flex items-center rounded-full border border-white/30 bg-white/14 px-4 py-2 backdrop-blur">
                      Early access for students, parents, and counsellors
                    </span>
                    <span className="inline-flex items-center rounded-full border border-white/30 bg-white/14 px-4 py-2 backdrop-blur">
                      Join now and get first access when invites open
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white/92 p-6 md:p-8 lg:p-10">
              <div className="mx-auto flex h-full max-w-xl flex-col justify-between gap-8">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-500">Waitlist</p>
                  <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Get early access</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-600 md:text-base">
                    Leave your email and a little context, and we’ll let you know as soon as Glowbal is ready for early
                    access.
                  </p>
                </div>

                <WaitlistForm action={joinWaitlist} />

                <div className="space-y-4">
                  <div className="rounded-[1.5rem] border border-sky-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(144,224,239,0.14))] p-5">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-500">What’s coming</p>
                    <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                      {launchPoints.map((point) => (
                        <li key={point} className="flex gap-3">
                          <span className="mt-2 h-2.5 w-2.5 rounded-full bg-[linear-gradient(135deg,#FF4D8C,#00B4D8)]" />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <p className="text-xs leading-5 text-slate-500">
                    Want to peek at the full product structure? Tap the Glowbal logo in the top bar to reveal the hidden
                    navigation.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-14 md:px-10 lg:px-12">
        <div className="grid gap-5 md:grid-cols-3">
          {featureCards.map((card) => (
            <article
              key={card.title}
              className="rounded-[1.6rem] border border-black/5 bg-white/82 p-6 shadow-[0_12px_32px_rgba(22,33,62,0.06)] backdrop-blur"
            >
              <h3 className="text-xl font-bold text-slate-900">{card.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{card.description}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
