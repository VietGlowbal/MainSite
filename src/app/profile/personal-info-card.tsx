'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

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
    <section className="glow-card space-y-1">
      <div className="flex items-center justify-between pb-3">
        <h2 className="text-xl font-semibold text-slate-900">Personal information</h2>
        {saving && <span className="text-xs text-slate-400">Saving…</span>}
      </div>

      {FIELDS.map((field) => (
        <div key={field.key} className="profile-info-row group">
          <span className="profile-info-label shrink-0">{field.label}</span>

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
              className="profile-info-value text-right hover:text-pink-500 transition-colors cursor-pointer group-hover:underline decoration-dotted underline-offset-2"
              title={`Edit ${field.label}`}
            >
              {values[field.key] || <span className="text-slate-300 italic">Add {field.label.toLowerCase()}</span>}
            </button>
          )}
        </div>
      ))}

      {/* Email — read only */}
      <div className="profile-info-row">
        <span className="profile-info-label">Email</span>
        <span className="profile-info-value text-slate-400">{initialData.email}</span>
      </div>

      {/* Member since — read only */}
      <div className="profile-info-row">
        <span className="profile-info-label">Member since</span>
        <span className="profile-info-value">{initialData.memberSince}</span>
      </div>
    </section>
  );
}
