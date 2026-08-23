'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Input, Panel, PanelHeader, RepeatableFieldset, Textarea } from '@/shared/ui';
import { useLoadingIndicator } from '@/shared/ui/loading-overlay';
import { SaveBar, TagInput, type SaveMessage } from './_form-parts';

interface Achievement {
  id: string;
  title: string;
  description: string;
  year: string;
}

interface Props {
  userId: string;
  initialAchievements: Achievement[];
  initialSkills: string[];
  returnTo?: string | null;
  updatedLabel?: string;
}

const SKILL_SUGGESTIONS = ['Python', 'Public speaking', 'Research', 'Leadership', 'Data analysis', 'Debate', 'Volunteering', 'Graphic design'];

export function AchievementsForm({ userId, initialAchievements, initialSkills, returnTo, updatedLabel }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [achievements, setAchievements] = useState<Achievement[]>(initialAchievements);
  const [skills, setSkills] = useState<string[]>(initialSkills);
  const [saving, setSaving] = useState(false);
  useLoadingIndicator(saving, 'Saving your achievements');
  const [message, setMessage] = useState<SaveMessage>(null);

  const addAchievement = () => {
    setAchievements((prev) => [
      ...prev,
      { id: crypto.randomUUID(), title: '', description: '', year: '' },
    ]);
  };

  const updateAchievement = (id: string, field: keyof Achievement, value: string) => {
    setAchievements((prev) => prev.map((a) => (a.id === id ? { ...a, [field]: value } : a)));
  };

  const removeAt = (index: number) => {
    setAchievements((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    const { error } = await supabase
      .from('student_profiles')
      .upsert({ user_id: userId, achievements, skills }, { onConflict: 'user_id' });
    setMessage(error ? { text: error.message, ok: false } : { text: 'Saved successfully.', ok: true });
    setSaving(false);
  };

  return (
    <div className="flex flex-col gap-gb-3xl">
      <Panel>
        <RepeatableFieldset
          legend="Top achievements"
          description="Awards, competitions, leadership roles — anything you would want an admissions officer to see."
          entries={achievements}
          keyOf={(a) => a.id}
          entryLabel={(i) => `Achievement ${i + 1}`}
          addLabel="Add achievement"
          onAdd={addAchievement}
          onRemove={removeAt}
          emptyState="No achievements added yet."
          renderEntry={(a) => (
            <div className="flex flex-col gap-gb-2xl">
              <div className="grid gap-gb-2xl sm:grid-cols-[minmax(0,1fr)_140px]">
                <Input
                  name={`achievement-title-${a.id}`}
                  label="Title"
                  placeholder="e.g. National Science Olympiad finalist"
                  value={a.title}
                  onChange={(e) => updateAchievement(a.id, 'title', e.target.value)}
                />
                <Input
                  name={`achievement-year-${a.id}`}
                  label="Year"
                  placeholder="e.g. 2025"
                  value={a.year}
                  onChange={(e) => updateAchievement(a.id, 'year', e.target.value)}
                />
              </div>
              <Textarea
                name={`achievement-description-${a.id}`}
                label="Description"
                rows={3}
                placeholder="What it was, and what you did…"
                value={a.description}
                onChange={(e) => updateAchievement(a.id, 'description', e.target.value)}
              />
            </div>
          )}
        />
      </Panel>

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
          label="Save achievements & skills"
          returnTo={returnTo}
          updatedLabel={updatedLabel ?? 'Achievements'}
        />
      </Panel>
    </div>
  );
}
