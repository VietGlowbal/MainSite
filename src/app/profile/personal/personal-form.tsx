'use client';

import { useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { NATIONALITIES } from '@/lib/nationalities';
import type { StudentProfile } from '@/lib/types';
import { Input, Panel, PanelHeader, Select, Textarea } from '@/shared/ui';
import { useLoadingIndicator } from '@/shared/ui/loading-overlay';
import { SaveBar, SelectOptions, type SaveMessage } from '../_form-parts';

export function PersonalForm({
  userId,
  displayName,
  email,
  initialProfile,
  returnTo,
}: {
  userId: string;
  displayName: string;
  email: string;
  initialProfile: StudentProfile | null;
  returnTo?: string | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [fullName, setFullName] = useState(displayName);
  const [accountEmail, setAccountEmail] = useState(email);
  const savedName = useRef(displayName);
  const savedEmail = useRef(email);
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
    const nextName = fullName.trim();
    const nextEmail = accountEmail.trim();
    if (!nextName || !nextEmail) {
      setMessage({ text: 'Full name and email address are required.', ok: false });
      setSaving(false);
      return;
    }

    const emailChanged = nextEmail !== savedEmail.current;
    const accountChanges = {
      ...(emailChanged ? { email: nextEmail } : {}),
      ...(nextName !== savedName.current ? { data: { full_name: nextName } } : {}),
    };
    if (Object.keys(accountChanges).length) {
      const { error } = await supabase.auth.updateUser(accountChanges);
      if (error) {
        setMessage({ text: error.message, ok: false });
        setSaving(false);
        return;
      }
      savedName.current = nextName;
      savedEmail.current = nextEmail;
    }

    const { error } = await supabase.from('student_profiles').upsert(
      { user_id: userId, phone, date_of_birth: dob || null, location, nationality, bio },
      { onConflict: 'user_id' },
    );
    setMessage(error
      ? { text: error.message, ok: false }
      : {
          text: emailChanged
            ? 'Saved. Check your inbox to confirm your new email address.'
            : 'Saved successfully.',
          ok: true,
        });
    setSaving(false);
  };

  return (
    <div className="flex flex-col gap-gb-3xl">
      <Panel className="flex flex-col gap-gb-2xl">
        <PanelHeader
          title="Account details"
          description="Update your name and email address."
        />
        <div className="grid gap-gb-2xl sm:grid-cols-2">
          <Input
            name="account-name"
            label="Full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
          <Input
            name="account-email"
            type="email"
            label="Email address"
            value={accountEmail}
            onChange={(e) => setAccountEmail(e.target.value)}
            hint="Changing your email requires confirmation."
            required
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
          <Select
            name="nationality"
            label="Nationality"
            placeholder="Select nationality…"
            value={nationality}
            onChange={(e) => setNationality(e.target.value)}
          >
            <SelectOptions options={[...NATIONALITIES]} value={nationality} />
          </Select>
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

        <SaveBar
          onSave={handleSave}
          saving={saving}
          message={message}
          returnTo={returnTo}
          updatedLabel="Personal information"
        />
      </Panel>
    </div>
  );
}
