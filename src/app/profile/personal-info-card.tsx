'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useLoadingIndicator } from '@/shared/ui/loading-overlay';

interface Props {
  userId: string;
  initialData: {
    full_name: string;
    email: string;
    location: string;
    nationality: string;
    bio: string;
    memberSince: string;
  };
}

interface Field {
  key: 'full_name' | 'location' | 'nationality' | 'bio';
  label: string;
  multiline?: boolean;
}

const FIELDS: Field[] = [
  { key: 'full_name',    label: 'Full name' },
  { key: 'location',    label: 'Location' },
  { key: 'nationality', label: 'Nationality' },
  { key: 'bio',         label: 'Bio', multiline: true },
];

export function PersonalInfoCard({ userId, initialData }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [editing, setEditing] = useState<Field['key'] | null>(null);
  const [values, setValues] = useState({
    full_name:   initialData.full_name,
    location:    initialData.location,
    nationality: initialData.nationality,
    bio:         initialData.bio,
  });
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  useLoadingIndicator(saving, 'Saving your profile');

  const startEdit = (key: Field['key']) => {
    setDraft(values[key]);
    setEditing(key);
  };

  const cancelEdit = () => setEditing(null);

  const saveEdit = async (key: Field['key']) => {
    setSaving(true);
    const next = { ...values, [key]: draft };
    setValues(next);
    setEditing(null);

    if (key === 'full_name') {
      await supabase.auth.updateUser({ data: { full_name: draft } });
    } else {
      await supabase.from('student_profiles').upsert(
        { user_id: userId, [key]: draft },
        { onConflict: 'user_id' },
      );
    }
    setSaving(false);
  };

  return (
    <section className="profile-info-card">
      <div className="profile-card-header">
        <div className="profile-card-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
        <div>
          <h2 className="profile-card-title">Personal information</h2>
          <p className="profile-card-subtitle">Your basic details and contact info</p>
        </div>
        {saving && <span className="text-xs text-slate-400 ml-auto">Saving…</span>}
      </div>

      <div className="profile-info-list">
        {FIELDS.map((field) => (
          <div key={field.key} className="profile-info-item">
            <span className="profile-info-label">{field.label}</span>

            {editing === field.key ? (
              <div className="flex flex-1 items-start gap-2 justify-end">
                {field.multiline ? (
                  <textarea
                    className="glow-input text-sm flex-1"
                    style={{ minHeight: '4rem', resize: 'vertical' }}
                    value={draft}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDraft(e.target.value)}
                    autoFocus
                  />
                ) : (
                  <input
                    className="glow-input text-sm flex-1"
                    value={draft}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDraft(e.target.value)}
                    onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                      if (e.key === 'Enter') saveEdit(field.key);
                      if (e.key === 'Escape') cancelEdit();
                    }}
                    autoFocus
                  />
                )}
                <div className="flex gap-1 shrink-0 pt-1">
                  <button
                    type="button"
                    onClick={() => saveEdit(field.key)}
                    className="rounded-lg bg-pink-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-pink-600 transition-colors"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="rounded-lg border border-black/8 px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => startEdit(field.key)}
                className="profile-info-value hover:text-pink-500 transition-colors cursor-pointer"
                title={`Edit ${field.label}`}
              >
                {values[field.key] || <span className="text-slate-300 italic">Add {field.label.toLowerCase()}</span>}
              </button>
            )}
          </div>
        ))}

        {/* Email — read only */}
        <div className="profile-info-item">
          <span className="profile-info-label">Email</span>
          <span className="profile-info-value text-slate-400">{initialData.email}</span>
        </div>

        {/* Member since — read only */}
        <div className="profile-info-item">
          <span className="profile-info-label">Member since</span>
          <span className="profile-info-value">{initialData.memberSince}</span>
        </div>
      </div>
    </section>
  );
}
