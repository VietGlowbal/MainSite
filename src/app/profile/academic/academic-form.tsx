'use client';

import { useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { StudentProfile } from '@/lib/types';
import { Input, Panel, PanelHeader, Select, Textarea } from '@/shared/ui';
import { useLoadingIndicator } from '@/shared/ui/loading-overlay';
import { SaveBar, SelectOptions, TagInput, type SaveMessage } from '../_form-parts';

const STUDY_LEVELS = ['Secondary / High school', 'Foundation', 'Undergraduate', 'Postgraduate (Masters)', 'PhD / Doctorate', 'Other'];
const QUALIFICATIONS = ['A-Levels', 'IB Diploma', 'BTEC', 'Vietnamese High School Diploma', 'Baccalaureate', 'Foundation Diploma', 'Associate Degree', 'Bachelors Degree', 'Other'];

export function AcademicForm({
  userId,
  initialProfile,
}: {
  userId: string;
  initialProfile: StudentProfile | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [studyLevel, setStudyLevel] = useState(initialProfile?.study_level ?? '');
  const [institution, setInstitution] = useState(initialProfile?.current_institution ?? '');
  const [qualification, setQualification] = useState(initialProfile?.current_qualification ?? '');
  const [predictedGrades, setPredictedGrades] = useState(initialProfile?.predicted_grades ?? '');
  const [graduationYear, setGraduationYear] = useState(String(initialProfile?.graduation_year ?? ''));
  const [background, setBackground] = useState(initialProfile?.academic_background ?? '');
  const [subjects, setSubjects] = useState<string[]>(initialProfile?.target_subjects ?? []);
  const [saving, setSaving] = useState(false);
  useLoadingIndicator(saving, 'Saving your profile');
  const [message, setMessage] = useState<SaveMessage>(null);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    const { error } = await supabase.from('student_profiles').upsert(
      {
        user_id: userId,
        study_level: studyLevel || null,
        current_institution: institution || null,
        current_qualification: qualification || null,
        predicted_grades: predictedGrades || null,
        graduation_year: graduationYear ? parseInt(graduationYear, 10) : null,
        academic_background: background || null,
        target_subjects: subjects.length > 0 ? subjects : null,
      },
      { onConflict: 'user_id' },
    );
    setMessage(error ? { text: error.message, ok: false } : { text: 'Saved successfully.', ok: true });
    setSaving(false);
  };

  return (
    <div className="flex flex-col gap-gb-3xl">
      <Panel className="flex flex-col gap-gb-2xl">
        <PanelHeader title="Where you study now" />

        <div className="grid gap-gb-2xl sm:grid-cols-2">
          <Select
            name="study_level"
            label="Current study level"
            placeholder="Select level…"
            value={studyLevel}
            onChange={(e) => setStudyLevel(e.target.value)}
          >
            <SelectOptions options={STUDY_LEVELS} value={studyLevel} />
          </Select>
          <Input
            name="current_institution"
            label="Current / most recent institution"
            placeholder="e.g. Hanoi Amsterdam High School"
            value={institution}
            onChange={(e) => setInstitution(e.target.value)}
          />
          <Select
            name="current_qualification"
            label="Qualification type"
            placeholder="Select qualification…"
            value={qualification}
            onChange={(e) => setQualification(e.target.value)}
          >
            <SelectOptions options={QUALIFICATIONS} value={qualification} />
          </Select>
          <Input
            name="predicted_grades"
            label="Predicted / achieved grades"
            placeholder="e.g. A*AA, GPA 3.8, 38 IB points"
            value={predictedGrades}
            onChange={(e) => setPredictedGrades(e.target.value)}
          />
          <Input
            name="graduation_year"
            type="number"
            min="2020"
            max="2035"
            label="Expected graduation year"
            placeholder="e.g. 2027"
            value={graduationYear}
            onChange={(e) => setGraduationYear(e.target.value)}
          />
        </div>
      </Panel>

      <Panel className="flex flex-col gap-gb-2xl">
        <PanelHeader
          title="Your academic story"
          description="Free text and subjects. This is what the AI reads when it scores how well you match a course."
        />

        <Textarea
          name="academic_background"
          label="Academic background summary"
          rows={4}
          placeholder="Briefly describe your academic history and any notable achievements…"
          value={background}
          onChange={(e) => setBackground(e.target.value)}
        />

        <TagInput
          name="target_subjects"
          label="Target subjects / fields of study"
          values={subjects}
          onChange={setSubjects}
          placeholder="e.g. Computer Science, Engineering, Business…"
        />

        <SaveBar onSave={handleSave} saving={saving} message={message} />
      </Panel>
    </div>
  );
}
