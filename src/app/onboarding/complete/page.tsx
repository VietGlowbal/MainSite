import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function OnboardingCompletePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/auth');

  return (
    <main className="min-h-screen bg-transparent px-6 py-16 md:px-10">
      <div className="mx-auto max-w-2xl">
        <div className="glow-card text-center space-y-6 py-12">
          {/* Avatar gradient circle */}
          <div className="mx-auto h-20 w-20 rounded-full flex items-center justify-center text-4xl text-white shadow-[0_16px_40px_rgba(255,77,140,0.24)]"
            style={{ background: 'linear-gradient(135deg, var(--brand-pink), var(--brand-cyan))' }}
          >
            🎉
          </div>

          <div className="space-y-2">
            <span className="glow-pill">You&apos;re all set</span>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              Welcome to GLOWBAL
            </h1>
            <p className="mt-2 text-slate-500 max-w-md mx-auto">
              We&apos;ve got everything we need to start matching you with the right universities.
            </p>
          </div>

          {/* Achievers prompt */}
          <div className="rounded-2xl border border-pink-100 bg-gradient-to-br from-pink-50/50 to-cyan-50/50 p-5 text-left max-w-md mx-auto">
            <div className="flex items-start gap-3">
              <div className="text-2xl">💬</div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-slate-900">
                  Want to talk to someone who&apos;s been there?
                </h3>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  Book a 1-on-1 session with current students and alumni at your target universities. Real advice, no fluff.
                </p>
                <Link
                  href="/mentors"
                  className="mt-3 inline-flex items-center gap-1 rounded-full border border-pink-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-pink-600 hover:bg-pink-50 transition"
                >
                  Browse mentors →
                </Link>
              </div>
            </div>
          </div>

          {/* Primary CTA */}
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <Link
              href="/universities"
              className="glow-button-primary text-sm px-6 py-3"
            >
              See your university matches
            </Link>
            <Link
              href="/apply"
              className="glow-button-secondary text-sm px-6 py-3"
            >
              Go to dashboard
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
