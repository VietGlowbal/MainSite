'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { regions, subjectFamilies, supportNeeds } from '@/lib/onboarding-options';
import type { StudentProfile } from '@/lib/types';
import { Input, Panel, PanelHeader, Select } from '@/shared/ui';
import { useLoadingIndicator } from '@/shared/ui/loading-overlay';
import {
  IntakeFields,
  SaveBar,
  SelectOptions,
  TagInput,
  returnAfterSave,
  type SaveMessage,
} from '../_form-parts';

const BUDGET_OPTIONS = [
  // The planning test's four values stay first so a saved answer is visibly
  // the same choice when the student reaches User Profile.
  'Under $15k',
  'Up to $25k',
  'Up to $50k',
  '$50k+',
  'Under $10,000 / year',
  '$10,000–$20,000 / year',
  '$20,000–$35,000 / year',
  '$35,000–$50,000 / year',
  'Over $50,000 / year',
  'Flexible / Scholarship dependent',
];

const STUDY_MODES = ['Full-time', 'Part-time', 'Either'];

const OPEN_TO_IDEAS = 'Open to ideas';
const COUNTRY_OPTIONS = [OPEN_TO_IDEAS, ...new Set(regions.flatMap((region) => region.countries))];
const SUBJECT_OPTIONS = [...new Set(subjectFamilies.flatMap((family) => family.children))];

function normalizeCountries(values: string[]): string[] {
  const uniqueValues = values.filter((value, index) => (
    values.findIndex((candidate) => candidate.trim().toLocaleLowerCase() === value.trim().toLocaleLowerCase()) === index
  ));

  return uniqueValues.some((value) => value.trim().toLocaleLowerCase() === OPEN_TO_IDEAS.toLocaleLowerCase())
    ? [OPEN_TO_IDEAS]
    : uniqueValues;
}

export function PreferencesForm({
  userId,
  initialProfile,
  returnTo,
  updatedLabel,
}: {
  userId: string;
  initialProfile: StudentProfile | null;
  returnTo?: string | undefined;
  updatedLabel?: string | undefined;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [countries, setCountries] = useState<string[]>(() => normalizeCountries(initialProfile?.preferred_countries ?? []));
  const [cities, setCities] = useState<string[]>(initialProfile?.preferred_cities ?? []);
  const [subjects, setSubjects] = useState<string[]>(initialProfile?.target_subjects ?? []);
  const [budget, setBudget] = useState(initialProfile?.budget_range ?? '');
  const [campus, setCampus] = useState(initialProfile?.campus_preferences ?? '');
  const [supportNeed, setSupportNeed] = useState(initialProfile?.support_needs ?? '');
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
        support_needs: supportNeed || null,
        study_mode_preference: studyMode || null,
        target_intake: intake || null,
        application_cycle_year: cycleYear ? parseInt(cycleYear, 10) : null,
      },
      { onConflict: 'user_id' },
    );
    if (error) {
      setMessage({ text: error.message, ok: false });
      setSaving(false);
      return;
    }
    if (returnTo) {
      returnAfterSave(router, returnTo, updatedLabel ?? 'Study plans');
      return;
    }
    setMessage({ text: 'Saved successfully.', ok: true });
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
          suggestions={COUNTRY_OPTIONS}
          exclusiveValue={OPEN_TO_IDEAS}
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
          suggestions={SUBJECT_OPTIONS}
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
          <IntakeFields
            intake={intake}
            onIntakeChange={setIntake}
            cycleYear={cycleYear}
            onCycleYearChange={setCycleYear}
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
          <Select
            name="support_needs"
            label="Where you want support most"
            placeholder="Select a support area…"
            hint="This is the same answer used by your education-planning test."
            value={supportNeed}
            onChange={(e) => setSupportNeed(e.target.value)}
            fieldClassName="sm:col-span-2"
          >
            <SelectOptions options={supportNeeds} value={supportNeed} />
          </Select>
        </div>

        <SaveBar
          onSave={handleSave}
          saving={saving}
          message={message}
          label={returnTo ? 'Save & return to application' : 'Save preferences'}
        />
      </Panel>
    </div>
  );
}
