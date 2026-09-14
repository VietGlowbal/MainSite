'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Panel, PanelHeader } from '@/shared/ui';
import { useLoadingIndicator } from '@/shared/ui/loading-overlay';
import { SaveBar, TagInput, type SaveMessage } from './_form-parts';

interface Props {
  userId: string;
  initialSkills: string[];
  returnTo?: string | null;
  updatedLabel?: string;
}

const SKILL_SUGGESTIONS = ['Python', 'Public speaking', 'Research', 'Leadership', 'Data analysis', 'Debate', 'Volunteering', 'Graphic design'];

/** Skills are profile-owned labels; structured evidence lives in reflection tables. */
export function AchievementsForm({ userId, initialSkills, returnTo, updatedLabel }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [skills, setSkills] = useState<string[]>(initialSkills);
  const [saving, setSaving] = useState(false);
  useLoadingIndicator(saving, 'Saving your skills');
  const [message, setMessage] = useState<SaveMessage>(null);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    const { error } = await supabase
      .from('student_profiles')
      .upsert({ user_id: userId, skills }, { onConflict: 'user_id' });
    setMessage(error ? { text: error.message, ok: false } : { text: 'Saved successfully.', ok: true });
    setSaving(false);
  };

  return (
    <div className="flex flex-col gap-gb-3xl">
      <Panel className="flex flex-col gap-gb-2xl">
        <PanelHeader
          title="Skills"
          description="Short labels, not sentences. These appear on your profile as chips."
        />

        <TagInput
          name="skills"
          label="Your skills"
          values={skills}
          onChange={setSkills}
          placeholder="e.g. Python, Public speaking, Research…"
          suggestions={SKILL_SUGGESTIONS}
        />

        <SaveBar
          onSave={handleSave}
          saving={saving}
          message={message}
          label="Save skills"
          returnTo={returnTo}
          updatedLabel={updatedLabel ?? 'Skills'}
        />
      </Panel>
    </div>
  );
}
