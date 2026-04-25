export default function UniversitiesPage() {
  return (
    <main className="min-h-screen bg-transparent px-6 py-16 md:px-10">
      <div className="mx-auto max-w-4xl">
        <div className="glow-card text-center space-y-6 py-16">
          <div>
            <span className="glow-pill">Coming soon</span>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-900">
              University search
            </h1>
            <p className="mt-4 text-slate-500 leading-7 max-w-md mx-auto">
              Search and compare universities worldwide — filtered by subject, country, budget, and your personal profile. This feature is in development.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 max-w-lg mx-auto pt-4">
            {[
              { label: 'Global coverage', desc: 'Universities across every continent' },
              { label: 'Smart filters',   desc: 'Match to your goals and budget' },
              { label: 'Side-by-side',    desc: 'Compare courses and entry requirements' },
            ].map((f) => (
              <div key={f.label} className="glow-muted-card text-center space-y-1">
                <p className="text-sm font-semibold text-slate-800">{f.label}</p>
                <p className="text-xs text-slate-400 leading-snug">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
