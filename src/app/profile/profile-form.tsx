'use client';

import { FormEvent, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Props {
  userId: string;
  initialData: {
    full_name: string;
    bio: string;
    location: string;
    nationality: string;
  };
}

export function ProfileForm({ userId, initialData }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [fullName, setFullName] = useState(initialData.full_name);
  const [bio, setBio] = useState(initialData.bio);
  const [location, setLocation] = useState(initialData.location);
  const [nationality, setNationality] = useState(initialData.nationality);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const { error } = await supabase
      .from('student_profiles')
      .upsert({ user_id: userId, bio, location, nationality }, { onConflict: 'user_id' });

    if (!error) {
      await supabase.auth.updateUser({ data: { full_name: fullName } });
      setMessage('Profile updated.');
    } else {
      setMessage(error.message);
    }

    setLoading(false);
  };

  return (
    <section className="glow-card">
      <h2 className="text-xl font-semibold text-slate-900">Edit profile</h2>
      <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
        <label className="glow-label">
          Full name
          <input className="glow-input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" />
        </label>
        <label className="glow-label">
          Location
          <input className="glow-input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, Country" />
        </label>
        <label className="glow-label">
          Nationality
          <input className="glow-input" value={nationality} onChange={(e) => setNationality(e.target.value)} placeholder="e.g. Vietnamese" />
        </label>
        <label className="glow-label sm:col-span-2">
          Bio
          <textarea
            className="glow-input glow-textarea"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="A short bio about yourself…"
          />
        </label>
        <div className="sm:col-span-2 flex items-center gap-4">
          <button className="glow-button-primary" type="submit" disabled={loading}>
            {loading ? 'Saving…' : 'Save changes'}
          </button>
          {message && <p className="text-sm text-slate-500">{message}</p>}
        </div>
      </form>
    </section>
  );
}
