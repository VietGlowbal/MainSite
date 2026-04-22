import { WaitlistForm } from '@/components/waitlist-form';
import { createAdminClient } from '@/lib/supabase/admin';

const featureCards = [
  {
    title: 'Clearer direction',
    description:
      'Students get a gentler way to explore countries, study options, and next steps without the usual overwhelm.',
  },
  {
    title: 'Human-feeling recommendations',
    description:
      'Glowbal is being shaped to explain why an option fits, not just throw a list at someone and hope for the best.',
  },
  {
    title: 'A more supportive journey',
    description:
      'From first interest to shortlist confidence, the experience is being rebuilt to feel calm, modern, and encouraging.',
  },
];

const launchPoints = [
  'Student-first onboarding that feels warm, not bureaucratic',
  'Shortlists with clearer reasoning and confidence cues',
  'A softer, brighter experience built for real decision-making',
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
    <main className="min-h-screen bg-transparent text-slate-800">
      <section className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10 md:px-10 md:py-14 lg:px-12">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-stretch">
          <div className="rounded-[2rem] border border-black/5 bg-white/82 p-8 shadow-[0_16px_50px_rgba(22,33,62,0.08)] backdrop-blur md:p-10">
            <span className="inline-flex w-fit rounded-full border border-pink-200 bg-pink-50 px-4 py-1 text-sm font-semibold text-pink-600">
              Glowbal is opening soon
            </span>
            <div className="mt-6 space-y-5">
              <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 md:text-6xl">
                A calmer, smarter way for students to find the right place to study abroad.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-600 md:text-xl">
                We’re rebuilding Glowbal into a brighter student experience, one that helps people discover better-fit
                countries, courses, and next steps with more confidence and a lot less noise.
              </p>
              <div className="flex flex-wrap gap-3 text-sm text-slate-600">
                <span className="inline-flex items-center rounded-full border border-sky-100 bg-sky-50 px-4 py-2 font-medium text-sky-700">
                  Early access for students, parents, and counsellors
                </span>
                <span className="inline-flex items-center rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 font-medium text-emerald-700">
                  Join now and hear when invites open
                </span>
              </div>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {featureCards.map((card) => (
                <article
                  key={card.title}
                  className="rounded-[1.5rem] border border-black/5 bg-white/85 p-5 shadow-[0_12px_32px_rgba(22,33,62,0.05)]"
                >
                  <h2 className="text-lg font-bold text-slate-900">{card.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{card.description}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-black/5 bg-white/88 p-6 shadow-[0_16px_50px_rgba(22,33,62,0.08)] backdrop-blur md:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-500">Waitlist</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-900">Get early access</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Drop your email and we’ll let you know when Glowbal is ready for early users.
                </p>
              </div>
            </div>

            <WaitlistForm action={joinWaitlist} />

            <div className="mt-6 rounded-[1.5rem] border border-sky-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(144,224,239,0.16))] p-5">
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
          </div>
        </div>
      </section>
    </main>
  );
}
