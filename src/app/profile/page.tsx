import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { UploadDocumentForm } from './upload-document-form';
import { AchievementsForm } from './achievements-form';
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

  // Calculate profile completion
  const completionChecks = [
    !!profile?.study_level,
    !!profile?.location,
    !!profile?.nationality,
    !!profile?.bio,
    documents.length > 0,
    (profile?.achievements?.length ?? 0) > 0,
    (profile?.skills?.length ?? 0) > 0,
    !!profile?.target_subjects?.length,
  ];
  const completionPercentage = Math.round((completionChecks.filter(Boolean).length / completionChecks.length) * 100);

  return (
    <main className="profile-page-v2">
      <div className="profile-container">
        <div className="profile-grid">
          {/* Sidebar */}
          <AppSidebar isMentor={!!mentorSummary} />

          {/* Main Content */}
          <div className="profile-content">
            {/* Hero Section */}
            <section className="profile-hero-card">
              <div className="profile-hero-header">
                <ProfileAvatar displayName={displayName} initials={initials} avatarUrl={avatarUrl} />
                
                <div className="profile-hero-info">
                  <div className="profile-hero-badge">My Profile</div>
                  <h1 className="profile-hero-name">{displayName}</h1>
                  <p className="profile-hero-email">{user.email}</p>
                  {profile?.bio && (
                    <p className="profile-hero-bio">{profile.bio}</p>
                  )}
                  
                  <div className="profile-hero-actions">
                    {mentorSummary && (
                      <Link href="/dashboard/mentor" className="profile-mentor-badge">
                        {mentorSummary.status === 'approved' ? '✨ Mentor dashboard' : `Mentor: ${mentorSummary.status}`}
                      </Link>
                    )}
                    <SignOutButton className="profile-action-button" />
                  </div>
                </div>
              </div>

              </div>

              {/* Profile Strength Card */}
              <div className="profile-strength-card">
                <div className="profile-strength-header">
                  <div>
                    <h3 className="profile-strength-title">Profile strength</h3>
                    <p className="profile-strength-subtitle">
                      {completionPercentage < 50 
                        ? 'Complete your profile to get better matches' 
                        : completionPercentage < 80 
                        ? 'Good progress! Keep going' 
                        : 'Excellent! Your profile is strong'}
                    </p>
                  </div>
                  <div className="profile-strength-percentage">
                    <svg className="profile-strength-circle" viewBox="0 0 100 100">
                      <circle className="profile-strength-circle-bg" cx="50" cy="50" r="45" />
                      <circle 
                        className="profile-strength-circle-fill" 
                        cx="50" 
                        cy="50" 
                        r="45"
                        style={{ 
                          strokeDasharray: `${completionPercentage * 2.827}, 282.7`,
                          transform: 'rotate(-90deg)',
                          transformOrigin: '50% 50%'
                        }}
                      />
                    </svg>
                    <span className="profile-strength-number">{completionPercentage}%</span>
                  </div>
                </div>

                <div className="profile-strength-checklist">
                  {[
                    { label: 'Personal information', done: !!profile?.location && !!profile?.nationality },
                    { label: 'Academic background', done: !!profile?.study_level && !!profile?.target_subjects?.length },
                    { label: 'Target preferences', done: !!profile?.preferred_countries?.length },
                    { label: 'Bio added', done: !!profile?.bio },
                    { label: 'Documents uploaded', done: documents.length > 0 },
                    { label: 'Achievements', done: (profile?.achievements?.length ?? 0) > 0 },
                    { label: 'Skills listed', done: (profile?.skills?.length ?? 0) > 0 },
                  ].map((item) => (
                    <div key={item.label} className={`profile-checklist-item ${item.done ? 'completed' : ''}`}>
                      <div className="profile-checklist-icon">
                        {item.done ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        ) : (
                          <div className="profile-checklist-dot" />
                        )}
                      </div>
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>

                {completionPercentage < 100 && (
                  <button className="profile-improve-button">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2v20M2 12h20" />
                    </svg>
                    Complete missing sections
                  </button>
                )}
              </div>
            </section>
            </section>

            {/* Info Cards Grid */}
            <div className="profile-cards-grid">
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

              <section className="profile-info-card">
                <div className="profile-card-header">
                  <div className="profile-card-icon profile-card-icon-purple">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                      <path d="M6 12v5c3 3 9 3 12 0v-5" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="profile-card-title">Academic profile</h2>
                    <p className="profile-card-subtitle">Your educational background and goals</p>
                  </div>
                  <Link href="/onboarding" className="profile-edit-button">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    Edit
                  </Link>
                </div>
                <div className="profile-info-list">
                  <div className="profile-info-item">
                    <span className="profile-info-label">Study level</span>
                    <span className="profile-info-value">{profile?.study_level || '—'}</span>
                  </div>
                  <div className="profile-info-item">
                    <span className="profile-info-label">Target subjects</span>
                    <span className="profile-info-value">
                      {profile?.target_subjects?.length ? profile.target_subjects.join(', ') : '—'}
                    </span>
                  </div>
                  <div className="profile-info-item">
                    <span className="profile-info-label">Preferred countries</span>
                    <span className="profile-info-value">
                      {profile?.preferred_countries?.length ? profile.preferred_countries.join(', ') : '—'}
                    </span>
                  </div>
                  <div className="profile-info-item">
                    <span className="profile-info-label">Budget range</span>
                    <span className="profile-info-value">{profile?.budget_range || '—'}</span>
                  </div>
                </div>
              </section>
            </div>

            {/* Achievements & Skills */}
            <AchievementsForm
              userId={user.id}
              initialAchievements={profile?.achievements ?? []}
              initialSkills={profile?.skills ?? []}
            />

            />

            {/* Documents Section */}
            <div className="profile-cards-grid">
              <section className="profile-info-card">
                <div className="profile-card-header">
                  <div className="profile-card-icon profile-card-icon-blue">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                      <polyline points="13 2 13 9 20 9" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="profile-card-title">Upload documents</h2>
                    <p className="profile-card-subtitle">Add your CV and supporting documents</p>
                  </div>
                </div>
                <div className="profile-upload-tip">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 16v-4M12 8h.01" />
                  </svg>
                  <p>Uploading your CV can improve your match scores by up to 25%</p>
                </div>
                <UploadDocumentForm />
              </section>

              <section className="profile-info-card">
                <div className="profile-card-header">
                  <div className="profile-card-icon profile-card-icon-green">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="profile-card-title">Your documents</h2>
                    <p className="profile-card-subtitle">{documents.length} file{documents.length !== 1 ? 's' : ''} uploaded</p>
                  </div>
                </div>

                </div>

                {cvDocs.length > 0 && (
                  <div className="profile-doc-section">
                    <h3 className="profile-doc-section-title">CV / Résumé</h3>
                    <div className="profile-doc-list">
                      {cvDocs.map((doc) => (
                        <div key={doc.id} className="profile-doc-item">
                          <div className="profile-doc-icon">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                              <polyline points="14 2 14 8 20 8" />
                            </svg>
                          </div>
                          <div className="profile-doc-info">
                            <p className="profile-doc-name">{doc.file_name}</p>
                            <p className="profile-doc-date">{new Date(doc.created_at).toLocaleDateString('en-GB')}</p>
                          </div>
                          <span className="profile-doc-badge profile-doc-badge-pink">CV</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {sopDocs.length > 0 && (
                  <div className="profile-doc-section">
                    <h3 className="profile-doc-section-title">Statement of Purpose</h3>
                    <div className="profile-doc-list">
                      {sopDocs.map((doc) => (
                        <div key={doc.id} className="profile-doc-item">
                          <div className="profile-doc-icon">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                              <polyline points="14 2 14 8 20 8" />
                            </svg>
                          </div>
                          <div className="profile-doc-info">
                            <p className="profile-doc-name">{doc.file_name}</p>
                            <p className="profile-doc-date">{new Date(doc.created_at).toLocaleDateString('en-GB')}</p>
                          </div>
                          <span className="profile-doc-badge profile-doc-badge-blue">SOP</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                )}

                {statements.length > 0 && (
                  <div className="profile-doc-section">
                    <h3 className="profile-doc-section-title">AI Writer drafts</h3>
                    <div className="profile-doc-list">
                      {statements.map((s) => (
                        <div key={s.id} className="profile-doc-item">
                          <div className="profile-doc-icon">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 20h9" />
                              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                            </svg>
                          </div>
                          <div className="profile-doc-info">
                            <p className="profile-doc-name">{s.title}</p>
                            <p className="profile-doc-date">
                              {s.user_universities?.university?.name ?? 'Universal'} · {new Date(s.updated_at).toLocaleDateString('en-GB')}
                            </p>
                          </div>
                          {s.user_university_id ? (
                            <Link href={`/my-universities/${s.user_university_id}/writer`} className="profile-doc-edit">
                              Edit
                            </Link>
                          ) : (
                            <span className="profile-doc-badge profile-doc-badge-purple">Draft</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {documents.length === 0 && statements.length === 0 && (
                  <div className="profile-empty-state">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                      <polyline points="13 2 13 9 20 9" />
                    </svg>
                    <p>No documents uploaded yet</p>
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
