import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { UploadDocumentForm } from './upload-document-form';
import { AchievementsForm } from './achievements-form';
import { ProfileStickyBar } from './profile-sticky-bar';
import { ProfileAvatar } from './profile-avatar';
import { PersonalInfoCard } from './personal-info-card';
import Link from 'next/link';
import type { UploadedDocument } from '@/lib/types';

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/auth');

  const [profileResult, documentsResult] = await Promise.all([
    supabase.from('student_profiles').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('uploaded_documents').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
  ]);

  const profile = profileResult.data;
  const documents = (documentsResult.data ?? []) as UploadedDocument[];

  const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Student';
  const avatarUrl = user.user_metadata?.avatar_url as string | undefined;
  const initials = displayName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

  const cvDocs = documents.filter((d) => d.type === 'cv');
  const sopDocs = documents.filter((d) => d.type === 'statement_of_purpose');

  return (
    <>
      {/* Sticky mini bar — client component, fixed position */}
      <ProfileStickyBar
        displayName={displayName}
        email={user.email ?? ''}
        initials={initials}
        avatarUrl={avatarUrl}
        docCount={documents.length}
        hasProfile={!!profile}
      />

      <main className="min-h-screen bg-transparent px-6 py-12 text-slate-800 md:px-10">
        <div className="mx-auto max-w-5xl space-y-8">

          {/* ── Hero card ── */}
          <section className="glow-card flex flex-col items-center gap-6 text-center sm:flex-row sm:text-left">
            <ProfileAvatar displayName={displayName} initials={initials} avatarUrl={avatarUrl} />

            <div className="flex-1 min-w-0">
              <span className="glow-pill">My profile</span>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 truncate">{displayName}</h1>
              <p className="mt-1 text-sm text-slate-500">{user.email}</p>
              {profile?.bio && (
                <p className="mt-3 text-sm leading-relaxed text-slate-600 max-w-prose">{profile.bio}</p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <a href="/auth" className="glow-button-secondary text-xs px-3 py-1.5">Sign out</a>
                <button
                  className="glow-button-secondary text-xs px-3 py-1.5"
                  style={{ color: 'rgb(239 68 68)', borderColor: 'rgb(254 226 226)' }}
                  type="button"
                >
                  Delete account
                </button>
              </div>
            </div>

            <div className="flex shrink-0 gap-6 text-center">
              <div>
                <p className="text-2xl font-semibold text-slate-900">{documents.length}</p>
                <p className="text-xs text-slate-500 mt-0.5">Documents</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-slate-900">{profile ? 'Yes' : '—'}</p>
                <p className="text-xs text-slate-500 mt-0.5">Profile set</p>
              </div>
            </div>
          </section>

          {/* ── Info grid ── */}
          <div className="grid gap-8 lg:grid-cols-2">
            <PersonalInfoCard
              userId={user.id}
              initialData={{
                full_name:   user.user_metadata?.full_name ?? '',
                email:       user.email ?? '',
                location:    profile?.location ?? '',
                nationality: profile?.nationality ?? '',
                bio:         profile?.bio ?? '',
                memberSince: new Date(user.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
              }}
            />

            <section className="glow-card space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-900">Academic profile</h2>
                <Link
                  href="/onboarding"
                  className="glow-button-secondary text-xs px-3 py-1.5"
                >
                  Redo onboarding
                </Link>
              </div>
              <div className="space-y-1 text-sm">
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

          {/* ── Achievements & skills ── */}
          <AchievementsForm
            userId={user.id}
            initialAchievements={profile?.achievements ?? []}
            initialSkills={profile?.skills ?? []}
          />

          {/* ── Documents ── */}
          <div className="grid gap-8 lg:grid-cols-2">
            <UploadDocumentForm />

            <section className="glow-card space-y-5">
              <h2 className="text-xl font-semibold text-slate-900">Your documents</h2>

              {cvDocs.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">CV / Résumé</h3>
                  <ul className="space-y-2">
                    {cvDocs.map((doc) => (
                      <li key={doc.id} className="glow-muted-card text-sm flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 truncate">{doc.file_name}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{new Date(doc.created_at).toLocaleDateString('en-GB')}</p>
                        </div>
                        <span className="shrink-0 rounded-full bg-pink-50 border border-pink-200 px-2 py-0.5 text-xs font-semibold text-pink-600">CV</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {sopDocs.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Statement of Purpose</h3>
                  <ul className="space-y-2">
                    {sopDocs.map((doc) => (
                      <li key={doc.id} className="glow-muted-card text-sm flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 truncate">{doc.file_name}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{new Date(doc.created_at).toLocaleDateString('en-GB')}</p>
                        </div>
                        <span className="shrink-0 rounded-full bg-sky-50 border border-sky-200 px-2 py-0.5 text-xs font-semibold text-sky-600">SOP</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {documents.length === 0 && (
                <p className="text-sm text-slate-400 italic">No documents uploaded yet.</p>
              )}
            </section>
          </div>

        </div>
      </main>
    </>
  );
}
