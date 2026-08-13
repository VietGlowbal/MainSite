'use client';

import { useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  CURRICULUM_GRADE_FORMATS,
  academicComplete,
  academicFromProfile,
  collectCurriculumGrades,
  defaultScaleFor,
  gradeFormatFor,
  scalesFor,
  toCurriculumGrades,
  type Academic,
} from '@/features/onboarding/domain';
import type { StudentProfile } from '@/lib/types';
import {
  Input,
  MultiSelect,
  Panel,
  PanelHeader,
  Select,
  Textarea,
  type MultiSelectOption,
} from '@/shared/ui';
import { useLoadingIndicator } from '@/shared/ui/loading-overlay';
import { SaveBar, SelectOptions, type SaveMessage } from '../_form-parts';
import { TargetSubjectsField } from './target-subjects-field';

const STUDY_LEVELS = ['Secondary / High school', 'Foundation', 'Undergraduate', 'Postgraduate (Masters)', 'PhD / Doctorate', 'Other'];
const QUALIFICATIONS = ['A-Levels', 'IB Diploma', 'BTEC', 'Vietnamese High School Diploma', 'Baccalaureate', 'Foundation Diploma', 'Associate Degree', 'Bachelors Degree', 'Other'];
const CURRICULUM_OPTIONS: readonly MultiSelectOption[] = Object.keys(
  CURRICULUM_GRADE_FORMATS,
).map((value) => ({ value, label: value }));

/** An un-migrated database may still have NUMERIC(4,2), whose maximum is 99.99. */
const LEGACY_GPA_COLUMN_MAX = 99.99;

function problemText(
  problem: { message: string; vars: Record<string, string | number> } | null,
): string | undefined {
  if (problem === null) return undefined;
  return problem.message.replace(/\{(\w+)\}/g, (_match, key: string) =>
    problem.vars[key] === undefined ? `{${key}}` : String(problem.vars[key]),
  );
}

function fieldSlug(value: string): string {
  return value.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '');
}

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
  const [academic, setAcademic] = useState<Academic>(() =>
    academicFromProfile(initialProfile ?? {}),
  );
  const [showGradeErrors, setShowGradeErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  useLoadingIndicator(saving, 'Saving your profile');
  const [message, setMessage] = useState<SaveMessage>(null);

  const curriculumOptions = useMemo(() => {
    const known = new Set(CURRICULUM_OPTIONS.map((option) => option.value));
    const stored = academic.curriculum
      .filter((value) => !known.has(value))
      .map((value) => ({ value, label: value }));
    return [...CURRICULUM_OPTIONS, ...stored];
  }, [academic.curriculum]);

  const pickCurricula = (curriculum: string[]) => {
    setAcademic((current) => {
      const scales: Record<string, string> = {};
      const grades: Record<string, string> = {};
      for (const name of curriculum) {
        scales[name] = current.scales[name] ?? defaultScaleFor(name);
        if (current.grades[name] !== undefined) grades[name] = current.grades[name];
      }
      return { curriculum, scales, grades };
    });
  };

  const pickScale = (curriculum: string, scale: string) => {
    setAcademic((current) => {
      const grades = { ...current.grades };
      delete grades[curriculum];
      return {
        ...current,
        scales: { ...current.scales, [curriculum]: scale },
        grades,
      };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    setShowGradeErrors(true);

    if (academic.curriculum.length > 0 && !academicComplete(academic)) {
      setMessage({
        text: 'Add a valid grade for every selected curriculum before saving.',
        ok: false,
      });
      setSaving(false);
      return;
    }

    const normalizedGrades = collectCurriculumGrades(academic);
    // Unknown legacy curricula have no current validator. Preserve their stored
    // rows verbatim instead of erasing data the student cannot recreate here.
    const preservedUnknownGrades = toCurriculumGrades(initialProfile?.curriculum_grades).filter(
      (row) =>
        academic.curriculum.includes(row.curriculum) &&
        gradeFormatFor(row.curriculum, row.scale) === undefined,
    );
    const curriculumGrades = [...normalizedGrades, ...preservedUnknownGrades];
    const comparable = normalizedGrades.find(
      (row) => row.value !== null && row.value <= LEGACY_GPA_COLUMN_MAX,
    );

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
        curriculum: academic.curriculum.length > 0 ? academic.curriculum : null,
        curriculum_grades: curriculumGrades.length > 0 ? curriculumGrades : null,
        gpa_scale: comparable?.scale ?? null,
        gpa_value: comparable?.value ?? null,
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
          title="Curriculum and grades"
          description="These are the curriculum and scale-aware grades saved by your education-planning test."
        />

        <MultiSelect
          name="curriculum"
          label="Curriculum"
          placeholder="Find a curriculum"
          options={curriculumOptions}
          value={academic.curriculum}
          onChange={pickCurricula}
        />

        {academic.curriculum.map((curriculum) => {
          const slug = fieldSlug(curriculum);
          const formats = scalesFor(curriculum);
          const format = gradeFormatFor(curriculum, academic.scales[curriculum]);
          const rawGrade = academic.grades[curriculum] ?? '';
          const error = format
            ? rawGrade.trim() === ''
              ? showGradeErrors
                ? 'Enter your grade for this curriculum.'
                : undefined
              : problemText(format.check(rawGrade))
            : undefined;

          return (
            <div
              key={curriculum}
              className="flex flex-col gap-gb-xl rounded-gb-xl border border-line bg-surface-muted p-gb-xl"
            >
              <h3 className="text-gb-sm font-semibold text-fg">{curriculum}</h3>

              {format && formats.length > 1 ? (
                <Select
                  name={`grading-scale-${slug}`}
                  label="Grading scale"
                  value={format.scale}
                  onChange={(event) => pickScale(curriculum, event.target.value)}
                >
                  {formats.map((option) => (
                    <option key={option.scale} value={option.scale}>
                      {option.scale}
                    </option>
                  ))}
                </Select>
              ) : format ? (
                <p className="text-gb-sm text-fg-tertiary">
                  Grading scale: <span className="font-medium text-fg">{format.scale}</span>
                </p>
              ) : (
                <p className="text-gb-sm text-fg-tertiary">
                  This saved curriculum is no longer in the current test. It will be preserved
                  unless you remove it.
                </p>
              )}

              {format ? (
                <Input
                  name={`curriculum-grade-${slug}`}
                  label={format.fieldLabel}
                  inputMode={format.numeric ? 'decimal' : 'text'}
                  placeholder={format.placeholder}
                  hint={format.hint}
                  error={error}
                  value={rawGrade}
                  onChange={(event) =>
                    setAcademic((current) => ({
                      ...current,
                      grades: { ...current.grades, [curriculum]: event.target.value },
                    }))
                  }
                />
              ) : null}
            </div>
          );
        })}
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

        <TargetSubjectsField values={subjects} onChange={setSubjects} />

        <SaveBar onSave={handleSave} saving={saving} message={message} />
      </Panel>
    </div>
  );
}
