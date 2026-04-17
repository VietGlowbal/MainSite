import { AuthForm } from './auth-form';

export default function AuthPage() {
  return (
    <main className="min-h-screen bg-transparent px-6 py-16 md:px-10">
      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1fr_0.9fr]">
        <section className="rounded-[2rem] border border-black/5 bg-white/80 p-8 shadow-[0_12px_32px_rgba(22,33,62,0.06)] backdrop-blur">
          <span className="rounded-full border border-pink-200 bg-pink-50 px-3 py-1 text-sm font-semibold text-pink-600">
            Auth foundation
          </span>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-slate-900">
            Create your Glowbal account
          </h1>
          <p className="mt-4 max-w-xl leading-7 text-slate-600">
            We are wiring the real product flow now. Sign in will unlock onboarding,
            profile persistence, saved options, and recommendation history.
          </p>
        </section>

        <AuthForm />
      </div>
    </main>
  );
}
