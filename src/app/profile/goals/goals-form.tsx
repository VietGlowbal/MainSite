'use client';

import { useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { StudentProfile } from '@/lib/types';
import { Input, Panel, PanelHeader, Textarea } from '@/shared/ui';
import { useLoadingIndicator } from '@/shared/ui/loading-overlay';
import { SaveBar, TagInput, type SaveMessage } from '../_form-parts';

const CAREER_SUGGESTIONS = ['Software Engineer', 'Data Scientist', 'Product Manager', 'Consultant', 'Entrepreneur', 'Doctor', 'Lawyer', 'Academic Researcher', 'Finance Analyst', 'Designer'];

export function GoalsForm({
  userId,
  initialProfile,
}: {
  userId: string;
  initialProfile: StudentProfile | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [goals, setGoals] = useState(initialProfile?.goals ?? '');
  const [careers, setCareers] = useState<string[]>(initialProfile?.career_interests ?? []);
  const [targetIntake, setTargetIntake] = useState(initialProfile?.target_intake ?? '');
  const [cycleYear, setCycleYear] = useState(String(initialProfile?.application_cycle_year ?? ''));
  const [saving, setSaving] = useState(false);
  useLoadingIndicator(saving, 'Saving your profile');
  const [message, setMessage] = useState<SaveMessage>(null);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    const { error } = await supabase.from('student_profiles').upsert(
      {
        user_id: userId,
        goals: goals || null,
        career_interests: careers.length > 0 ? careers : null,
        target_intake: targetIntake || null,
        application_cycle_year: cycleYear ? parseInt(cycleYear, 10) : null,
      },
      { onConflict: 'user_id' },
    );
    setMessage(error ? { text: error.message, ok: false } : { text: 'Saved successfully.', ok: true });
    setSaving(false);
  };

  return (
    <div className="flex flex-col gap-gb-3xl">
      <Panel className="flex flex-col gap-gb-2xl">
        <PanelHeader
          title="What you are aiming for"
          description="Written in your own words. This is the part an advisor reads first."
        />

        <Textarea
          name="goals"
          label="Your goals"
          rows={5}
          placeholder="What do you want to achieve through higher education? What are your long-term ambitions?…"
          value={goals}
          onChange={(e) => setGoals(e.target.value)}
        />

        <TagInput
          name="career_interests"
          label="Career interests"
          values={careers}
          onChange={setCareers}
          placeholder="e.g. Software Engineer, Researcher…"
          suggestions={CAREER_SUGGESTIONS}
        />
      </Panel>

      <Panel className="flex flex-col gap-gb-2xl">
        <PanelHeader
          title="When you plan to start"
          description="Deadlines and shortlists are built around this."
        />

        <div className="grid gap-gb-2xl sm:grid-cols-2">
          <Input
            name="target_intake"
            label="Target intake"
            placeholder="e.g. Sep 2027"
            value={targetIntake}
            onChange={(e) => setTargetIntake(e.target.value)}
          />
          <Input
            name="application_cycle_year"
            type="number"
            min="2025"
            max="2035"
            label="Application cycle year"
            placeholder="e.g. 2027"
            value={cycleYear}
            onChange={(e) => setCycleYear(e.target.value)}
          />
        </div>

        <SaveBar onSave={handleSave} saving={saving} message={message} label="Save goals" />
      </Panel>
    </div>
  );
}
