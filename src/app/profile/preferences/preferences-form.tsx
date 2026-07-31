'use client';

import { useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { StudentProfile } from '@/lib/types';
import { Input, Panel, PanelHeader, Select } from '@/shared/ui';
import { useLoadingIndicator } from '@/shared/ui/loading-overlay';
import { SaveBar, SelectOptions, TagInput, type SaveMessage } from '../_form-parts';

const BUDGET_OPTIONS = [
  'Under $10,000 / year',
  '$10,000–$20,000 / year',
  '$20,000–$35,000 / year',
  '$35,000–$50,000 / year',
  'Over $50,000 / year',
  'Flexible / Scholarship dependent',
];

const STUDY_MODES = ['Full-time', 'Part-time', 'Either'];

const POPULAR_COUNTRIES = ['United Kingdom', 'United States', 'Australia', 'Canada', 'Germany', 'Netherlands', 'Singapore', 'Japan', 'South Korea', 'Vietnam'];

export function PreferencesForm({
  userId,
  initialProfile,
}: {
  userId: string;
  initialProfile: StudentProfile | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [countries, setCountries] = useState<string[]>(initialProfile?.preferred_countries ?? []);
  const [cities, setCities] = useState<string[]>(initialProfile?.preferred_cities ?? []);
  const [subjects, setSubjects] = useState<string[]>(initialProfile?.target_subjects ?? []);
  const [budget, setBudget] = useState(initialProfile?.budget_range ?? '');
  const [campus, setCampus] = useState(initialProfile?.campus_preferences ?? '');
  const [studyMode, setStudyMode] = useState(initialProfile?.study_mode_preference ?? '');
  const [intake, setIntake] = useState(initialProfile?.target_intake ?? '');
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
        preferred_countries: countries.length > 0 ? countries : null,
        preferred_cities: cities.length > 0 ? cities : null,
        target_subjects: subjects.length > 0 ? subjects : null,
        budget_range: budget || null,
        campus_preferences: campus || null,
        study_mode_preference: studyMode || null,
        target_intake: intake || null,
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
          title="Where and what"
          description="The shortlist and the tier list are built from these three lists."
        />

        <TagInput
          name="preferred_countries"
          label="Preferred countries"
          values={countries}
          onChange={setCountries}
          placeholder="e.g. United Kingdom"
          suggestions={POPULAR_COUNTRIES}
        />

        <TagInput
          name="preferred_cities"
          label="Preferred cities"
          values={cities}
          onChange={setCities}
          placeholder="e.g. London, Manchester"
          hint="Optional. Leave empty to see courses anywhere in your chosen countries."
        />

        <TagInput
          name="target_subjects"
          label="Target subjects / fields"
          values={subjects}
          onChange={setSubjects}
          placeholder="e.g. Computer Science, Law"
        />
      </Panel>

      <Panel className="flex flex-col gap-gb-2xl">
        <PanelHeader title="Budget and study mode" />

        <div className="grid gap-gb-2xl sm:grid-cols-2">
          <Select
            name="budget_range"
            label="Budget range"
            placeholder="Select budget…"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
          >
            <SelectOptions options={BUDGET_OPTIONS} value={budget} />
          </Select>
          <Select
            name="study_mode_preference"
            label="Preferred study mode"
            placeholder="Select mode…"
            value={studyMode}
            onChange={(e) => setStudyMode(e.target.value)}
          >
            <SelectOptions options={STUDY_MODES} value={studyMode} />
          </Select>
          <Input
            name="target_intake"
            label="Target intake"
            placeholder="e.g. Sep 2027"
            value={intake}
            onChange={(e) => setIntake(e.target.value)}
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
          <Input
            name="campus_preferences"
            label="Campus preferences"
            placeholder="e.g. Large city campus, close to industry hubs"
            hint="Optional. Anything about the place itself that matters to you."
            value={campus}
            onChange={(e) => setCampus(e.target.value)}
            fieldClassName="sm:col-span-2"
          />
        </div>

        <SaveBar onSave={handleSave} saving={saving} message={message} label="Save preferences" />
      </Panel>
    </div>
  );
}
