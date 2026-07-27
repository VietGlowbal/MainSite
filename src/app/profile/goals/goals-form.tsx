'use client';

import { useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { StudentProfile } from '@/lib/types';
import { useLoadingIndicator } from '@/shared/ui';

const INPUT = 'block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-100 transition';
const LABEL = 'block text-xs font-semibold text-slate-700 mb-1.5';

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
  const [careerInput, setCareerInput] = useState('');
  const [careers, setCareers] = useState<string[]>(initialProfile?.career_interests ?? []);
  const [targetIntake, setTargetIntake] = useState(initialProfile?.target_intake ?? '');
  const [cycleYear, setCycleYear] = useState(String(initialProfile?.application_cycle_year ?? ''));
  const [saving, setSaving] = useState(false);
  useLoadingIndicator(saving, 'Saving your profile');
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const addCareer = (val: string) => {
    const t = val.trim();
    if (t && !careers.includes(t)) setCareers((prev) => [...prev, t]);
    setCareerInput('');
  };

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
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
      <div className="space-y-5">
        <div>
          <label className={LABEL}>Your goals</label>
          <textarea
            className={INPUT}
            rows={4}
            placeholder="What do you want to achieve through higher education? What are your long-term ambitions?…"
            value={goals}
            onChange={(e) => setGoals(e.target.value)}
          />
        </div>

        <div>
          <label className={LABEL}>Career interests</label>
          <div className="flex gap-2">
            <input
              className={INPUT}
              placeholder="e.g. Software Engineer, Researcher…"
              value={careerInput}
              onChange={(e) => setCareerInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCareer(careerInput); } }}
            />
            <button
              type="button"
              onClick={() => addCareer(careerInput)}
              className="shrink-0 rounded-xl border border-pink-300 bg-pink-50 px-4 text-sm font-semibold text-pink-600 transition hover:bg-pink-100"
            >
              Add
            </button>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {CAREER_SUGGESTIONS.filter((s) => !careers.includes(s)).slice(0, 6).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => addCareer(s)}
                className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] text-slate-500 transition hover:border-pink-300 hover:bg-pink-50 hover:text-pink-600"
              >
                + {s}
              </button>
            ))}
          </div>
          {careers.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {careers.map((c) => (
                <span key={c} className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
                  {c}
                  <button type="button" onClick={() => setCareers((prev) => prev.filter((x) => x !== c))} className="hover:text-red-500 transition">×</button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={LABEL}>Target intake</label>
            <input
              className={INPUT}
              placeholder="e.g. Sep 2027"
              value={targetIntake}
              onChange={(e) => setTargetIntake(e.target.value)}
            />
          </div>
          <div>
            <label className={LABEL}>Application cycle year</label>
            <input
              className={INPUT}
              type="number"
              min="2025"
              max="2035"
              placeholder="e.g. 2027"
              value={cycleYear}
              onChange={(e) => setCycleYear(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-full bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] px-6 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(255,77,140,0.25)] transition hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : 'Save goals'}
        </button>
        {message && (
          <p className={`text-sm ${message.ok ? 'text-green-600' : 'text-red-500'}`}>{message.text}</p>
        )}
      </div>
    </div>
  );
}
