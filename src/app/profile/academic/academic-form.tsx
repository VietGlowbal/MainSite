'use client';

import { useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { StudentProfile } from '@/lib/types';
import { useLoadingIndicator } from '@/shared/ui/loading-overlay';

const INPUT = 'block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-100 transition';
const LABEL = 'block text-xs font-semibold text-slate-700 mb-1.5';
const SELECT = INPUT + ' bg-white';

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
  const [subjectInput, setSubjectInput] = useState('');
  const [subjects, setSubjects] = useState<string[]>(initialProfile?.target_subjects ?? []);
  const [saving, setSaving] = useState(false);
  useLoadingIndicator(saving, 'Saving your profile');
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const addSubject = () => {
    const t = subjectInput.trim();
    if (t && !subjects.includes(t)) setSubjects((prev) => [...prev, t]);
    setSubjectInput('');
  };

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
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={LABEL}>Current study level</label>
          <select className={SELECT} value={studyLevel} onChange={(e) => setStudyLevel(e.target.value)}>
            <option value="">Select level…</option>
            {STUDY_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className={LABEL}>Current / most recent institution</label>
          <input
            className={INPUT}
            placeholder="e.g. Hanoi Amsterdam High School"
            value={institution}
            onChange={(e) => setInstitution(e.target.value)}
          />
        </div>
        <div>
          <label className={LABEL}>Qualification type</label>
          <select className={SELECT} value={qualification} onChange={(e) => setQualification(e.target.value)}>
            <option value="">Select qualification…</option>
            {QUALIFICATIONS.map((q) => <option key={q} value={q}>{q}</option>)}
          </select>
        </div>
        <div>
          <label className={LABEL}>Predicted / achieved grades</label>
          <input
            className={INPUT}
            placeholder="e.g. A*AA, GPA 3.8, 38 IB points"
            value={predictedGrades}
            onChange={(e) => setPredictedGrades(e.target.value)}
          />
        </div>
        <div>
          <label className={LABEL}>Expected graduation year</label>
          <input
            className={INPUT}
            type="number"
            min="2020"
            max="2035"
            placeholder="e.g. 2027"
            value={graduationYear}
            onChange={(e) => setGraduationYear(e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={LABEL}>Academic background summary</label>
          <textarea
            className={INPUT}
            rows={3}
            placeholder="Briefly describe your academic history and any notable achievements…"
            value={background}
            onChange={(e) => setBackground(e.target.value)}
          />
        </div>

        {/* Target subjects */}
        <div className="sm:col-span-2">
          <label className={LABEL}>Target subjects / fields of study</label>
          <div className="flex gap-2">
            <input
              className={INPUT}
              placeholder="e.g. Computer Science, Engineering, Business…"
              value={subjectInput}
              onChange={(e) => setSubjectInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSubject(); } }}
            />
            <button
              type="button"
              onClick={addSubject}
              className="shrink-0 rounded-xl border border-pink-300 bg-pink-50 px-4 text-sm font-semibold text-pink-600 transition hover:bg-pink-100"
            >
              Add
            </button>
          </div>
          {subjects.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {subjects.map((s) => (
                <span key={s} className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">
                  {s}
                  <button
                    type="button"
                    onClick={() => setSubjects((prev) => prev.filter((x) => x !== s))}
                    className="hover:text-red-500 transition"
                  >×</button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 flex items-center gap-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-full bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] px-6 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(255,77,140,0.25)] transition hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        {message && (
          <p className={`text-sm ${message.ok ? 'text-green-600' : 'text-red-500'}`}>{message.text}</p>
        )}
      </div>
    </div>
  );
}
