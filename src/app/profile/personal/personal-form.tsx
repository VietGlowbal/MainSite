'use client';

import { useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { StudentProfile } from '@/lib/types';
import { useLoadingIndicator } from '@/shared/ui';

const INPUT = 'block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-100 transition';
const LABEL = 'block text-xs font-semibold text-slate-700 mb-1.5';

export function PersonalForm({
  userId,
  displayName,
  email,
  initialProfile,
}: {
  userId: string;
  displayName: string;
  email: string;
  initialProfile: StudentProfile | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [phone, setPhone] = useState(initialProfile?.phone ?? '');
  const [dob, setDob] = useState(initialProfile?.date_of_birth ?? '');
  const [location, setLocation] = useState(initialProfile?.location ?? '');
  const [nationality, setNationality] = useState(initialProfile?.nationality ?? '');
  const [bio, setBio] = useState(initialProfile?.bio ?? '');
  const [saving, setSaving] = useState(false);
  useLoadingIndicator(saving, 'Saving your profile');
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    const { error } = await supabase.from('student_profiles').upsert(
      { user_id: userId, phone, date_of_birth: dob || null, location, nationality, bio },
      { onConflict: 'user_id' },
    );
    setMessage(error ? { text: error.message, ok: false } : { text: 'Saved successfully.', ok: true });
    setSaving(false);
  };

  return (
    <div className="space-y-5">
      {/* Read-only auth fields */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
        <h2 className="text-sm font-semibold text-slate-900 mb-4">Account details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={LABEL}>Full name</label>
            <input className={INPUT + ' bg-slate-50 cursor-not-allowed'} value={displayName} readOnly />
            <p className="mt-1 text-[11px] text-slate-400">Name is set via your sign-in provider.</p>
          </div>
          <div>
            <label className={LABEL}>Email address</label>
            <input className={INPUT + ' bg-slate-50 cursor-not-allowed'} value={email} readOnly />
          </div>
        </div>
      </div>

      {/* Editable profile fields */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
        <h2 className="text-sm font-semibold text-slate-900 mb-4">Personal details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={LABEL}>Phone number</label>
            <input
              className={INPUT}
              type="tel"
              placeholder="+84 123 456 789"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div>
            <label className={LABEL}>Date of birth</label>
            <input
              className={INPUT}
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
            />
          </div>
          <div>
            <label className={LABEL}>Location</label>
            <input
              className={INPUT}
              placeholder="e.g. Hanoi, Vietnam"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
          <div>
            <label className={LABEL}>Nationality</label>
            <input
              className={INPUT}
              placeholder="e.g. Vietnamese"
              value={nationality}
              onChange={(e) => setNationality(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={LABEL}>Short bio</label>
            <textarea
              className={INPUT}
              rows={3}
              placeholder="A few sentences about yourself…"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-5 flex items-center gap-4">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-full bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] px-6 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(255,77,140,0.25)] transition hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          {message && (
            <p className={`text-sm ${message.ok ? 'text-green-600' : 'text-red-500'}`}>{message.text}</p>
          )}
        </div>
      </div>
    </div>
  );
}
