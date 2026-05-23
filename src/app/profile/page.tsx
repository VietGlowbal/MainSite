import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { UploadDocumentForm } from './upload-document-form';
import { AchievementsForm } from './achievements-form';
import { ProfileStickyBar } from './profile-sticky-bar';
import { ProfileAvatar } from './profile-avatar';
import { PersonalInfoCard } from './personal-info-card';
import Link from 'next/link';
import type { UploadedDocument } from '@/lib/types';
import { SignOutButton } from '@/components/sign-out-button';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { getMentorSummary } from '@/lib/mentor-status';

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/auth');

  const [profileResult, documentsResult, statementsResult, mentorSummary] = await Promise.all([
    supabase.from('student_profiles').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('uploaded_documents').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase
      .from('personal_statements')
      .select('id, title, doc_type, updated_at, user_university_id, user_universities:user_universities!personal_statements_user_university_id_fkey(id, university:universities(name))')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false }),
    getMentorSummary(),
  ]);

  const profile = profileResult.data;
  const documents = (documentsResult.data ?? []) as UploadedDocument[];
  type StatementRow = {
    id: number;
    title: string;
    doc_type: string;
    updated_at: string;
    user_university_id: number | null;
    user_universities: { id: number; university: { name: string } | null } | null;
  };
  const statements = (statementsResult.data ?? []) as unknown as StatementRow[];

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

      <main className="min-h-screen bg-transparent px-4 py-6 text-slate-800 md:px-8 md:py-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
            <AppSidebar isMentor={!!mentorSummary} />

            <div className="space-y-8 min-w-0">

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
                {mentorSummary && (
                  <Link
                    href="/dashboard/mentor"
                    className="inline-flex items-center gap-1.5 rounded-full bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] px-3 py-1.5 text-xs font-semibold text-white shadow-[0_6px_18px_rgba(255,77,140,0.22)] transition hover:-translate-y-0.5"
                  >
                    {mentorSummary.status === 'approved' ? '✨ Mentor dashboard' : `Mentor application: ${mentorSummary.status}`}
                  </Link>
                )}
                <SignOutButton className="glow-button-secondary text-xs px-3 py-1.5" />
                <button
                  className="glow-button-secondary text-xs px-3 py-1.5"
                  style={{ color: 'rgb(239 68 68)', borderColor: 'rgb(254 226 226)' }}
                  type="button"
                >
                  Delete account
                </button>
              </div>
            </div>

            <div className="flex shrink-0 flex-col gap-3 min-w-[200px]">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600">Profile strength</span>
                  <span className="text-xs font-bold text-pink-600">
                    {Math.round(([
                      !!profile?.study_level,
                      !!profile?.location,
                      !!profile?.nationality,
                      documents.length > 0,
                      (profile?.achievements?.length ?? 0) > 0,
                    ].filter(Boolean).length / 5) * 100)}%
                  </span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-pink-500 to-blue-400 rounded-full transition-all duration-500"
                    style={{ width: `${Math.round(([
                      !!profile?.study_level,
                      !!profile?.location,
                      !!profile?.nationality,
                      documents.length > 0,
                      (profile?.achievements?.length ?? 0) > 0,
                    ].filter(Boolean).length / 5) * 100)}%` }}
                  />
                </div>
                <div className="grid grid-cols-1 gap-0.5 mt-1">
                  {[
                    { label: 'Profile set', done: !!profile?.study_level },
                    { label: 'Location added', done: !!profile?.location },
                    { label: 'Nationality added', done: !!profile?.nationality },
                    { label: 'Documents uploaded', done: documents.length > 0 },
                    { label: 'Achievements added', done: (profile?.achievements?.length ?? 0) > 0 },
                  ].map((c) => (
                    <p key={c.label} className={`text-[10px] ${c.done ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {c.done ? '✅' : '⬜'} {c.label}
                    </p>
                  ))}
                </div>
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
            <div className="space-y-0">
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700 mb-4">
                💡 Uploading your CV can improve your match scores by up to 25%
              </div>
              <UploadDocumentForm />
            </div>

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

              {/* AI Writer drafts */}
              {statements.length > 0 && (
                <div className="space-y-2 border-t border-slate-100 pt-4">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">AI Writer drafts</h3>
                  <ul className="space-y-2">
                    {statements.map((s) => (
                      <li key={s.id} className="glow-muted-card text-sm flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 truncate">{s.title}</p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {s.user_universities?.university?.name ?? 'Universal draft'} ·{' '}
                            Updated {new Date(s.updated_at).toLocaleDateString('en-GB')}
                          </p>
                        </div>
                        {s.user_university_id ? (
                          <Link
                            href={`/my-universities/${s.user_university_id}/writer`}
                            className="shrink-0 rounded-full border border-pink-200 bg-pink-50 px-2.5 py-1 text-xs font-semibold text-pink-600 hover:bg-pink-100 transition"
                          >
                            Edit
                          </Link>
                        ) : (
                          <span className="shrink-0 rounded-full bg-purple-50 border border-purple-200 px-2 py-0.5 text-xs font-semibold text-purple-600">
                            {s.doc_type === 'statement_of_purpose' ? 'SOP' : 'Statement'}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          </div>

            </div>
          </div>
        </div>
      </main>
    </>
  );
}
