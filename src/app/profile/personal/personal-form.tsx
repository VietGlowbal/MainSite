'use client';

import { useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { StudentProfile } from '@/lib/types';
import { Input, Panel, PanelHeader, Textarea } from '@/shared/ui';
import { useLoadingIndicator } from '@/shared/ui/loading-overlay';
import { SaveBar, type SaveMessage } from '../_form-parts';

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
  const [message, setMessage] = useState<SaveMessage>(null);

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
    <div className="flex flex-col gap-gb-3xl">
      <Panel className="flex flex-col gap-gb-2xl">
        <PanelHeader
          title="Account details"
          description="These come from the account you signed in with and cannot be edited here."
        />
        <div className="grid gap-gb-2xl sm:grid-cols-2">
          <Input
            name="account-name"
            label="Full name"
            value={displayName}
            readOnly
            hint="Set by your sign-in provider."
            className="bg-surface-muted"
          />
          <Input
            name="account-email"
            label="Email address"
            value={email}
            readOnly
            className="bg-surface-muted"
          />
        </div>
      </Panel>

      <Panel className="flex flex-col gap-gb-2xl">
        <PanelHeader title="Personal details" />

        <div className="grid gap-gb-2xl sm:grid-cols-2">
          <Input
            name="phone"
            type="tel"
            label="Phone number"
            placeholder="+84 123 456 789"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Input
            name="date_of_birth"
            type="date"
            label="Date of birth"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
          />
          <Input
            name="location"
            label="Location"
            placeholder="e.g. Hanoi, Vietnam"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
          <Input
            name="nationality"
            label="Nationality"
            placeholder="e.g. Vietnamese"
            value={nationality}
            onChange={(e) => setNationality(e.target.value)}
          />
          <Textarea
            name="bio"
            label="Short bio"
            rows={4}
            placeholder="A few sentences about yourself…"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            fieldClassName="sm:col-span-2"
          />
        </div>

        <SaveBar onSave={handleSave} saving={saving} message={message} />
      </Panel>
    </div>
  );
}
