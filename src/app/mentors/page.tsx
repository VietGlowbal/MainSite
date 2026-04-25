export default function MentorsPage() {
  return (
    <main className="min-h-screen bg-transparent px-6 py-16 md:px-10">
      <div className="mx-auto max-w-4xl space-y-8">

        <div className="glow-card text-center space-y-6 py-16">
          <div>
            <span className="glow-pill">Coming soon</span>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-900">
              Find a mentor
            </h1>
            <p className="mt-4 text-slate-500 leading-7 max-w-md mx-auto">
              Connect with students and graduates who have been through the process. Get real advice on applications, visas, campus life, and more.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 max-w-lg mx-auto pt-4">
            {[
              { label: 'Real experience',   desc: 'Mentors who have studied where you want to go' },
              { label: 'Matched to you',    desc: 'Filtered by subject, country, and background' },
              { label: 'Direct messaging',  desc: 'Ask questions and get honest answers' },
            ].map((f) => (
              <div key={f.label} className="glow-muted-card text-center space-y-1">
                <p className="text-sm font-semibold text-slate-800">{f.label}</p>
                <p className="text-xs text-slate-400 leading-snug">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Demo mentor cards */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-slate-900">Example mentors</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { name: 'Anh Nguyen',     subject: 'Computer Science',  university: 'University of Edinburgh',   country: 'Vietnam' },
              { name: 'James Okafor',   subject: 'Business',          university: 'Warwick Business School',   country: 'Nigeria' },
              { name: 'Sofia Reyes',    subject: 'Medicine',          university: 'University of Amsterdam',   country: 'Mexico' },
              { name: 'Priya Sharma',   subject: 'Engineering',       university: 'TU Munich',                 country: 'India' },
              { name: 'Lucas Müller',   subject: 'Architecture',      university: 'ETH Zurich',                country: 'Brazil' },
              { name: 'Yuki Tanaka',    subject: 'Data Science',      university: 'University of Toronto',     country: 'Japan' },
            ].map((mentor) => (
              <article key={mentor.name} className="glow-card space-y-3">
                <div className="flex items-center gap-3">
                  <div
                    style={{
                      width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                      background: 'linear-gradient(135deg, #ff4d8c, #00b4d8)',
                      padding: 2,
                    }}
                  >
                    <div style={{
                      width: '100%', height: '100%', borderRadius: '50%',
                      background: '#fff', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#ff4d8c',
                    }}>
                      {mentor.name.split(' ').map((w) => w[0]).join('')}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 truncate">{mentor.name}</p>
                    <p className="text-xs text-slate-400">{mentor.country}</p>
                  </div>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="profile-info-row">
                    <span className="profile-info-label">Subject</span>
                    <span className="profile-info-value">{mentor.subject}</span>
                  </div>
                  <div className="profile-info-row">
                    <span className="profile-info-label">University</span>
                    <span className="profile-info-value text-xs">{mentor.university}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="glow-button-secondary text-xs px-3 py-1.5 w-full"
                  disabled
                >
                  Message — coming soon
                </button>
              </article>
            ))}
          </div>
        </section>

      </div>
    </main>
  );
}
