'use client';

import { useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { WorkExperience } from '@/lib/types';
import { Checkbox, Input, Panel, RepeatableFieldset, Select, Textarea } from '@/shared/ui';
import { useLoadingIndicator } from '@/shared/ui/loading-overlay';
import { SaveBar, SelectOptions, type SaveMessage } from '../_form-parts';

const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Internship', 'Volunteer', 'Freelance', 'Other'];

type DraftExperience = Omit<WorkExperience, 'id' | 'user_id' | 'created_at' | 'updated_at'> & { _localId: string; id?: string };

export function WorkForm({
  userId,
  initialExperiences,
  returnTo,
  updatedLabel,
}: {
  userId: string;
  initialExperiences: WorkExperience[];
  returnTo?: string | null;
  updatedLabel?: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [experiences, setExperiences] = useState<DraftExperience[]>(
    initialExperiences.map((e) => ({ ...e, _localId: e.id }))
  );
  const [saving, setSaving] = useState(false);
  useLoadingIndicator(saving, 'Saving your profile');
  const [message, setMessage] = useState<SaveMessage>(null);

  const addExperience = () => {
    setExperiences((prev) => [
      ...prev,
      {
        _localId: crypto.randomUUID(),
        company: '',
        role: '',
        employment_type: '',
        start_date: null,
        end_date: null,
        is_current: false,
        description: null,
      },
    ]);
  };

  const update = (localId: string, field: string, value: unknown) => {
    setExperiences((prev) =>
      prev.map((e) => (e._localId === localId ? { ...e, [field]: value } : e))
    );
  };

  const removeAt = async (index: number) => {
    const exp = experiences[index];
    if (!exp) return;
    if (exp.id) {
      await supabase.from('work_experiences').delete().eq('id', exp.id);
    }
    setExperiences((prev) => prev.filter((e) => e._localId !== exp._localId));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    for (const exp of experiences) {
      if (!exp.company.trim() || !exp.role.trim()) continue;
      if (exp.id) {
        await supabase.from('work_experiences').update({
          company: exp.company,
          role: exp.role,
          employment_type: exp.employment_type || null,
          start_date: exp.start_date || null,
          end_date: exp.is_current ? null : exp.end_date || null,
          is_current: exp.is_current ?? false,
          description: exp.description || null,
          updated_at: new Date().toISOString(),
        }).eq('id', exp.id);
      } else {
        const { data } = await supabase.from('work_experiences').insert({
          user_id: userId,
          company: exp.company,
          role: exp.role,
          employment_type: exp.employment_type || null,
          start_date: exp.start_date || null,
          end_date: exp.is_current ? null : exp.end_date || null,
          is_current: exp.is_current ?? false,
          description: exp.description || null,
        }).select('id').single();
        if (data) {
          setExperiences((prev) =>
            prev.map((e) => (e._localId === exp._localId ? { ...e, id: data.id } : e))
          );
        }
      }
    }

    setMessage({ text: 'Saved successfully.', ok: true });
    setSaving(false);
  };

  return (
    <Panel className="flex flex-col gap-gb-4xl">
      <RepeatableFieldset
        legend="Experience"
        description="Company and role are required — an entry missing either is skipped when you save."
        entries={experiences}
        keyOf={(exp) => exp._localId}
        entryLabel={(i) => `Experience ${i + 1}`}
        addLabel="Add work experience"
        onAdd={addExperience}
        onRemove={(index) => void removeAt(index)}
        emptyState="Nothing here yet. Internships, part-time jobs and volunteering all count."
        renderEntry={(exp) => (
          <div className="grid gap-gb-2xl sm:grid-cols-2">
            <Input
              name={`company-${exp._localId}`}
              label="Company / Organisation"
              placeholder="e.g. Google"
              value={exp.company}
              onChange={(e) => update(exp._localId, 'company', e.target.value)}
            />
            <Input
              name={`role-${exp._localId}`}
              label="Job title / Role"
              placeholder="e.g. Software Engineering Intern"
              value={exp.role}
              onChange={(e) => update(exp._localId, 'role', e.target.value)}
            />
            <Select
              name={`employment_type-${exp._localId}`}
              label="Employment type"
              placeholder="Select type…"
              value={exp.employment_type ?? ''}
              onChange={(e) => update(exp._localId, 'employment_type', e.target.value)}
            >
              <SelectOptions options={EMPLOYMENT_TYPES} value={exp.employment_type ?? ''} />
            </Select>
            <Input
              name={`start_date-${exp._localId}`}
              type="month"
              label="Start date"
              value={exp.start_date?.slice(0, 7) ?? ''}
              onChange={(e) => update(exp._localId, 'start_date', e.target.value ? e.target.value + '-01' : null)}
            />
            {/* The end date is removed rather than disabled while "I currently
                work here" is ticked: a greyed-out field still reads as a thing
                to fill in, and the value it holds is not saved either way. */}
            {exp.is_current ? null : (
              <Input
                name={`end_date-${exp._localId}`}
                type="month"
                label="End date"
                value={exp.end_date?.slice(0, 7) ?? ''}
                onChange={(e) => update(exp._localId, 'end_date', e.target.value ? e.target.value + '-01' : null)}
              />
            )}
            <Checkbox
              name={`is_current-${exp._localId}`}
              label="I currently work here"
              checked={exp.is_current ?? false}
              onChange={(e) => update(exp._localId, 'is_current', e.target.checked)}
              className="self-end pb-gb-lg"
            />
            <Textarea
              name={`description-${exp._localId}`}
              label="Description"
              hint="Optional."
              rows={3}
              placeholder="Key responsibilities and achievements…"
              value={exp.description ?? ''}
              onChange={(e) => update(exp._localId, 'description', e.target.value || null)}
              fieldClassName="sm:col-span-2"
            />
          </div>
        )}
      />

      <SaveBar
        onSave={handleSave}
        saving={saving}
        message={message}
        label="Save experiences"
        returnTo={returnTo}
        updatedLabel={updatedLabel ?? 'Work experience'}
      />
    </Panel>
  );
}
