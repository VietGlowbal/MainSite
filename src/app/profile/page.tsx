import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { UploadDocumentForm } from './upload-document-form';
import { ProfileForm } from './profile-form';

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/auth');

  const [profileResult, documentsResult] = await Promise.all([
    supabase.from('student_profiles').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('uploaded_documents').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
  ]);

  const profile = profileResult.data;
  const documents = documentsResult.data ?? [];

  const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Student';
  const avatarUrl = user.user_metadata?.avatar_url as string | undefined;
  const initials = displayName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <main className="min-h-screen bg-transparent px-6 py-12 text-slate-800 md:px-10">
      <div className="mx-auto max-w-5xl space-y-8">

        {/* ── Hero card ── */}
        <section className="glow-card flex flex-col items-center gap-6 text-center sm:flex-row sm:text-left">
          {/* Avatar */}
          <div className="profile-avatar-ring shrink-0">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt={displayName} className="profile-avatar-img" />
            ) : (
              <span className="profile-avatar-initials" aria-label={displayName}>{initials}</span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <span className="glow-pill">My profile</span>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 truncate">{displayName}</h1>
            <p className="mt-1 text-sm text-slate-500">{user.email}</p>
            {profile?.bio && (
              <p className="mt-3 text-sm leading-relaxed text-slate-600 max-w-prose">{profile.bio}</p>
            )}
          </div>

          {/* Quick stats */}
          <div className="flex shrink-0 gap-6 text-center">
            <div>
              <p className="text-2xl font-semibold text-slate-900">{documents.length}</p>
              <p className="text-xs text-slate-500 mt-0.5">Documents</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-slate-900">{profile ? '✓' : '—'}</p>
              <p className="text-xs text-slate-500 mt-0.5">Profile set</p>
            </div>
          </div>
        </section>

        <div className="grid gap-8 lg:grid-cols-2">

          {/* ── Personal info ── */}
          <section className="glow-card space-y-5">
            <h2 className="text-xl font-semibold text-slate-900">Personal information</h2>
            <div className="space-y-3 text-sm">
              <div className="profile-info-row">
                <span className="profile-info-label">Full name</span>
                <span className="profile-info-value">{user.user_metadata?.full_name || '—'}</span>
              </div>
              <div className="profile-info-row">
                <span className="profile-info-label">Email</span>
                <span className="profile-info-value">{user.email}</span>
              </div>
              <div className="profile-info-row">
                <span className="profile-info-label">Location</span>
                <span className="profile-info-value">{profile?.location || '—'}</span>
              </div>
              <div className="profile-info-row">
                <span className="profile-info-label">Nationality</span>
                <span className="profile-info-value">{profile?.nationality || '—'}</span>
              </div>
              <div className="profile-info-row">
                <span className="profile-info-label">Member since</span>
                <span className="profile-info-value">
                  {new Date(user.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                </span>
              </div>
            </div>
          </section>

          {/* ── Academic snapshot ── */}
          <section className="glow-card space-y-5">
            <h2 className="text-xl font-semibold text-slate-900">Academic profile</h2>
            <div className="space-y-3 text-sm">
              <div className="profile-info-row">
                <span className="profile-info-label">Study level</span>
                <span className="profile-info-value">{profile?.study_level || '—'}</span>
              </div>
              <div className="profile-info-row">
                <span className="profile-info-label">Target subjects</span>
                <span className="profile-info-value">
                  {profile?.target_subjects?.length ? profile.target_subjects.join(', ') : '—'}
                </span>
              </div>
              <div className="profile-info-row">
                <span className="profile-info-label">Preferred countries</span>
                <span className="profile-info-value">
                  {profile?.preferred_countries?.length ? profile.preferred_countries.join(', ') : '—'}
                </span>
              </div>
              <div className="profile-info-row">
                <span className="profile-info-label">Budget range</span>
                <span className="profile-info-value">{profile?.budget_range || '—'}</span>
              </div>
            </div>
          </section>

        </div>

        {/* ── Edit profile form ── */}
        <ProfileForm
          userId={user.id}
          initialData={{
            full_name: user.user_metadata?.full_name ?? '',
            bio: profile?.bio ?? '',
            location: profile?.location ?? '',
            nationality: profile?.nationality ?? '',
          }}
        />

        {/* ── Documents ── */}
        <div className="grid gap-8 lg:grid-cols-2">
          <UploadDocumentForm />

          <section className="glow-card space-y-4">
            <h2 className="text-xl font-semibold text-slate-900">Uploaded documents</h2>
            {documents.length === 0 ? (
              <p className="text-sm text-slate-500">No documents yet.</p>
            ) : (
              <ul className="space-y-3">
                {documents.map((doc: Record<string, unknown>) => (
                  <li key={doc.id} className="glow-muted-card text-sm">
                    <p className="font-medium text-slate-900 truncate">{doc.file_name}</p>
                    <p className="mt-0.5 text-slate-500">{doc.type} · {new Date(doc.created_at).toLocaleDateString('en-GB')}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* ── Account settings ── */}
        <section className="glow-card space-y-4">
          <h2 className="text-xl font-semibold text-slate-900">Account</h2>
          <div className="flex flex-wrap gap-3">
            <a href="/auth" className="glow-button-secondary text-sm px-4 py-2">Sign out</a>
            <button className="glow-button-secondary text-sm px-4 py-2 text-red-500 border-red-100 hover:bg-red-50" type="button">
              Delete account
            </button>
          </div>
        </section>

      </div>
    </main>
  );
}
