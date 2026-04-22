import { WaitlistForm } from '@/components/waitlist-form';
import { createAdminClient } from '@/lib/supabase/admin';

const featureCards = [
  {
    title: 'Clearer exploration',
    description:
      'Move from vague ideas to real options with a flow that feels simple, supportive, and easier to trust.',
  },
  {
    title: 'Better-fit choices',
    description:
      'Compare countries, courses, and next steps through a calmer lens that helps the right options stand out.',
  },
  {
    title: 'More human guidance',
    description:
      'Glowbal is being designed to feel thoughtful and encouraging, not like another overwhelming search tool.',
  },
];

const launchPoints = [
  'A more focused student journey',
  'Cleaner country and course discovery',
  'Shortlists with clearer reasoning',
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
      <section className="mx-auto max-w-6xl px-6 pb-10 pt-8 md:px-10 lg:px-12 lg:pb-14">
        <div className="grid gap-6 lg:grid-cols-[1.12fr_0.88fr] lg:items-stretch">
          <div className="overflow-hidden rounded-[2.1rem] border border-white/50 bg-white/68 shadow-[0_24px_80px_rgba(22,33,62,0.10)] backdrop-blur-xl">
            <div className="glowbal-study-hero relative min-h-[420px] lg:min-h-[640px]">
              <div className="glowbal-study-hero-image" />
              <div className="glowbal-study-hero-overlay" />
              <div className="relative z-10 flex h-full flex-col justify-end p-8 md:p-10 lg:p-12">
                <span className="inline-flex w-fit rounded-full border border-white/30 bg-white/14 px-4 py-1 text-sm font-semibold text-white/95 backdrop-blur">
                  Glowbal is opening soon
                </span>
                <div className="mt-6 max-w-2xl space-y-4 text-white">
                  <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl lg:text-[3.7rem] lg:leading-[1.05]">
                    A cleaner way to help students find their next place in the world.
                  </h1>
                  <p className="max-w-xl text-base leading-7 text-white/84 md:text-lg">
                    Glowbal is being rebuilt to make study abroad feel less chaotic and more possible, with a calmer way
                    to explore countries, courses, and next steps.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[2.1rem] border border-black/5 bg-white/92 p-6 shadow-[0_18px_50px_rgba(22,33,62,0.08)] md:p-8 lg:p-10">
            <div className="mx-auto flex h-full max-w-xl flex-col gap-8">
              <div className="space-y-3">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-500">Waitlist</p>
                <h2 className="text-3xl font-bold tracking-tight text-slate-900">Get early access</h2>
                <p className="text-sm leading-6 text-slate-600 md:text-base">
                  Leave your details and we’ll let you know when Glowbal is ready for early users.
                </p>
              </div>

              <WaitlistForm action={joinWaitlist} />

              <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50/80 p-5">
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
                If you want to peek deeper, tap the Glowbal logo in the top bar to reveal the hidden navigation.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-14 md:px-10 lg:px-12">
        <div className="grid gap-4 md:grid-cols-3">
          {featureCards.map((card) => (
            <article
              key={card.title}
              className="rounded-[1.5rem] border border-black/5 bg-white/84 p-6 shadow-[0_12px_30px_rgba(22,33,62,0.05)] backdrop-blur"
            >
              <h3 className="text-lg font-bold text-slate-900">{card.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{card.description}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
